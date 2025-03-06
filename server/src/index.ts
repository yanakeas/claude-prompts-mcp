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
import { 
  PromptError, 
  ArgumentError, 
  ValidationError, 
  handleError as utilsHandleError 
} from './utils/errorHandling.js';
import {
  validateJsonArguments,
  processTemplate as originalProcessTemplate
} from './utils/jsonUtils.js';
import * as fs from "fs/promises";

// Text Reference System
interface TextReference {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  lastUsed: number;
}

interface TextReferenceStore {
  references: TextReference[];
  maxAge: number; // Maximum age in milliseconds before cleanup
  maxSize: number; // Maximum number of references to store
}

// Initialize text reference storage
const textReferenceStore: TextReferenceStore = {
  references: [],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 1000 // Store up to 1000 references
};

// Function to generate a title for a text using Claude
async function generateTextTitle(text: string): Promise<string> {
  try {
    const titlePrompt = {
      id: "generate_title",
      name: "Generate Title",
      category: "system",
      description: "Generate a concise, descriptive title for a text",
      systemMessage: "Generate a concise, descriptive title (max 50 characters) that captures the essence of the provided text.",
      userMessageTemplate: "Text to generate title for:\n\n{{text}}",
      arguments: [{ name: "text", description: "Text to generate title for", required: true }]
    };

    const result = await runPromptDirectly(titlePrompt.id, { text });
    return result.trim();
  } catch (error) {
    log.error("Error generating title:", error);
    return `Text_${Date.now()}`;
  }
}

