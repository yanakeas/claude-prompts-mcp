import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { readFile, writeFile, appendFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { z } from "zod";
import { Request, Response } from "express";
import {
  Config,
  TransportConfig,
  PromptData,
  PromptsFile,
  Message,
  Category
} from "./types.js";
/**
 * ========================================
 * TABLE OF CONTENTS
 * ========================================
 * 
 * 1. CONFIGURATION AND SETUP (lines ~22-92)
 *    - Command line arguments parsing
 *    - Configuration loading from config.json
 *    - Environment setup
 * 
 * 2. LOGGING SETUP (lines ~93-165)
 *    - Log file initialization
 *    - Custom logging functions
 *    - Startup information logging
 * 
 * 3. TYPES AND INTERFACES (lines ~166-180)
 *    - ConvertedPrompt interface definition
 * 
 * 4. PROMPT LOADING AND PROCESSING (lines ~181-264)
 *    - loadPromptFile function to read from markdown
 *    - convertMarkdownPromptsToJson function
 *    - Placeholder validation and verification
 * 
 * 5. SERVER CREATION AND TOOL DEFINITIONS (lines ~265-505)
 *    - MCP Server initialization
 *    - process_slash_command tool implementation (lines ~270-440)
 *      - Command parsing
 *      - listprompts command handling
 *      - Prompt matching and argument processing
 *    - listprompts tool implementation (lines ~440-505)
 * 
 * 6. PROMPT REGISTRATION (lines ~510-580)
 *    - Converting prompts to JSON structures
 *    - Registering prompts with server
 *    - Argument schema creation
 *    - Prompt handler functions
 * 
 * 7. TRANSPORT SETUP (lines ~580-720)
 *    - STDIO transport configuration
 *    - SSE transport with Express configuration
 *    - HTTP endpoints setup
 * 
 * 8. SERVER STARTUP AND ERROR HANDLING (lines ~720-745)
 *    - Server startup
 *    - Graceful shutdown handling
 *    - Uncaught exception handling
 * 
 * Note: Line numbers are approximate and may change as the file is modified.
 * When making changes, consider updating this table of contents.
 */

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up file logging for better debugging
const LOG_FILE = path.join(__dirname, "..", "server.log");

// Parse command line arguments first, before logging functions are created
const args = process.argv.slice(2);
const transportArg = args.find((arg: string) => arg.startsWith("--transport="));

// Load configuration early
const CONFIG_FILE = path.join(__dirname, "..", "config.json");
let config: Config;

try {
  const configContent = await readFile(CONFIG_FILE, "utf8");
  config = JSON.parse(configContent) as Config;
} catch (error) {
  console.error(`Error loading configuration from ${CONFIG_FILE}:`, error);
  console.info("Using default configuration");
  config = {
    server: {
      name: "Claude Custom Prompts",
      version: "1.0.0",
      port: 3456
    },
    prompts: {
      file: "prompts.json"
    },
    transports: {
      default: "sse",
      sse: { enabled: true },
      stdio: { enabled: true }
    }
  };
}

// Now we can determine the transport
const transport = transportArg 
  ? transportArg.split("=")[1] 
  : config.transports.default;

// Start with a clean log file
async function initLogFile() {
  try {
    await writeFile(LOG_FILE, `--- MCP Server Log Started at ${new Date().toISOString()} ---\n`, 'utf8');
  } catch (error) {
    console.error(`Error initializing log file:`, error);
  }
}

await initLogFile();

async function logToFile(level: string, message: string, ...args: any[]) {
  try {
    let logMessage = `[${new Date().toISOString()}] [${level}] ${message}`;
    if (args.length > 0) {
      logMessage += ` ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`;
    }
    await appendFile(LOG_FILE, logMessage + '\n', 'utf8');
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

// Set up logging for debugging
const log = {
  info: (message: string, ...args: any[]) => {
    // Only log to console when not using STDIO transport
    if (transport !== "stdio") {
      console.log(`[INFO] ${message}`, ...args);
    }
    logToFile('INFO', message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    // Only log to console when not using STDIO transport
    if (transport !== "stdio") {
      console.error(`[ERROR] ${message}`, ...args);
    }
    logToFile('ERROR', message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    // Only log to console when not using STDIO transport
    if (transport !== "stdio" && process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
    logToFile('DEBUG', message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    // Only log to console when not using STDIO transport
    if (transport !== "stdio") {
      console.warn(`[WARN] ${message}`, ...args);
    }
    logToFile('WARN', message, ...args);
  }
};

// Log startup information - this will be redirected to file if in STDIO mode
log.info(`Server starting up - Process ID: ${process.pid}`);
log.info(`Node version: ${process.version}`);
log.info(`Working directory: ${process.cwd()}`);
log.info(`Module path: ${__dirname}`);
log.info(`Using transport: ${transport}`);
log.info(`Command-line arguments: ${JSON.stringify(process.argv)}`);
log.info(`Loaded configuration from ${CONFIG_FILE}`);

// Use configuration values
const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
const PORT = config.server.port;

log.debug("Configuration:", JSON.stringify(config, null, 2));

// Check if the selected transport is enabled
if (!config.transports[transport] || !(config.transports[transport] as TransportConfig).enabled) {
  log.error(`Transport '${transport}' is not enabled in the configuration`);
  process.exit(1);
}

// Load prompts
let promptsData: PromptData[] = [];
let categories: Category[] = [];

try {
  const fileContent = await readFile(PROMPTS_FILE, "utf8");
  
  try {
    const promptsFile = JSON.parse(fileContent) as PromptsFile;
    promptsData = promptsFile.prompts;
    categories = promptsFile.categories || [];
    log.info(`Loaded ${promptsData.length} prompts and ${categories.length} categories from ${PROMPTS_FILE}`);
  } catch (parseError) {
    log.error(`Error parsing prompts file:`, parseError);
    process.exit(1);
  }
} catch (error) {
  log.error(`Error loading prompts from ${PROMPTS_FILE}:`, error);
  process.exit(1);
}

// Define the ConvertedPrompt interface based on its usage in the codebase
interface ConvertedPrompt {
  id: string;
  name: string;
  description: string;
  category: string;
  systemMessage?: string;
  userMessageTemplate: string;
  arguments: Array<{
    name: string;
    description?: string;
    required: boolean;
  }>;
  // Chain-related properties
  isChain?: boolean;                   // Whether this prompt is a chain of prompts
  chainSteps?: Array<{
    promptId: string;                  // ID of the prompt to execute in this step
    stepName: string;                  // Name of this step
    inputMapping?: Record<string, string>; // Maps chain inputs to this step's inputs
    outputMapping?: Record<string, string>; // Maps this step's outputs to chain outputs
  }>;
}

// Function to load prompt content from markdown file
async function loadPromptFile(filePath: string): Promise<{ 
  systemMessage?: string; 
  userMessageTemplate: string;
  isChain?: boolean;
  chainSteps?: Array<{
    promptId: string;
    stepName: string;
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
  }>;
}> {
  try {
    const fullPath = path.join(__dirname, "..", filePath);
    const content = await readFile(fullPath, "utf8");
    
    // Extract system message and user message template from markdown
    const systemMessageMatch = content.match(/## System Message\s*\n([\s\S]*?)(?=\n##|$)/);
    const userMessageMatch = content.match(/## User Message Template\s*\n([\s\S]*?)(?=\n##|$)/);
    
    const systemMessage = systemMessageMatch ? systemMessageMatch[1].trim() : undefined;
    const userMessageTemplate = userMessageMatch ? userMessageMatch[1].trim() : "";
    
    // Extract chain information if present
    const chainMatch = content.match(/## Chain Steps\s*\n([\s\S]*?)(?=\n##|$)/);
    let isChain = false;
    let chainSteps: Array<{
      promptId: string;
      stepName: string;
      inputMapping?: Record<string, string>;
      outputMapping?: Record<string, string>;
    }> = [];
    
    if (chainMatch) {
      isChain = true;
      const chainContent = chainMatch[1].trim();
      const stepMatches = chainContent.matchAll(/### Step (\d+): (.+)\s*\nPrompt: `([^`]+)`(?:\s*\nInput Mapping:\s*```json\s*([\s\S]*?)```)?(?:\s*\nOutput Mapping:\s*```json\s*([\s\S]*?)```)?/g);
      
      for (const match of stepMatches) {
        const [_, stepNumber, stepName, promptId, inputMappingStr, outputMappingStr] = match;
        
        const step: {
          promptId: string;
          stepName: string;
          inputMapping?: Record<string, string>;
          outputMapping?: Record<string, string>;
        } = {
          promptId: promptId.trim(),
          stepName: stepName.trim(),
        };
        
        if (inputMappingStr) {
          try {
            step.inputMapping = JSON.parse(inputMappingStr.trim());
          } catch (e) {
            log.warn(`Invalid input mapping JSON in chain step ${stepNumber} of ${filePath}`);
          }
        }
        
        if (outputMappingStr) {
          try {
            step.outputMapping = JSON.parse(outputMappingStr.trim());
          } catch (e) {
            log.warn(`Invalid output mapping JSON in chain step ${stepNumber} of ${filePath}`);
          }
        }
        
        chainSteps.push(step);
      }
      
      log.debug(`Loaded chain with ${chainSteps.length} steps from ${filePath}`);
    }
    
    if (!userMessageTemplate && !isChain) {
      throw new Error(`No user message template found in ${filePath}`);
    }
    
    return { systemMessage, userMessageTemplate, isChain, chainSteps };
  } catch (error) {
    log.error(`Error loading prompt file ${filePath}:`, error);
    throw error;
  }
}

// New function to convert markdown prompts to JSON structure in memory
async function convertMarkdownPromptsToJson(promptsData: PromptData[]): Promise<ConvertedPrompt[]> {
  const convertedPrompts: ConvertedPrompt[] = [];
  
  log.info(`Converting ${promptsData.length} markdown prompts to JSON structure...`);
  
  for (const promptData of promptsData) {
    try {
      // Load the prompt file content
      const promptFile = await loadPromptFile(promptData.file);
      
      // Create converted prompt structure
      const convertedPrompt: ConvertedPrompt = {
        id: promptData.id,
        name: promptData.name,
        description: promptData.description,
        category: promptData.category,
        systemMessage: promptFile.systemMessage,
        userMessageTemplate: promptFile.userMessageTemplate,
        arguments: promptData.arguments.map(arg => ({
          name: arg.name,
          description: arg.description,
          required: arg.required
        })),
        // Include chain information if this is a chain
        isChain: promptFile.isChain || false,
        chainSteps: promptFile.chainSteps || []
      };
      
      convertedPrompts.push(convertedPrompt);
    } catch (error) {
      log.error(`Error converting prompt ${promptData.id}:`, error);
      // Continue with other prompts even if one fails
    }
  }
  
  log.info(`Successfully converted ${convertedPrompts.length} prompts`);
  return convertedPrompts;
}

// Create MCP server
const server = new McpServer({
  name: config.server.name,
  version: config.server.version
});

// Create a simple conversation history tracker
const conversationHistory: Array<{
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isProcessedTemplate?: boolean; // Flag to indicate if this is a processed template rather than original user input
}> = [];

// Define maximum history size to prevent memory leaks
const MAX_HISTORY_SIZE = 100;

// Function to add items to conversation history with size management
function addToConversationHistory(item: {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isProcessedTemplate?: boolean;
}) {
  conversationHistory.push(item);
  
  // Trim history if it exceeds maximum size
  if (conversationHistory.length > MAX_HISTORY_SIZE) {
    // Remove oldest entries, keeping recent ones
    conversationHistory.splice(0, conversationHistory.length - MAX_HISTORY_SIZE);
    log.debug(`Trimmed conversation history to ${MAX_HISTORY_SIZE} entries to prevent memory leaks`);
  }
}

// Function to get the previous message from conversation history
function getPreviousMessage(): string {
  // Try to find the last user message in conversation history
  if (conversationHistory.length > 0) {
    // Start from the end and find the first non-template user message
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const historyItem = conversationHistory[i];
      // Only consider user messages that aren't processed templates
      if (historyItem.role === "user" && !historyItem.isProcessedTemplate) {
        log.debug(`Found previous user message for context: ${historyItem.content.substring(0, 50)}...`);
        return historyItem.content;
      }
    }
  }
  
  // Return a default prompt if no suitable history item is found
  return "[Please check previous messages in the conversation for context]";
}

// Custom error types for better error handling
class PromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptError';
  }
}

class ArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
  }
}

class ValidationError extends Error {
  validationErrors?: string[];
  
  constructor(message: string, validationErrors?: string[]) {
    super(message);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

class LlmServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmServiceError';
  }
}

// Standardized error handling
function handleError(error: unknown, context: string): { message: string; isError: boolean } {
  if (error instanceof PromptError) {
    log.error(`${context}: ${error.message}`);
    return { message: error.message, isError: true };
  } else if (error instanceof ArgumentError) {
    log.warn(`${context}: ${error.message}`);
    return { message: error.message, isError: false };
  } else if (error instanceof ValidationError) {
    log.warn(`${context}: ${error.message}`);
    const errors = error.validationErrors ? `: ${error.validationErrors.join(', ')}` : '';
    return { message: `${error.message}${errors}`, isError: false };
  } else if (error instanceof LlmServiceError) {
    log.error(`${context}: ${error.message}`);
    return { message: `Service error: ${error.message}`, isError: true };
  } else {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`${context}: ${errorMessage}`);
    return { message: `Unexpected error: ${errorMessage}`, isError: true };
  }
}

// Simulates calling the LLM service
// This is handled internally by the server - no external API calls
async function callLlmService(messages: Array<{
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}>): Promise<string> {
  try {
    log.debug(`Sending ${messages.length} messages to LLM service`);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      log.debug(`Last message: ${JSON.stringify(lastMessage.content)}`);
    }
    
    // Here we'd actually call an LLM service, but this is a simulated response
    // For demonstration, returning a simple response
    return "This is a simulated response from the LLM service. The actual implementation will handle LLM interactions internally.";
  } catch (error) {
    throw new LlmServiceError(`Failed to call LLM service: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Validate JSON arguments against the prompt's expected arguments
function validateJsonArguments(jsonArgs: any, prompt: PromptData): { valid: boolean; errors?: string[]; sanitizedArgs?: Record<string, any> } {
  const errors: string[] = [];
  const sanitizedArgs: Record<string, any> = {};
  
  // Check for unexpected properties
  const expectedArgNames = prompt.arguments.map(arg => arg.name);
  const providedArgNames = Object.keys(jsonArgs);
  
  for (const argName of providedArgNames) {
    if (!expectedArgNames.includes(argName)) {
      errors.push(`Unexpected argument: ${argName}`);
    }
  }
  
  // Check for and sanitize expected arguments
  for (const arg of prompt.arguments) {
    const value = jsonArgs[arg.name];
    
    // All arguments are treated as optional now
    if (value !== undefined) {
      // Sanitize the value based on expected type
      // This is a simple implementation - expand as needed for your use case
      if (typeof value === "string") {
        // Sanitize string inputs
        sanitizedArgs[arg.name] = value
          .replace(/[<>]/g, '') // Remove potentially dangerous HTML characters
          .trim();
      } else if (typeof value === "number") {
        // Ensure it's a valid number
        sanitizedArgs[arg.name] = isNaN(value) ? 0 : value;
      } else if (typeof value === "boolean") {
        sanitizedArgs[arg.name] = !!value; // Ensure boolean type
      } else if (Array.isArray(value)) {
        // For arrays, sanitize each element if they're strings
        sanitizedArgs[arg.name] = value.map(item => 
          typeof item === "string" ? item.replace(/[<>]/g, '').trim() : item
        );
      } else if (value !== null && typeof value === "object") {
        // For objects, convert to string for simplicity
        sanitizedArgs[arg.name] = JSON.stringify(value);
      } else {
        // For any other type, convert to string
        sanitizedArgs[arg.name] = String(value);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    sanitizedArgs
  };
}

// Helper function to process templates
function processTemplate(
  template: string, 
  args: Record<string, string>, 
  specialContext: Record<string, string> = {}
): string {
  let processed = template;
  
  // Process special context placeholders first
  Object.entries(specialContext).forEach(([key, value]) => {
    processed = processed.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, "g"),
      String(value)
    );
  });
  
  // Replace regular placeholders with argument values
  Object.entries(args).forEach(([key, value]) => {
    if (value !== undefined) {
      processed = processed.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        String(value)
      );
    }
  });
  
  return processed;
}

// Process the prompt with the parsed arguments and optional system message
async function runPromptDirectly(promptId: string, parsedArgs: Record<string, string>): Promise<string> {
  try {
    const convertedPrompt = convertedPrompts.find(cp => cp.id === promptId);
    if (!convertedPrompt) {
      throw new PromptError(`Could not find prompt with ID: ${promptId}`);
    }
    
    log.debug(`Running prompt directly: ${promptId} with arguments:`, parsedArgs);
    
    // Check for missing arguments but treat all as optional
    const missingArgs = convertedPrompt.arguments
      .filter(arg => !parsedArgs[arg.name])
      .map(arg => arg.name);
    
    if (missingArgs.length > 0) {
      log.info(`Missing arguments for '${promptId}': ${missingArgs.join(", ")}. Will attempt to use conversation context.`);
      
      // Use previous_message for all missing arguments
      missingArgs.forEach(argName => {
        parsedArgs[argName] = `{{previous_message}}`;
      });
    }
    
    // Create user message with placeholders replaced
    let userMessageText = convertedPrompt.userMessageTemplate;
    
    // Set up special context values
    const specialContext = {
      "previous_message": getPreviousMessage()
    };
    
    // Process the template to replace all placeholders
    userMessageText = processTemplate(userMessageText, parsedArgs, specialContext);
    
    // Add the message to conversation history
    addToConversationHistory({
      role: "user",
      content: userMessageText,
      timestamp: Date.now(),
      isProcessedTemplate: true
    });
    
    // Execute the LLM call
    const llmResponse = await callLlmService([{
      role: "user",
      content: {
        type: "text",
        text: userMessageText
      }
    }]);
    
    // Store the response in conversation history
    addToConversationHistory({
      role: "assistant",
      content: llmResponse,
      timestamp: Date.now()
    });
    
    return llmResponse;
  } catch (error) {
    const { message } = handleError(error, `Error executing prompt '${promptId}'`);
    return message;
  }
}

// Execute a chain of prompts
async function executePromptChain(
  chainPromptId: string, 
  inputArgs: Record<string, string> = {}
): Promise<{
  results: Record<string, string>;
  messages: { role: "user" | "assistant"; content: { type: "text"; text: string; }; }[];
}> {
  try {
    // Find the chain prompt
    const chainPrompt = convertedPrompts.find(cp => cp.id === chainPromptId);
    
    if (!chainPrompt) {
      throw new PromptError(`Could not find chain prompt with ID: ${chainPromptId}`);
    }
    
    // Validate that this is a chain prompt with steps
    if (!chainPrompt.isChain || !chainPrompt.chainSteps || chainPrompt.chainSteps.length === 0) {
      throw new ValidationError(`Prompt '${chainPromptId}' is not a valid chain or has no steps.`);
    }
    
    const totalSteps = chainPrompt.chainSteps.length;
    log.info(`Executing prompt chain: ${chainPrompt.name} (${chainPrompt.id}) with ${totalSteps} steps`);
    
    // Store results from each step that can be used as inputs for subsequent steps
    const results: Record<string, string> = { ...inputArgs };
    const messages: { role: "user" | "assistant"; content: { type: "text"; text: string; }; }[] = [];
    
    // Add chain start message to conversation history
    addToConversationHistory({
      role: "system" as any, // Type cast as any since the function expects "user" | "assistant"
      content: `Starting prompt chain: ${chainPrompt.name} (${totalSteps} steps)`,
      timestamp: Date.now()
    });
    
    // Execute each step in sequence
    for (let i = 0; i < chainPrompt.chainSteps.length; i++) {
      const step = chainPrompt.chainSteps[i];
      const currentStepNumber = i + 1;
      
      log.info(`Executing chain step ${currentStepNumber}/${totalSteps}: ${step.stepName} (${step.promptId})`);
      
      // Add step context to the results object so it can be used in templates
      results['current_step_number'] = String(currentStepNumber);
      results['total_steps'] = String(totalSteps);
      results['current_step_name'] = step.stepName;
      
      // Prepare arguments for this step based on input mappings
      const stepArgs: Record<string, string> = {};
      
      // Map inputs from results according to input mappings
      if (step.inputMapping) {
        for (const [stepInput, resultKey] of Object.entries(step.inputMapping)) {
          if (results[resultKey] !== undefined) {
            stepArgs[stepInput] = results[resultKey];
          } else {
            log.warn(`Missing input mapping for step '${step.stepName}': ${resultKey} -> ${stepInput}`);
          }
        }
      }
      
      // Add step context to the arguments
      stepArgs['step_number'] = String(currentStepNumber);
      stepArgs['total_steps'] = String(totalSteps);
      stepArgs['step_name'] = step.stepName;
      
      try {
        // Add step start message to conversation history
        addToConversationHistory({
          role: "system" as any, // Type cast as any since the function expects "user" | "assistant"
          content: `Executing chain step ${currentStepNumber}/${totalSteps}: ${step.stepName}`,
          timestamp: Date.now()
        });
        
        // Run the prompt for this step
        const stepResult = await runPromptDirectly(step.promptId, stepArgs);
        
        // Store the result
        if (step.outputMapping) {
          for (const [resultKey, stepOutput] of Object.entries(step.outputMapping)) {
            // For now, we only support mapping the entire output to a result key
            results[resultKey] = stepResult;
          }
        }
        
        // Add more detailed step messages to conversation history
        messages.push({
          role: "user",
          content: { 
            type: "text", 
            text: `[Chain Step ${currentStepNumber}/${totalSteps}: ${step.stepName} (${step.promptId})]` 
          }
        });
        
        messages.push({
          role: "assistant",
          content: { 
            type: "text", 
            text: stepResult 
          }
        });
        
        // Add step completion message to conversation history
        addToConversationHistory({
          role: "system" as any, // Type cast as any since the function expects "user" | "assistant"
          content: `Completed chain step ${currentStepNumber}/${totalSteps}: ${step.stepName}`,
          timestamp: Date.now()
        });
      } catch (stepError) {
        const { message, isError } = handleError(stepError, `Error executing chain step '${step.stepName}'`);
        
        // Add error message to the results
        results[`error_${step.promptId}`] = message;
        
        // Add error message to conversation history
        messages.push({
          role: "user",
          content: { 
            type: "text", 
            text: `[Chain Step ${currentStepNumber}/${totalSteps}: ${step.stepName} (${step.promptId})]` 
          }
        });
        
        messages.push({
          role: "assistant",
          content: { 
            type: "text", 
            text: message 
          }
        });
        
        // If this is a critical error, we may want to stop the chain execution
        if (isError) {
          throw new PromptError(`Chain execution stopped due to error in step ${currentStepNumber}/${totalSteps} '${step.stepName}': ${message}`);
        }
      }
    }
    
    // Add chain completion message to conversation history
    addToConversationHistory({
      role: "system" as any, // Type cast as any since the function expects "user" | "assistant"
      content: `Completed prompt chain: ${chainPrompt.name} (all ${totalSteps} steps)`,
      timestamp: Date.now()
    });
    
    log.info(`Chain execution completed successfully: ${chainPrompt.id}`);
    
    return {
      results,
      messages
    };
  } catch (error) {
    const { message } = handleError(error, `Error executing prompt chain '${chainPromptId}'`);
    
    return {
      results: { error: message },
      messages: [{
        role: "assistant",
        content: { 
          type: "text", 
          text: message 
        }
      }]
    };
  }
}

// Add global state for tracking current chain execution
// This needs to be added before the process_slash_command definition
// Add it right after the conversationHistory definition (around line ~370)

// Chain execution state tracking
interface ChainExecutionState {
  chainId: string;
  currentStepIndex: number;
  totalSteps: number;
  stepResults: Record<string, string>;
  startTime: number;
}

// Current active chain execution (only one at a time for simplicity)
let currentChainExecution: ChainExecutionState | null = null;

// Function to start a new chain execution
function startChainExecution(chainId: string, totalSteps: number, initialArgs: Record<string, string>): ChainExecutionState {
  const newExecution: ChainExecutionState = {
    chainId,
    currentStepIndex: 0, // 0-based index
    totalSteps,
    stepResults: { ...initialArgs },
    startTime: Date.now()
  };
  
  // Store as current execution
  currentChainExecution = newExecution;
  
  log.info(`Started new chain execution for chain '${chainId}' with ${totalSteps} steps`);
  return newExecution;
}

// Function to advance to the next step in the chain
function advanceChainExecution(stepOutput: string): ChainExecutionState | null {
  if (!currentChainExecution) {
    log.warn("Attempted to advance chain execution but no chain is currently active");
    return null;
  }
  
  // Store the output from the current step
  const stepIndex = currentChainExecution.currentStepIndex;
  currentChainExecution.stepResults[`step_${stepIndex}_output`] = stepOutput;
  
  // Move to the next step
  currentChainExecution.currentStepIndex++;
  
  // Check if we've completed all steps
  if (currentChainExecution.currentStepIndex >= currentChainExecution.totalSteps) {
    log.info(`Chain execution for '${currentChainExecution.chainId}' completed all ${currentChainExecution.totalSteps} steps`);
    
    // Reset current execution since we're done
    const completedExecution = currentChainExecution;
    currentChainExecution = null;
    
    return completedExecution;
  }
  
  log.info(`Advanced chain execution for '${currentChainExecution.chainId}' to step ${currentChainExecution.currentStepIndex + 1}/${currentChainExecution.totalSteps}`);
  return currentChainExecution;
}

// Function to clear the current chain execution (e.g., in case of errors)
function clearChainExecution(): void {
  if (currentChainExecution) {
    log.info(`Cleared chain execution for '${currentChainExecution.chainId}' after completing ${currentChainExecution.currentStepIndex}/${currentChainExecution.totalSteps} steps`);
    currentChainExecution = null;
  }
}

// Modify the process_slash_command tool to use the validation utility
server.tool(
  "process_slash_command",
  "Process slash commands that trigger prompt templates with optional arguments",
  {
    command: z.string().describe("The slash command to process, e.g., '/content_analysis Hello world'")
  },
  async ({ command }, extra) => {
    try {
      log.info(`Processing slash command: ${command}`);
      
      // Store original user input in conversation history
      addToConversationHistory({
        role: "user",
        content: command,
        timestamp: Date.now()
      });
      
      // Extract the command name and arguments
      // Format: /command_name argument_text
      const match = command.match(/^\/([a-zA-Z0-9_-]+)\s*(.*)/);
      
      if (!match) {
        throw new ValidationError("Invalid slash command format. Use /command_name [arguments]");
      }
      
      const [, commandName, commandArgs] = match;
      
      // Find the matching prompt
      const matchingPrompt = promptsData.find(
        prompt => prompt.id === commandName || prompt.name === commandName
      );
      
      if (!matchingPrompt) {
        throw new PromptError(`Unknown command: /${commandName}. Type /listprompts to see available commands.`);
      }
      
      // Parse arguments
      const promptArgValues: Record<string, string> = {};
      
      if (commandArgs) {
        if (matchingPrompt.arguments.length === 0) {
          log.warn(`Command '/${commandName}' doesn't accept arguments, but arguments were provided: ${commandArgs}`);
        } else if (matchingPrompt.arguments.length === 1 && 
                  (!commandArgs.trim().startsWith("{") || !commandArgs.trim().endsWith("}"))) {
          // Single argument, not in JSON format, assign directly
          promptArgValues[matchingPrompt.arguments[0].name] = commandArgs.trim();
        } else {
          // Try to parse as JSON if it looks like JSON
          try {
            if (commandArgs.trim().startsWith("{") && commandArgs.trim().endsWith("}")) {
              const parsedArgs = JSON.parse(commandArgs);
              
              // Validate the parsed JSON against expected arguments
              const validation = validateJsonArguments(parsedArgs, matchingPrompt);
              
              if (!validation.valid && validation.errors) {
                throw new ValidationError(`Invalid arguments for /${commandName}`, validation.errors);
              }
              
              // Use the sanitized arguments
              Object.assign(promptArgValues, validation.sanitizedArgs || {});
            } else if (matchingPrompt.arguments.length === 1) {
              // Single argument, but not in JSON format
              promptArgValues[matchingPrompt.arguments[0].name] = commandArgs;
            } else {
              // Provide guidance on correct format
              log.debug(`Multi-argument prompt requested (${matchingPrompt.arguments.length} args). Command arguments not in JSON format.`);
              throw new ArgumentError(`Invalid argument format for /${commandName}. Multiple arguments should be provided as JSON. Example: /${commandName} {"arg1": "value1", "arg2": "value2"}`);
            }
          } catch (e) {
            if (e instanceof ValidationError || e instanceof ArgumentError) {
              throw e;
            }
            log.debug("Error parsing JSON arguments:", e);
            // Still assign the first argument if there is content
            if (matchingPrompt.arguments.length > 0 && commandArgs) {
              promptArgValues[matchingPrompt.arguments[0].name] = commandArgs;
            }
          }
        }
      }
      
      log.debug("Prepared arguments for prompt:", promptArgValues);
      
      // Check for missing arguments but treat all as optional
      const missingArgs = matchingPrompt.arguments
        .filter(arg => !promptArgValues[arg.name])
        .map(arg => arg.name);
      
      if (missingArgs.length > 0) {
        // Log an info message rather than a warning
        log.info(`Missing arguments for '/${commandName}': ${missingArgs.join(", ")}. Will attempt to use conversation context.`);
        
        // Use previous_message for all missing arguments
        missingArgs.forEach(argName => {
          promptArgValues[argName] = `{{previous_message}}`;
        });
      }
      
      // Find the converted prompt with template data
      const convertedPrompt = convertedPrompts.find(cp => cp.id === matchingPrompt.id);
      
      if (!convertedPrompt) {
        throw new PromptError(`Could not find converted prompt data for ${matchingPrompt.id}`);
      }
      
      // Check if this is a chain prompt
      if (convertedPrompt.isChain && convertedPrompt.chainSteps && convertedPrompt.chainSteps.length > 0) {
        log.info(`Command '/${commandName}' is a chain prompt with ${convertedPrompt.chainSteps.length} steps. NOT automatically executing the chain.`);
        
        // No longer automatically execute the entire chain
        // Instead, we'll process this as a regular prompt
        // The LLM is expected to make separate calls for each step in the chain
        
        // Regular prompt processing continues below
      }
      
      // For all prompts, continue with the original processing
      // Create the prompt handler function similar to the one used for regular prompts
      const messages: { role: "user" | "assistant"; content: { type: "text"; text: string } }[] = [];
      
      // Create user message with placeholders replaced
      let userMessageText = convertedPrompt.userMessageTemplate;
      
      // If there's a system message, prepend it to the user message
      if (convertedPrompt.systemMessage) {
        userMessageText = `[System Info: ${convertedPrompt.systemMessage}]\n\n${userMessageText}`;
      }
      
      // Set up special context values
      const specialContext = {
        "previous_message": getPreviousMessage()
      };
      
      // Process the template to replace all placeholders
      userMessageText = processTemplate(userMessageText, promptArgValues, specialContext);
      
      // Store the processed message in history as a user message
      // This ensures that getPreviousMessage() can find it when needed for the {{previous_message}} placeholder
      addToConversationHistory({
        role: "user",  // Use "user" role to ensure it's findable by getPreviousMessage()
        content: userMessageText,
        timestamp: Date.now(),
        isProcessedTemplate: true  // Mark this as a processed template, not original user input
      });
      
      messages.push({
        role: "user",
        content: {
          type: "text",
          text: userMessageText
        }
      });
      
      // Return the processed message
      return { 
        content: [{ 
          type: "text", 
          text: userMessageText
        }]
      };
    } catch (error) {
      const { message, isError } = handleError(error, "Error processing slash command");
      return { 
        content: [{ 
          type: "text", 
          text: message
        }],
        isError
      };
    }
  }
);

// Add a listprompts tool to list available prompts
server.tool(
  "listprompts",
  "Displays a formatted list of all available commands and their usage",
  async () => {
    try {
      log.info("Executing listprompts command");
      
      // Create a formatted list of all available prompts
      let listpromptsText = "# Available Commands\n\n";
      
      // Group prompts by category
      const promptsByCategory: Record<string, ConvertedPrompt[]> = {};
      
      // Find the category names for better display
      const categoryMap: Record<string, string> = {};
      categories.forEach(cat => {
        categoryMap[cat.id] = cat.name;
        promptsByCategory[cat.id] = [];
      });
      
      // Group the prompts
      convertedPrompts.forEach(prompt => {
        if (!promptsByCategory[prompt.category]) {
          promptsByCategory[prompt.category] = [];
        }
        promptsByCategory[prompt.category].push(prompt);
      });
      
      // Add each category and its prompts to the listprompts text
      Object.entries(promptsByCategory).forEach(([categoryId, prompts]) => {
        if (prompts.length === 0) return;
        
        const categoryName = categoryMap[categoryId] || categoryId;
        listpromptsText += `## ${categoryName}\n\n`;
        
        // Add each prompt in this category
        prompts.forEach(prompt => {
          listpromptsText += `### /${prompt.id}\n`;
          if (prompt.name !== prompt.id) {
            listpromptsText += `*Alias: /${prompt.name}*\n\n`;
          } else {
            listpromptsText += "\n";
          }
          
          listpromptsText += `${prompt.description}\n\n`;
          
          // Add argument details if any
          if (prompt.arguments.length > 0) {
            listpromptsText += "**Arguments:**\n\n";
            
            prompt.arguments.forEach(arg => {
              // Always show arguments as optional since we're treating them that way
              listpromptsText += `- \`${arg.name}\` (optional): ${arg.description || 'No description'}\n`;
            });
            
            // Add usage examples based on number of arguments
            listpromptsText += "\n**Usage:**\n\n";
            
            if (prompt.arguments.length === 1) {
              const argName = prompt.arguments[0].name;
              listpromptsText += `\`/${prompt.id} your ${argName} here\`\n\n`;
            } else if (prompt.arguments.length > 1) {
              // For multiple arguments, show JSON format
              const exampleArgs: Record<string, string> = {};
              prompt.arguments.forEach(arg => {
                exampleArgs[arg.name] = `<your ${arg.name} here>`;
              });
              
              listpromptsText += `\`/${prompt.id} ${JSON.stringify(exampleArgs)}\`\n\n`;
            }
          }
        });
      });
      
      // Add special commands section
      listpromptsText += "## Special Commands\n\n";
      listpromptsText += "### /listprompts\n\n";
      listpromptsText += "Displays this listprompts message listing all available commands and their usage.\n\n";
      
      return {
        content: [{ type: "text", text: listpromptsText }]
      };
    } catch (error) {
      log.error("Error executing listprompts command:", error);
      return {
        content: [{ 
          type: "text", 
          text: `Error displaying listprompts: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Convert markdown prompts to JSON structure
const convertedPrompts = await convertMarkdownPromptsToJson(promptsData);

// Set a default registration mode if not specified in config
const registrationMode = config.prompts.registrationMode || "both";
log.info(`Using prompt registration mode: ${registrationMode}`);

// Register each prompt from the converted JSON structures
for (const promptData of convertedPrompts) {
  try {
    // Create a schema for the prompt arguments - treat all as optional
    const argsSchema: Record<string, z.ZodType> = {};
    promptData.arguments.forEach(arg => {
      // All arguments are treated as optional strings regardless of required flag
      argsSchema[arg.name] = z.string().optional();
    });

    // Create prompt handler function
    const promptHandler = async (args: any) => {
      try {
        log.debug(`Executing prompt '${promptData.name}' with args:`, args);
        
        // Check for missing arguments but treat all as optional
        const missingArgs = promptData.arguments
          .filter(arg => (args[arg.name] === undefined || args[arg.name] === null))
          .map(arg => arg.name);
          
        if (missingArgs.length > 0) {
          log.info(`Missing arguments for prompt '${promptData.name}': ${missingArgs.join(", ")}. Will attempt to use conversation context.`);
          
          // For each missing argument, set it to use the previous message
          missingArgs.forEach(argName => {
            args[argName] = `{{previous_message}}`;
          });
        }
        
        // Check if this is a chain prompt
        if (promptData.isChain && promptData.chainSteps && promptData.chainSteps.length > 0) {
          log.info(`Prompt '${promptData.name}' is a chain with ${promptData.chainSteps.length} steps. NOT automatically executing the chain.`);
          
          // No longer automatically execute the entire chain
          // Instead, we'll process this as a regular prompt
          // The LLM is expected to make separate calls for each step in the chain
          
          // Regular prompt processing continues below
        }
        
        // Regular (non-chain) prompt processing continues below
        // Create messages array with only user and assistant roles
        // System messages will be converted to user messages
        const messages: { role: "user" | "assistant"; content: { type: "text"; text: string } }[] = [];
        
        // Create user message with placeholders replaced
        let userMessageText = promptData.userMessageTemplate;
        
        // If there's a system message, prepend it to the user message
        if (promptData.systemMessage) {
          userMessageText = `[System Info: ${promptData.systemMessage}]\n\n${userMessageText}`;
        }
        
        // Process special context placeholders first
        const specialPlaceholders = {
          "previous_message": getPreviousMessage()
        };
        
        // Replace special placeholders
        Object.entries(specialPlaceholders).forEach(([key, value]) => {
          userMessageText = userMessageText.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "g"),
            String(value)
          );
        });
        
        // Replace argument placeholders
        Object.entries(args).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const replaced = userMessageText.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, "g"),
              String(value)
            );
            if (replaced === userMessageText) {
              log.warn(`Placeholder for argument '${key}' not found in template for prompt '${promptData.name}'`);
            }
            userMessageText = replaced;
          }
        });
        
        // Store in conversation history for future reference
        addToConversationHistory({
          role: "user",
          content: userMessageText,
          timestamp: Date.now(),
          isProcessedTemplate: true  // Mark as a processed template, not original user input
        });
        
        // Push the user message to the messages array
        messages.push({
          role: "user",
          content: {
            type: "text",
            text: userMessageText
          }
        });
        
        log.debug(`Processed messages for prompt '${promptData.name}':`, messages);
        return { messages };
      } catch (error) {
        log.error(`Error executing prompt '${promptData.name}':`, error);
        throw error; // Re-throw to let the MCP framework handle it
      }
    };

    // Register the prompt based on the configuration mode
    if (registrationMode === "id" || registrationMode === "both") {
      server.prompt(promptData.id, argsSchema, promptHandler);
      log.info(`Registered prompt with ID: ${promptData.id}`);
    }
    
    if ((registrationMode === "name" || registrationMode === "both") && promptData.name !== promptData.id) {
      try {
        server.prompt(promptData.name, argsSchema, promptHandler);
        log.info(`Registered prompt with display name: ${promptData.name}`);
      } catch (error) {
        log.debug(`Could not register display name, might conflict with another identifier: ${promptData.name}`);
      }
    }
  } catch (error) {
    log.error(`Error registering prompt ${promptData.id}:`, error);
  }
}

// Start the server with the appropriate transport
if (transport === "stdio") {
  // Use STDIO transport
  log.info("Starting server with STDIO transport");
  
  // Create and configure the STDIO transport
  const stdioTransport = new StdioServerTransport();
  
  // Ensure we don't mix log messages with JSON messages
  // Redirect console.log/error for the rest of the process
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  console.log = (...args) => {
    logToFile('CONSOLE', args.join(' '));
  };
  
  console.error = (...args) => {
    logToFile('CONSOLE_ERROR', args.join(' '));
  };
  
  // Log when the stdin closes (which happens when the parent process terminates)
  process.stdin.on('end', () => {
    logToFile('INFO', 'STDIN stream ended - parent process may have terminated');
    process.exit(0);
  });
  
  // Connect the server to the transport
  try {
    await server.connect(stdioTransport);
    logToFile('INFO', "STDIO transport connected successfully");
  } catch (error) {
    logToFile('ERROR', "Error connecting to STDIO transport:", error);
    process.exit(1);
  }
} else {
  // Use SSE transport with Express
  const app = express();
  const sseTransports = new Map<string, SSEServerTransport>();
  
  // Enable CORS for Cursor integration
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Add JSON body parser middleware
  app.use(express.json());
  
  // Add request logging middleware
  app.use((req, res, next) => {
    log.debug(`${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);
    next();
  });
  
  app.get("/", (_req: Request, res: Response) => {
    res.send("Claude Custom Prompts MCP Server - Use /mcp endpoint for MCP connections");
  });
  
  // Add a simple health check endpoint for Cursor
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", version: config.server.version });
  });
  
  app.get("/mcp", async (req: Request, res: Response) => {
    log.info("New SSE connection from " + req.ip);
    
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // listpromptss with certain proxies
    
    // Create a unique ID for this connection
    const connectionId = Date.now().toString();
    
    // Create a new transport for this connection
    const sseTransport = new SSEServerTransport("/messages", res);
    sseTransports.set(connectionId, sseTransport);
    
    // Log connection data for debugging
    log.debug("Connection headers:", req.headers);
    
    // Remove the transport when the connection is closed
    res.on("close", () => {
      log.info(`SSE connection ${connectionId} closed`);
      sseTransports.delete(connectionId);
    });
    
    try {
      await server.connect(sseTransport);
      log.info(`SSE transport ${connectionId} connected successfully`);
    } catch (error) {
      log.error("Error connecting to SSE transport:", error);
      sseTransports.delete(connectionId);
      res.status(500).end();
    }
  });
  
  app.post("/messages", express.json(), async (req: Request, res: Response) => {
    log.debug("Received message:", req.body);
    
    try {
      // Try to handle the request with each transport
      const transports = Array.from(sseTransports.values());
      
      if (transports.length === 0) {
        log.error("No active SSE connections found");
        return res.status(503).json({ error: "No active SSE connections" });
      }
      
      let handled = false;
      let lastError = null;
      
      for (const transport of transports) {
        try {
          // Use any available method to process the request
          // This is a workaround for TypeScript errors
          const sseTransport = transport as any;
          
          if (typeof sseTransport.handleRequest === 'function') {
            log.debug("Using handleRequest method");
            handled = await sseTransport.handleRequest(req, res);
          } else if (typeof sseTransport.processRequest === 'function') {
            log.debug("Using processRequest method");
            handled = await sseTransport.processRequest(req, res);
          }
          
          if (handled) {
            log.debug("Request handled successfully");
            break;
          }
        } catch (e) {
          lastError = e;
          log.error("Error processing request with transport:", e);
        }
      }
      
      if (!handled) {
        log.error("No transport handled the request");
        if (lastError) {
          log.error("Last error:", lastError);
        }
        res.status(404).json({ error: "No matching transport found" });
      }
    } catch (error) {
      log.error("Error handling message:", error);
      res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Add endpoint to get categories and prompts
  app.get("/prompts", (_req: Request, res: Response) => {
    const result = {
      categories,
      prompts: promptsData.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        category: prompt.category,
        description: prompt.description,
        arguments: prompt.arguments
      }))
    };
    res.json(result);
  });
  
  // Add endpoint to get prompts by category
  app.get("/categories/:categoryId/prompts", (req: Request, res: Response) => {
    const categoryId = req.params.categoryId;
    const categoryPrompts = promptsData.filter(prompt => prompt.category === categoryId);
    
    if (categoryPrompts.length === 0) {
      return res.status(404).json({ error: `No prompts found for category: ${categoryId}` });
    }
    
    res.json(categoryPrompts);
  });
  
  // Create server and handle errors
  const httpServer = app.listen(PORT, () => {
    log.info(`MCP Prompts Server running on http://localhost:${PORT}`);
    log.info(`Connect to http://localhost:${PORT}/mcp for MCP connections`);
  });
  
  httpServer.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      log.error(`Port ${PORT} is already in use. Please choose a different port or stop the other service.`);
    } else {
      log.error('Server error:', error);
    }
    process.exit(1);
  });
}

// Log system info for potential debugging
log.info(`Server process memory usage: ${JSON.stringify(process.memoryUsage())}`);

// Handle graceful shutdown
process.on("SIGINT", () => {
  log.info("Shutting down server...");
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