// Function to store a text reference
async function storeTextReference(text: string): Promise<string> {
  try {
    const title = await generateTextTitle(text);
    const id = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const reference: TextReference = {
      id,
      title,
      content: text,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    textReferenceStore.references.push(reference);
    
    // Clean up old references if we exceed maxSize
    if (textReferenceStore.references.length > textReferenceStore.maxSize) {
      cleanupOldReferences();
    }

    return `{{ref:${id}}}`;
  } catch (error) {
    log.error("Error storing text reference:", error);
    throw new Error(`Failed to store text reference: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to retrieve a text reference
function getTextReference(refId: string): string | null {
  const reference = textReferenceStore.references.find(ref => ref.id === refId);
  if (reference) {
    reference.lastUsed = Date.now();
    return reference.content;
  }
  return null;
}

// Function to clean up old references
function cleanupOldReferences() {
  const now = Date.now();
  textReferenceStore.references = textReferenceStore.references
    .filter(ref => (now - ref.lastUsed) < textReferenceStore.maxAge)
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, textReferenceStore.maxSize);
}

// Function to list available references
function listTextReferences(): Array<{ id: string; title: string; createdAt: number }> {
  return textReferenceStore.references.map(ref => ({
    id: ref.id,
    title: ref.title,
    createdAt: ref.createdAt
  }));
}

// Text reference system functions
async function processTemplateAsync(template: string, args: Record<string, string>, specialContext: Record<string, string> = {}): Promise<string> {
  // First, store any long text arguments as references
  const processedArgs = { ...args };
  for (const [key, value] of Object.entries(processedArgs)) {
    if (value && value.length > 500) { // Store texts longer than 500 characters as references
      processedArgs[key] = await storeTextReference(value);
    }
  }

  // Process the template with the modified arguments
  let processedTemplate = originalProcessTemplate(template, processedArgs, specialContext);

  // Replace any reference placeholders with their content
  processedTemplate = processedTemplate.replace(/{{ref:([^}]+)}}/g, (match, refId) => {
    const content = getTextReference(refId);
    return content || match; // Keep the reference placeholder if content not found
  });

  return processedTemplate;
}

// Synchronous version that doesn't handle long text references
function processTemplate(template: string, args: Record<string, string>, specialContext: Record<string, string> = {}): string {
  // Process the template with the arguments directly
  let processedTemplate = originalProcessTemplate(template, args, specialContext);

  // Replace any reference placeholders with their content
  processedTemplate = processedTemplate.replace(/{{ref:([^}]+)}}/g, (match, refId) => {
    const content = getTextReference(refId);
    return content || match; // Keep the reference placeholder if content not found
  });

  return processedTemplate;
}

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
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : config.server.port;

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
      // Updated regex to match the current markdown format
      const stepMatches = chainContent.matchAll(/(\d+)\.\s*promptId:\s*([^\n]+)\s*\n\s*stepName:\s*([^\n]+)(?:\s*\n\s*inputMapping:\s*([\s\S]*?)(?=\s*\n\s*(?:outputMapping|promptId|\d+\.|$)))?\s*(?:\n\s*outputMapping:\s*([\s\S]*?)(?=\s*\n\s*(?:promptId|\d+\.|$)))?\s*/g);
      
      for (const match of stepMatches) {
        const [_, stepNumber, promptId, stepName, inputMappingStr, outputMappingStr] = match;
        
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
            // Parse YAML-style mapping into JSON object
            const inputMapping: Record<string, string> = {};
            const lines = inputMappingStr.trim().split('\n');
            for (const line of lines) {
              const [key, value] = line.trim().split(':').map(s => s.trim());
              if (key && value) {
                inputMapping[key] = value;
              }
            }
            step.inputMapping = inputMapping;
          } catch (e) {
            log.warn(`Invalid input mapping in chain step ${stepNumber} of ${filePath}: ${e}`);
          }
        }
        
        if (outputMappingStr) {
          try {
            // Parse YAML-style mapping into JSON object
            const outputMapping: Record<string, string> = {};
            const lines = outputMappingStr.trim().split('\n');
            for (const line of lines) {
              const [key, value] = line.trim().split(':').map(s => s.trim());
              if (key && value) {
                outputMapping[key] = value;
              }
            }
            step.outputMapping = outputMapping;
          } catch (e) {
            log.warn(`Invalid output mapping in chain step ${stepNumber} of ${filePath}: ${e}`);
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

// Standardized error handling
function handleError(error: unknown, context: string): { message: string; isError: boolean } {
  return utilsHandleError(error, context, log);
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
    userMessageText = await processTemplateAsync(userMessageText, parsedArgs, specialContext);
    
    // Add the message to conversation history
    addToConversationHistory({
      role: "user",
      content: userMessageText,
      timestamp: Date.now(),
      isProcessedTemplate: true
    });
    
    // Generate a response (echo in this MCP implementation)
    const response = `Processed prompt: ${promptId}\nWith message: ${userMessageText}`;
    
    // Store the response in conversation history
    addToConversationHistory({
      role: "assistant",
      content: response,
      timestamp: Date.now()
    });
    
    return response;
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



// Modify the process_slash_command tool to use the validation utility
server.tool(
  "process_slash_command",
  "Process commands that trigger prompt templates with optional arguments",
  {
    command: z.string().describe("The command to process, e.g., '>>content_analysis Hello world' or '/content_analysis Hello world'")
  },
  async ({ command }, extra) => {
    try {
      log.info(`Processing command: ${command}`);
      
      // Store original user input in conversation history
      addToConversationHistory({
        role: "user",
        content: command,
        timestamp: Date.now()
      });
      
      // Extract the command name and arguments
      // Format: >>command_name argument_text or /command_name argument_text
      // The new preferred format is >> but we still support / for backward compatibility
      const match = command.match(/^(>>|\/)([a-zA-Z0-9_-]+)\s*(.*)/);
      
      if (!match) {
        throw new ValidationError("Invalid command format. Use >>command_name [arguments] or /command_name [arguments]");
      }
      
      const [, prefix, commandName, commandArgs] = match;
      
      // Find the matching prompt
      const matchingPrompt = promptsData.find(
        prompt => prompt.id === commandName || prompt.name === commandName
      );
      
      if (!matchingPrompt) {
        throw new PromptError(`Unknown command: ${prefix}${commandName}. Type >>listprompts to see available commands.`);
      }
      
      // Parse arguments
      const promptArgValues: Record<string, string> = {};
      
      if (commandArgs) {
        if (matchingPrompt.arguments.length === 0) {
          log.warn(`Command '${prefix}${commandName}' doesn't accept arguments, but arguments were provided: ${commandArgs}`);
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
                // Instead of throwing an error, log it and use previous_message
                log.warn(`Invalid arguments for ${prefix}${commandName}: ${validation.errors.join(', ')}. Using previous message instead.`);
                // Use previous_message for all arguments
                matchingPrompt.arguments.forEach(arg => {
                  promptArgValues[arg.name] = `{{previous_message}}`;
                });
              } else {
                // Use the sanitized arguments
                Object.assign(promptArgValues, validation.sanitizedArgs || {});
              }
            } else if (matchingPrompt.arguments.length === 1) {
              // Single argument, but not in JSON format
              promptArgValues[matchingPrompt.arguments[0].name] = commandArgs;
            } else {
              // Instead of throwing an error for multi-argument prompts with incorrect format,
              // log a warning and use previous_message for all arguments
              log.warn(`Multi-argument prompt requested (${matchingPrompt.arguments.length} args). Command arguments not in JSON format. Using previous message instead.`);
              matchingPrompt.arguments.forEach(arg => {
                promptArgValues[arg.name] = `{{previous_message}}`;
              });
            }
          } catch (e) {
            if (e instanceof ValidationError || e instanceof ArgumentError) {
              // Instead of re-throwing, log the error and use previous_message
              log.warn(`Error with arguments for ${prefix}${commandName}: ${e.message}. Using previous message instead.`);
              matchingPrompt.arguments.forEach(arg => {
                promptArgValues[arg.name] = `{{previous_message}}`;
              });
            } else {
              log.debug("Error parsing JSON arguments:", e);
              // For other errors, use previous_message for all arguments
              matchingPrompt.arguments.forEach(arg => {
                promptArgValues[arg.name] = `{{previous_message}}`;
              });
            }
          }
        }
      }
      
      log.debug("Prepared arguments for prompt:", promptArgValues);
      
      // Ensure all defined arguments have values (using previous_message as fallback)
      matchingPrompt.arguments.forEach(arg => {
        if (!promptArgValues[arg.name]) {
          promptArgValues[arg.name] = `{{previous_message}}`;
        }
      });
      
      // Find the converted prompt with template data
      const convertedPrompt = convertedPrompts.find(cp => cp.id === matchingPrompt.id);
      
      if (!convertedPrompt) {
        throw new PromptError(`Could not find converted prompt data for ${matchingPrompt.id}`);
      }
      
      // Check if this is a chain prompt
      if (convertedPrompt.isChain && convertedPrompt.chainSteps && convertedPrompt.chainSteps.length > 0) {
        log.info(`Command '${prefix}${commandName}' is a chain prompt with ${convertedPrompt.chainSteps.length} steps. NOT automatically executing the chain.`);
        
        // No longer automatically execute the entire chain
        // Instead, we'll process this as a regular prompt
        
        // Regular prompt processing continues below
      }
      
      // If this is a chain prompt, we need to handle it differently
      if (convertedPrompt.isChain) {
        // For chain prompts, we'll return a message that explains the chain and its steps
        const chainSteps = convertedPrompt.chainSteps || [];
        
        // Create a message that explains the chain and its steps
        const chainExplanation = [
          `This is a prompt chain: ${convertedPrompt.name} (${convertedPrompt.id})`,
          `It consists of ${chainSteps.length} steps that should be executed in sequence:`,
          ...chainSteps.map((step: any, index: number) => 
            `${index + 1}. ${step.stepName} (${step.promptId})`
          ),
          `\nTo execute this chain, run each step in sequence using the '>>' or '/' command syntax:`,
          ...chainSteps.map((step: any, index: number) => 
            `${index + 1}. >>${step.promptId} [with appropriate arguments]`
          ),
          `\nEach step will use outputs from previous steps as inputs for the next step.`
        ].join('\n');
        
        return { 
          content: [{ 
            type: "text", 
            text: chainExplanation
          }]
        };
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
      userMessageText = await processTemplateAsync(userMessageText, promptArgValues, specialContext);
      
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
      const { message, isError } = handleError(error, "Error processing command");
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

// Register the listprompts tool
server.tool(
  "listprompts",
  {
    command: z.string().optional().describe("Optional filter text to show only matching commands")
  },
  async ({ command }, extra) => {
    try {
      // Check if the command is actually a listprompts command
      const match = command ? command.match(/^(>>|\/)listprompts\s*(.*)/) : null;
      const filterText = match ? match[2].trim() : '';
      
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
      
      // Special commands
      listpromptsText += "## Special Commands\n\n";
      
      // Add the listprompts command itself
      listpromptsText += "### >>listprompts\n\n";
      listpromptsText += "Lists all available commands and their usage.\n\n";
      listpromptsText += "**Usage:** `>>listprompts` or `/listprompts`\n\n";
      
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

// Register the update_prompt tool
server.tool(
  "update_prompt",
  {
    id: z.string().describe("Unique identifier for the prompt"),
    name: z.string().describe("Display name for the prompt"),
    category: z.string().describe("Category this prompt belongs to"),
    description: z.string().describe("Description of the prompt"),
    systemMessage: z.string().optional().describe("Optional system message for the prompt"),
    userMessageTemplate: z.string().describe("Template for generating the user message"),
    arguments: z.array(
      z.object({
        name: z.string().describe("Name of the argument"),
        description: z.string().optional().describe("Optional description of the argument"),
        required: z.boolean().describe("Whether this argument is required")
      })
    ).describe("Arguments accepted by this prompt"),
    isChain: z.boolean().optional().describe("Whether this prompt is a chain of prompts"),
    chainSteps: z.array(
      z.object({
        promptId: z.string().describe("ID of the prompt to execute in this step"),
        stepName: z.string().describe("Name of this step"),
        inputMapping: z.record(z.string()).optional().describe("Maps chain inputs to this step's inputs"),
        outputMapping: z.record(z.string()).optional().describe("Maps this step's outputs to chain outputs")
      })
    ).optional().describe("Steps in the chain if this is a chain prompt")
  },
  async (args, extra) => {
    try {
      log.info(`Updating prompt: ${args.id}`);
      
      // Read the current prompts.json file
      const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
      const fileContent = await readFile(PROMPTS_FILE, "utf8");
      const promptsFile = JSON.parse(fileContent) as PromptsFile;
      
      // Check if the category exists
      const categoryExists = promptsFile.categories.some(cat => cat.id === args.category);
      if (!categoryExists) {
        return {
          content: [
            {
              type: "text",
              text: `Category '${args.category}' does not exist. Please create the category first or use an existing category.`
            }
          ],
          isError: true
        };
      }
      
      // Check if the prompt already exists
      const existingPromptIndex = promptsFile.prompts.findIndex(p => p.id === args.id);
      const promptExists = existingPromptIndex !== -1;
      
      // Determine the file path for the prompt
      const promptFilePath = `prompts/${args.category}/${args.id}.md`;
      const fullPromptFilePath = path.join(__dirname, "..", promptFilePath);
      
      // Create the prompt directory if it doesn't exist
      const promptDirPath = path.join(__dirname, "..", "prompts", args.category);
      try {
        await fs.mkdir(promptDirPath, { recursive: true });
      } catch (error) {
        log.error(`Error creating directory ${promptDirPath}:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to create directory for category '${args.category}'.`
            }
          ],
          isError: true
        };
      }
      
      // Create the prompt file content
      let promptFileContent = `# ${args.name}\n\n`;
      promptFileContent += `## Description\n${args.description}\n\n`;
      
      if (args.systemMessage) {
        promptFileContent += `## System Message\n${args.systemMessage}\n\n`;
      }
      
      promptFileContent += `## User Message Template\n${args.userMessageTemplate}\n`;
      
      // Add chain steps if this is a chain prompt
      if (args.isChain && args.chainSteps && args.chainSteps.length > 0) {
        promptFileContent += `\n## Chain Steps\n\n`;
        
        const totalSteps = args.chainSteps.length;
        args.chainSteps.forEach((step: any, index: number) => {
          promptFileContent += `${index + 1}. promptId: ${step.promptId}\n`;
          promptFileContent += `   stepName: ${step.stepName} (Step ${index + 1} of ${totalSteps})\n`;
          
          if (step.inputMapping) {
            promptFileContent += `   inputMapping:\n`;
            for (const [key, value] of Object.entries(step.inputMapping)) {
              promptFileContent += `     ${key}: ${value}\n`;
            }
          }
          
          if (step.outputMapping) {
            promptFileContent += `   outputMapping:\n`;
            for (const [key, value] of Object.entries(step.outputMapping)) {
              promptFileContent += `     ${key}: ${value}\n`;
            }
          }
          
          promptFileContent += `\n`;
        });
        
        // Add Output Format section for chain prompts
        promptFileContent += `## Output Format\n\n`;
        promptFileContent += `After completing all ${totalSteps} steps in the chain, you will have a final output that:\n\n`;
        promptFileContent += `1. Is well-organized and clearly structured\n`;
        promptFileContent += `2. Represents the culmination of the entire chain process\n\n`;
        promptFileContent += `The final output will be the result of the last step in the chain.\n`;
      }
      
      // Write the prompt file
      try {
        await writeFile(fullPromptFilePath, promptFileContent, "utf8");
        log.info(`Created prompt file: ${fullPromptFilePath}`);
      } catch (error) {
        log.error(`Error writing prompt file ${fullPromptFilePath}:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to create prompt file.`
            }
          ],
          isError: true
        };
      }
      
      // Create or update the prompt entry in prompts.json
      const promptEntry: PromptData = {
        id: args.id,
        name: args.name,
        category: args.category,
        description: args.description,
        file: promptFilePath,
        arguments: args.arguments
      };
      
      if (promptExists) {
        // Update existing prompt
        promptsFile.prompts[existingPromptIndex] = promptEntry;
      } else {
        // Add new prompt
        promptsFile.prompts.push(promptEntry);
      }
      
      // Write the updated prompts.json file
      try {
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        log.info(`Updated prompts.json with prompt: ${args.id}`);
        
        // Reload prompts using the new function
        try {
          const result = await reloadPrompts();
          // Replace the global convertedPrompts array with the new values
          convertedPrompts.length = 0;
          result.convertedPrompts.forEach(prompt => convertedPrompts.push(prompt));
          log.info(`Reloaded prompts after updating prompt: ${args.id}`);
        } catch (reloadError) {
          log.error(`Error reloading prompts after updating prompt: ${args.id}`, reloadError);
          // Continue even if reload fails
        }
      } catch (error) {
        log.error(`Error writing prompts.json:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to update prompts.json file.`
            }
          ],
          isError: true
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully ${promptExists ? 'updated' : 'created'} prompt: ${args.id}\nPrompt file created at: ${promptFilePath}`
          }
        ]
      };
    } catch (error) {
      log.error(`Error updating prompt:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to update prompt: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Register the delete_prompt tool
server.tool(
  "delete_prompt",
  {
    id: z.string().describe("Unique identifier for the prompt to delete"),
  },
  async (args, extra) => {
    try {
      log.info(`Deleting prompt: ${args.id}`);
      
      // Read the current prompts.json file
      const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
      const fileContent = await readFile(PROMPTS_FILE, "utf8");
      const promptsFile = JSON.parse(fileContent) as PromptsFile;
      
      // Extract the id from the request body
      const { id } = args;
      
      // Find the prompt to delete
      const promptIndex = promptsFile.prompts.findIndex(p => p.id === id);
      
      if (promptIndex === -1) {
        return {
          content: [
            {
              type: "text",
              text: `Prompt with ID '${id}' not found`
            }
          ],
          isError: true
        };
      }
      
      // Get the prompt data before removing it
      const promptToDelete = promptsFile.prompts[promptIndex];
      
      // Remove the prompt from the array
      promptsFile.prompts.splice(promptIndex, 1);
      
      // Write the updated prompts.json file
      await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
      
      // Delete the prompt file if it exists
      try {
        const promptFilePath = path.join(__dirname, "..", promptToDelete.file);
        await fs.unlink(promptFilePath);
        log.info(`Deleted prompt file: ${promptFilePath}`);
      } catch (fileError) {
        log.warn(`Could not delete prompt file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        // Continue even if file deletion fails
      }
      
      // Reload prompts and categories
      try {
        const result = await reloadPrompts();
        log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after deleting prompt: ${id}`);
      } catch (error) {
        log.error("Error reloading prompts data:", error);
        // Continue even if reload fails
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Prompt '${promptToDelete.name}' (ID: ${id}) deleted successfully`
          }
        ]
      };
    } catch (error) {
      log.error("Error deleting prompt:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to delete prompt: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Register the modify_prompt_section tool
server.tool(
  "modify_prompt_section",
  {
    id: z.string().describe("Unique identifier of the prompt to modify"),
    section_name: z.string().describe("Name of the section to modify (valid values: 'title', 'description', 'System Message', 'User Message Template', or any custom section)"),
    new_content: z.string().describe("New content for the specified section")
  },
  async (args: { id: string; section_name: string; new_content: string }) => {
    try {
      log.info(`Attempting to modify section '${args.section_name}' of prompt '${args.id}'`);
      
      // Read the current prompts.json file
      const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
      const fileContent = await readFile(PROMPTS_FILE, "utf8");
      const promptsFile = JSON.parse(fileContent) as PromptsFile;
      
      // Find the prompt
      const promptIndex = promptsFile.prompts.findIndex(p => p.id === args.id);
      if (promptIndex === -1) {
        log.error(`Prompt with ID '${args.id}' not found`);
        return {
          content: [
            {
              type: "text",
              text: `Prompt with ID '${args.id}' not found`
            }
          ],
          isError: true
        };
      }
      
      const prompt = promptsFile.prompts[promptIndex];
      
      // Read the prompt file
      const promptFilePath = path.join(__dirname, "..", prompt.file);
      let promptContent: string;
      try {
        promptContent = await readFile(promptFilePath, "utf8");
      } catch (error) {
        log.error(`Error reading prompt file ${promptFilePath}:`, error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to read prompt file: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
      
      // Parse the prompt sections
      const sections: Record<string, string> = {};
      
      // Extract the title (first # heading)
      const titleMatch = promptContent.match(/^# (.+?)(?=\n\n|\n##)/s);
      if (titleMatch) {
        sections.title = titleMatch[1].trim();
        
        // Extract description (content between title and first ## heading)
        const descMatch = promptContent.match(/^# .+?\n\n([\s\S]+?)(?=\n## )/s);
        if (descMatch) {
          sections.description = descMatch[1].trim();
        } else {
          sections.description = '';
        }
      }
      
      // Extract other sections (## headings)
      const sectionMatches = Array.from(promptContent.matchAll(/## ([^\n]+)\n\n([\s\S]+?)(?=\n## |\n# |\n$)/g));
      for (const match of sectionMatches) {
        const sectionName = match[1].trim();
        const sectionContent = match[2].trim();
        sections[sectionName] = sectionContent;
      }
      
      // Check if the section exists
      const normalizedSectionName = args.section_name === 'title' ? 'title' : 
                                   args.section_name === 'description' ? 'description' : 
                                   args.section_name === 'System Message' ? 'System Message' :
                                   args.section_name === 'User Message Template' ? 'User Message Template' :
                                   args.section_name;
      
      if (!(normalizedSectionName in sections) && 
          normalizedSectionName !== 'description' && 
          normalizedSectionName !== 'System Message' && 
          normalizedSectionName !== 'User Message Template') {
        log.error(`Section '${args.section_name}' not found in prompt '${args.id}'`);
        return {
          content: [
            {
              type: "text",
              text: `Section '${args.section_name}' not found in prompt '${args.id}'`
            }
          ],
          isError: true
        };
      }
      
      // Store the original prompt data for potential rollback
      const originalPrompt = { ...prompt };
      const originalContent = promptContent;
      
      // Create a backup of the original prompt file
      const backupPath = `${promptFilePath}.bak`;
      try {
        await writeFile(backupPath, originalContent, "utf8");
      } catch (error) {
        log.error(`Error creating backup file ${backupPath}:`, error);
        // Continue even if backup creation fails
      }
      
      try {
        // Modify the section
        if (normalizedSectionName === 'title') {
          sections.title = args.new_content;
        } else if (normalizedSectionName === 'description') {
          sections.description = args.new_content;
        } else if (normalizedSectionName === 'System Message') {
          sections['System Message'] = args.new_content;
        } else if (normalizedSectionName === 'User Message Template') {
          sections['User Message Template'] = args.new_content;
        } else {
          sections[normalizedSectionName] = args.new_content;
        }
        
        // Reconstruct the prompt content
        let newPromptContent = `# ${sections.title}\n\n${sections.description}\n\n`;
        
        // Add other sections
        for (const [name, content] of Object.entries(sections)) {
          if (name !== 'title' && name !== 'description') {
            newPromptContent += `## ${name}\n\n${content}\n\n`;
          }
        }
        
        // Delete the prompt from prompts.json
        promptsFile.prompts.splice(promptIndex, 1);
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        
        // Delete the prompt file
        try {
          await fs.unlink(promptFilePath);
          log.info(`Deleted prompt file: ${promptFilePath}`);
        } catch (fileError) {
          log.warn(`Could not delete prompt file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
          // Continue even if file deletion fails
        }
        
        // Create the updated prompt
        const updatedPrompt: PromptData = {
          ...originalPrompt,
          name: normalizedSectionName === 'title' ? args.new_content : originalPrompt.name
        };
        
        // Write the updated prompt file
        await writeFile(promptFilePath, newPromptContent, "utf8");
        
        // Update prompts.json
        promptsFile.prompts.push(updatedPrompt);
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        
        // Reload prompts and categories
        try {
          const result = await reloadPrompts();
          log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after modifying section: ${args.section_name}`);
        } catch (error) {
          log.error("Error reloading prompts data:", error);
          // Continue even if reload fails
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully modified section '${args.section_name}' in prompt '${args.id}'`
            }
          ]
        };
      } catch (error) {
        log.error(`Error modifying prompt section, attempting rollback:`, error);
        
        try {
          // Restore the original prompt file if backup exists
          try {
            await fs.copyFile(backupPath, promptFilePath);
            log.info(`Restored original prompt file from backup`);
          } catch (restoreError) {
            log.error(`Error restoring prompt file from backup:`, restoreError);
          }
          
          // Restore the prompts.json file
          promptsFile.prompts[promptIndex] = originalPrompt;
          await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
          log.info(`Restored original prompt entry in prompts.json`);
          
          // Reload prompts and categories
          try {
            const result = await reloadPrompts();
            log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after rollback`);
          } catch (reloadError) {
            log.error("Error reloading prompts data after rollback:", reloadError);
          }
        } catch (rollbackError) {
          log.error(`Error during rollback:`, rollbackError);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Failed to modify prompt section: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      } finally {
        // Clean up the backup file
        try {
          await fs.unlink(backupPath);
        } catch (error) {
          log.warn(`Failed to delete backup file ${backupPath}:`, error);
        }
      }
    } catch (error) {
      log.error(`Error in modify_prompt_section:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to modify prompt section: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// New function to reload prompts without restarting the server
async function reloadPrompts(): Promise<{ promptsData: PromptData[]; convertedPrompts: ConvertedPrompt[] }> {
  try {
    log.info(`Reloading prompts from ${PROMPTS_FILE}...`);
    
    // Re-read the prompts file
    const fileContent = await readFile(PROMPTS_FILE, "utf8");
    const promptsFile = JSON.parse(fileContent) as PromptsFile;
    
    // Update the global variables
    promptsData = promptsFile.prompts;
    categories = promptsFile.categories || [];
    
    // Re-convert markdown prompts to JSON
    const newConvertedPrompts = await convertMarkdownPromptsToJson(promptsData);
    
    log.info(`Successfully reloaded ${promptsData.length} prompts and ${categories.length} categories`);
    log.info(`Successfully converted ${newConvertedPrompts.length} prompts to JSON structure`);
    
    return { promptsData, convertedPrompts: newConvertedPrompts };
  } catch (error) {
    log.error(`Error reloading prompts:`, error);
    throw error;
  }
}

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
        
        // Ensure all defined arguments have values (using previous_message as fallback)
        promptData.arguments.forEach(arg => {
          if (!args[arg.name]) {
            args[arg.name] = `{{previous_message}}`;
          }
        });
        
        // Check if this is a chain prompt
        if (promptData.isChain && promptData.chainSteps && promptData.chainSteps.length > 0) {
          log.info(`Prompt '${promptData.name}' is a chain with ${promptData.chainSteps.length} steps. NOT automatically executing the chain.`);
          
          // No longer automatically execute the entire chain
          // Instead, we'll process this as a regular prompt
          
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
  
  // Add API endpoints for tools
  app.post("/api/v1/tools/create_category", async (req: Request, res: Response) => {
    try {
      log.info("API request to create category:", req.body);
      
      // Validate required fields
      if (!req.body.id || !req.body.name || !req.body.description) {
        return res.status(400).json({ 
          error: "Missing required fields. Please provide id, name, and description." 
        });
      }
      
      // Implement the create_category functionality directly
      try {
        const { id, name, description } = req.body;
        
        // Read the current prompts.json file
        const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
        const fileContent = await readFile(PROMPTS_FILE, "utf8");
        const promptsFile = JSON.parse(fileContent) as PromptsFile;
        
        // Check if the category already exists
        const categoryExists = promptsFile.categories.some(cat => cat.id === id);
        if (categoryExists) {
          return res.status(400).json({ error: `Category '${id}' already exists.` });
        }
        
        // Add the new category
        promptsFile.categories.push({ id, name, description });
        
        // Write the updated file
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        
        // Create the category directory if it doesn't exist
        const categoryDirPath = path.join(__dirname, "..", "prompts", id);
        try {
          await fs.mkdir(categoryDirPath, { recursive: true });
        } catch (error) {
          log.error(`Error creating directory ${categoryDirPath}:`, error);
          // Continue even if directory creation fails
        }
        
        // Reload prompts and categories
        try {
          const result = await reloadPrompts();
          log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after creating category: ${id}`);
        } catch (error) {
          log.error("Error reloading prompts data:", error);
          // Continue even if reload fails
        }
        
        // Return success response
        return res.status(200).json({ 
          success: true, 
          message: `Category '${name}' created successfully` 
        });
      } catch (toolError) {
        return res.status(400).json({ error: toolError instanceof Error ? toolError.message : String(toolError) });
      }
    } catch (error) {
      log.error("Error handling create_category API request:", error);
      return res.status(500).json({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.post("/api/v1/tools/update_prompt", async (req: Request, res: Response) => {
    try {
      log.info("API request to update prompt:", req.body);
      
      // Validate required fields
      if (!req.body.id || !req.body.name || !req.body.category || !req.body.userMessageTemplate) {
        return res.status(400).json({ 
          error: "Missing required fields. Please provide id, name, category, and userMessageTemplate." 
        });
      }
      
      // Implement the update_prompt functionality directly
      try {
        const { 
          id, 
          name, 
          category, 
          description = "", 
          systemMessage, 
          userMessageTemplate, 
          arguments: promptArgs = [], 
          isChain = false, 
          chainSteps 
        } = req.body;
        
        // Read the current prompts.json file
        const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
        const fileContent = await readFile(PROMPTS_FILE, "utf8");
        const promptsFile = JSON.parse(fileContent) as PromptsFile;
        
        // Check if the category exists
        const categoryExists = promptsFile.categories.some(cat => cat.id === category);
        if (!categoryExists) {
          return res.status(400).json({ 
            error: `Category '${category}' does not exist. Please create the category first or use an existing category.` 
          });
        }
        
        // Check if the prompt already exists
        const promptIndex = promptsFile.prompts.findIndex(p => p.id === id);
        const isNewPrompt = promptIndex === -1;
        
        // Create the prompt directory if it doesn't exist
        const promptsDir = path.join(__dirname, "..", "prompts", category);
        try {
          await fs.mkdir(promptsDir, { recursive: true });
        } catch (error) {
          log.error(`Error creating directory ${promptsDir}:`, error);
          // Continue even if directory creation fails
        }
        
        // Construct the prompt file content
        let promptFileContent = `# ${name}\n\n`;
        promptFileContent += `${description}\n\n`;
        
        if (systemMessage) {
          promptFileContent += `## System Message\n\n${systemMessage}\n\n`;
        }
        
        promptFileContent += `## User Message Template\n\n${userMessageTemplate}\n\n`;
        
        if (isChain && chainSteps && chainSteps.length > 0) {
          promptFileContent += `\n## Chain Steps\n\n`;
          
          const totalSteps = chainSteps.length;
          chainSteps.forEach((step: any, index: number) => {
            promptFileContent += `${index + 1}. promptId: ${step.promptId}\n`;
            promptFileContent += `   stepName: ${step.stepName} (Step ${index + 1} of ${totalSteps})\n`;
            
            if (step.inputMapping) {
              promptFileContent += `   inputMapping:\n`;
              for (const [key, value] of Object.entries(step.inputMapping)) {
                promptFileContent += `     ${key}: ${value}\n`;
              }
            }
            
            if (step.outputMapping) {
              promptFileContent += `   outputMapping:\n`;
              for (const [key, value] of Object.entries(step.outputMapping)) {
                promptFileContent += `     ${key}: ${value}\n`;
              }
            }
            
            promptFileContent += `\n`;
          });
          
          // Add Output Format section for chain prompts
          promptFileContent += `## Output Format\n\n`;
          promptFileContent += `After completing all ${totalSteps} steps in the chain, you will have a final output that:\n\n`;
          promptFileContent += `1. Is well-organized and clearly structured\n`;
          promptFileContent += `2. Represents the culmination of the entire chain process\n\n`;
          promptFileContent += `The final output will be the result of the last step in the chain.\n`;
        }
        
        // Write the prompt file
        const promptFilePath = path.join(promptsDir, `${id}.md`);
        await writeFile(promptFilePath, promptFileContent, "utf8");
        
        // Create or update the prompt entry in prompts.json
        const promptData: PromptData = {
          id,
          name,
          category,
          description,
          file: `prompts/${category}/${id}.md`,
          arguments: promptArgs
        };
        
        if (isNewPrompt) {
          promptsFile.prompts.push(promptData);
        } else {
          promptsFile.prompts[promptIndex] = promptData;
        }
        
        // Write the updated prompts.json file
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        
        // Reload prompts and categories
        try {
          const result = await reloadPrompts();
          log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after updating prompt: ${id}`);
        } catch (error) {
          log.error("Error reloading prompts data:", error);
          // Continue even if reload fails
        }
        
        // Return success response
        return res.status(200).json({ 
          success: true, 
          message: `Prompt '${name}' ${isNewPrompt ? 'created' : 'updated'} successfully` 
        });
      } catch (toolError) {
        return res.status(400).json({ error: toolError instanceof Error ? toolError.message : String(toolError) });
      }
    } catch (error) {
      log.error("Error handling update_prompt API request:", error);
      return res.status(500).json({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Add DELETE endpoint to delete a prompt
  app.delete("/api/v1/tools/prompts/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      log.info(`API request to delete prompt: ${id}`);
      
      if (!id) {
        return res.status(400).json({ error: "Prompt ID is required" });
      }
      
      try {
        // Read the current prompts.json file
        const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
        const fileContent = await readFile(PROMPTS_FILE, "utf8");
        const promptsFile = JSON.parse(fileContent) as PromptsFile;
        
        // Find the prompt to delete
        const promptIndex = promptsFile.prompts.findIndex(p => p.id === id);
        
        if (promptIndex === -1) {
          return res.status(404).json({ error: `Prompt with ID '${id}' not found` });
        }
        
        // Get the prompt data before removing it
        const promptToDelete = promptsFile.prompts[promptIndex];
        
        // Remove the prompt from the array
        promptsFile.prompts.splice(promptIndex, 1);
        
        // Write the updated prompts.json file
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        
        // Delete the prompt file if it exists
        try {
          const promptFilePath = path.join(__dirname, "..", promptToDelete.file);
          await fs.unlink(promptFilePath);
          log.info(`Deleted prompt file: ${promptFilePath}`);
        } catch (fileError) {
          log.warn(`Could not delete prompt file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
          // Continue even if file deletion fails
        }
        
        // Reload prompts and categories
        try {
          const result = await reloadPrompts();
          log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after deleting prompt: ${id}`);
        } catch (error) {
          log.error("Error reloading prompts data:", error);
          // Continue even if reload fails
        }
        
        return res.status(200).json({ 
          success: true, 
          message: `Prompt '${promptToDelete.name}' (ID: ${id}) deleted successfully` 
        });
      } catch (toolError) {
        return res.status(400).json({ error: toolError instanceof Error ? toolError.message : String(toolError) });
      }
    } catch (error) {
      log.error("Error handling delete_prompt API request:", error);
      return res.status(500).json({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // API endpoint for modify_prompt_section
  app.post("/api/v1/tools/modify_prompt_section", async (req: Request, res: Response) => {
    try {
      log.info("Received request to modify prompt section:", req.body);
      
      const { id, section_name, new_content } = req.body;
      
      if (!id || !section_name || !new_content) {
        return res.status(400).json({
          error: "Missing required fields: id, section_name, and new_content are required"
        });
      }
      
      // Read the current prompts.json file
      const PROMPTS_FILE = path.join(__dirname, "..", config.prompts.file);
      const fileContent = await readFile(PROMPTS_FILE, "utf8");
      const promptsFile = JSON.parse(fileContent) as PromptsFile;
      
      // Find the prompt
      const promptIndex = promptsFile.prompts.findIndex(p => p.id === id);
      if (promptIndex === -1) {
        log.error(`Prompt with ID '${id}' not found`);
        return res.status(404).json({
          error: `Prompt with ID '${id}' not found`
        });
      }
      
      const prompt = promptsFile.prompts[promptIndex];
      
      // Read the prompt file
      const promptFilePath = path.join(__dirname, "..", prompt.file);
      let promptContent: string;
      try {
        promptContent = await readFile(promptFilePath, "utf8");
      } catch (error) {
        log.error(`Error reading prompt file ${promptFilePath}:`, error);
        return res.status(500).json({
          error: `Failed to read prompt file: ${error instanceof Error ? error.message : String(error)}`
        });
      }
      
      // Parse the prompt sections
      const sections: Record<string, string> = {};
      
      // Extract the title (first # heading)
      const titleMatch = promptContent.match(/^# (.+?)(?=\n\n|\n##)/s);
      if (titleMatch) {
        sections.title = titleMatch[1].trim();
        
        // Extract description (content between title and first ## heading)
        const descMatch = promptContent.match(/^# .+?\n\n([\s\S]+?)(?=\n## )/s);
        if (descMatch) {
          sections.description = descMatch[1].trim();
        } else {
          sections.description = '';
        }
      }
      
      // Extract other sections (## headings)
      const sectionMatches = Array.from(promptContent.matchAll(/## ([^\n]+)\n\n([\s\S]+?)(?=\n## |\n# |\n$)/g));
      for (const match of sectionMatches) {
        const sectionName = match[1].trim();
        const sectionContent = match[2].trim();
        sections[sectionName] = sectionContent;
      }
      
      // Check if the section exists
      const normalizedSectionName = section_name === 'title' ? 'title' : 
                                   section_name === 'description' ? 'description' : 
                                   section_name === 'System Message' ? 'System Message' :
                                   section_name === 'User Message Template' ? 'User Message Template' :
                                   section_name;
      
      if (!(normalizedSectionName in sections) && 
          normalizedSectionName !== 'description' && 
          normalizedSectionName !== 'System Message' && 
          normalizedSectionName !== 'User Message Template') {
        log.error(`Section '${section_name}' not found in prompt '${id}'`);
        return {
          content: [
            {
              type: "text",
              text: `Section '${section_name}' not found in prompt '${id}'`
            }
          ],
          isError: true
        };
      }
      
      // Store the original prompt data for potential rollback
      const originalPrompt = { ...prompt };
      const originalContent = promptContent;
      
      // Create a backup of the original prompt file
      const backupPath = `${promptFilePath}.bak`;
      try {
        await writeFile(backupPath, originalContent, "utf8");
      } catch (error) {
        log.error(`Error creating backup file ${backupPath}:`, error);
        // Continue even if backup creation fails
      }
      
      try {
        // Modify the section
        if (normalizedSectionName === 'title') {
          sections.title = new_content;
        } else if (normalizedSectionName === 'description') {
          sections.description = new_content;
        } else if (normalizedSectionName === 'System Message') {
          sections['System Message'] = new_content;
        } else if (normalizedSectionName === 'User Message Template') {
          sections['User Message Template'] = new_content;
        } else {
          sections[normalizedSectionName] = new_content;
        }
        
        // Reconstruct the prompt content
        let newPromptContent = `# ${sections.title}\n\n${sections.description}\n\n`;
        
        // Add other sections
        for (const [name, content] of Object.entries(sections)) {
          if (name !== 'title' && name !== 'description') {
            newPromptContent += `## ${name}\n\n${content}\n\n`;
          }
        }
        
        // Delete the prompt from prompts.json
        promptsFile.prompts.splice(promptIndex, 1);
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        
        // Delete the prompt file
        try {
          await fs.unlink(promptFilePath);
          log.info(`Deleted prompt file: ${promptFilePath}`);
        } catch (fileError) {
          log.warn(`Could not delete prompt file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
          // Continue even if file deletion fails
        }
        
        // Create the updated prompt
        const updatedPrompt: PromptData = {
          ...originalPrompt,
          name: normalizedSectionName === 'title' ? new_content : originalPrompt.name
        };
        
        // Write the updated prompt file
        await writeFile(promptFilePath, newPromptContent, "utf8");
        
        // Update prompts.json
        promptsFile.prompts.push(updatedPrompt);
        await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
        
        // Reload prompts and categories
        try {
          const result = await reloadPrompts();
          log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after modifying section: ${section_name}`);
        } catch (error) {
          log.error("Error reloading prompts data:", error);
          // Continue even if reload fails
        }
        
        return res.status(200).json({
          success: true,
          message: `Successfully modified section '${section_name}' in prompt '${id}'`,
          prompt: updatedPrompt
        });
      } catch (error) {
        log.error(`Error modifying prompt section, attempting rollback:`, error);
        
        try {
          // Restore the original prompt file if backup exists
          try {
            await fs.copyFile(backupPath, promptFilePath);
            log.info(`Restored original prompt file from backup`);
          } catch (restoreError) {
            log.error(`Error restoring prompt file from backup:`, restoreError);
          }
          
          // Restore the prompts.json file
          promptsFile.prompts[promptIndex] = originalPrompt;
          await writeFile(PROMPTS_FILE, JSON.stringify(promptsFile, null, 2), "utf8");
          log.info(`Restored original prompt entry in prompts.json`);
          
          // Reload prompts and categories
          try {
            const result = await reloadPrompts();
            log.info(`Reloaded ${promptsData.length} prompts and ${categories.length} categories after rollback`);
          } catch (reloadError) {
            log.error("Error reloading prompts data after rollback:", reloadError);
          }
        } catch (rollbackError) {
          log.error(`Error during rollback:`, rollbackError);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Failed to modify prompt section: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      } finally {
        // Clean up the backup file
        try {
          await fs.unlink(backupPath);
        } catch (error) {
          log.warn(`Failed to delete backup file ${backupPath}:`, error);
        }
      }
    } catch (error) {
      log.error(`Error in modify_prompt_section:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to modify prompt section: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

  // Add API endpoint to reload prompts
  app.post("/api/v1/tools/reload_prompts", async (req: Request, res: Response) => {
    try {
      log.info("API request to reload prompts");
      
      try {
        const result = await reloadPrompts();
        
        // Replace the global convertedPrompts array with the new values
        // This is necessary because the original array is declared with const
        convertedPrompts.length = 0;
        result.convertedPrompts.forEach(prompt => convertedPrompts.push(prompt));
        
        return res.status(200).json({
          success: true,
          message: `Successfully reloaded ${promptsData.length} prompts and ${categories.length} categories`,
          data: {
            promptsCount: promptsData.length,
            categoriesCount: categories.length,
            convertedPromptsCount: convertedPrompts.length
          }
        });
      } catch (reloadError) {
        return res.status(500).json({
          error: "Failed to reload prompts",
          details: reloadError instanceof Error ? reloadError.message : String(reloadError)
        });
      }
    } catch (error) {
      log.error("Error handling reload_prompts API request:", error);
      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      });
    }
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
