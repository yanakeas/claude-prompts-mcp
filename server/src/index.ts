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
}

// Function to load prompt content from markdown file
async function loadPromptFile(filePath: string): Promise<{ systemMessage?: string; userMessageTemplate: string }> {
  try {
    const fullPath = path.join(__dirname, "..", filePath);
    const content = await readFile(fullPath, "utf8");
    
    // Extract system message and user message template from markdown
    const systemMessageMatch = content.match(/## System Message\s*\n([\s\S]*?)(?=\n##|$)/);
    const userMessageMatch = content.match(/## User Message Template\s*\n([\s\S]*?)(?=\n##|$)/);
    
    const systemMessage = systemMessageMatch ? systemMessageMatch[1].trim() : undefined;
    const userMessageTemplate = userMessageMatch ? userMessageMatch[1].trim() : "";
    
    if (!userMessageTemplate) {
      throw new Error(`No user message template found in ${filePath}`);
    }
    
    return { systemMessage, userMessageTemplate };
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
        }))
      };
      
      // Extract placeholders from user template for verification
      const placeholderRegex = /\{([^}]+)\}/g;
      const templatePlaceholders = new Set<string>();
      let match;
      
      while ((match = placeholderRegex.exec(promptFile.userMessageTemplate)) !== null) {
        templatePlaceholders.add(match[1]);
      }
      
      // Verify all required arguments have placeholders
      for (const arg of promptData.arguments) {
        if (arg.required && !templatePlaceholders.has(arg.name)) {
          log.warn(`Prompt '${promptData.name}' (${promptData.id}): Required argument '${arg.name}' does not have a placeholder in the template`);
        }
      }
      
      // Verify all placeholders have corresponding arguments
      const argNames = new Set(promptData.arguments.map(arg => arg.name));
      for (const placeholder of templatePlaceholders) {
        if (!argNames.has(placeholder)) {
          log.warn(`Prompt '${promptData.name}' (${promptData.id}): Template contains placeholder '{${placeholder}}' but no corresponding argument is defined`);
        }
      }
      
      convertedPrompts.push(convertedPrompt);
      log.debug(`Converted prompt: ${promptData.id} (${promptData.name})`);
    } catch (error) {
      log.error(`Error converting prompt ${promptData.id}:`, error);
    }
  }
  
  log.info(`Successfully converted ${convertedPrompts.length} of ${promptsData.length} prompts`);
  return convertedPrompts;
}

// Create MCP server
const server = new McpServer({
  name: config.server.name,
  version: config.server.version
});

// Add a tool to handle slash commands
server.tool(
  "process_slash_command",
  "Processes slash commands that trigger prompt templates with optional arguments",
  {
    command: z.string().describe("The slash command to process, e.g., '/content_analysis Hello world'")
  },
  async ({ command }, extra) => {
    try {
      log.info(`Processing slash command: ${command}`);
      
      // Check if this is a valid slash command
      if (!command.startsWith("/")) {
        return { 
          content: [{ type: "text", text: "Not a valid slash command. Commands must start with '/'." }]
        };
      }
      
      // Extract command name and arguments
      const spaceIndex = command.indexOf(" ");
      const commandName = spaceIndex > 0 
        ? command.substring(1, spaceIndex) 
        : command.substring(1);
      
      // If there are no arguments, handle empty content case
      const commandArgs = spaceIndex > 0 
        ? command.substring(spaceIndex + 1).trim() 
        : "";
      
      log.debug(`Command name: ${commandName}, Args: ${commandArgs}`);
      
      // Handle the built-in listprompts command
      if (commandName === "listprompts") {
        log.info("Executing listprompts command from process_slash_command");
        
        // Generate the listprompts content directly
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
                const required = arg.required ? " (required)" : " (optional)";
                listpromptsText += `- \`${arg.name}\`${required}: ${arg.description || 'No description'}\n`;
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
      }
      
      // Look for a matching prompt in our registry
      const matchingPrompt = promptsData.find(
        prompt => prompt.id === commandName || prompt.name === commandName
      );
      
      if (!matchingPrompt) {
        return { 
          content: [{ 
            type: "text", 
            text: `No prompt found matching command '/${commandName}'. Available commands are: ${promptsData.map(p => p.id).join(", ")}`
          }]
        };
      }
      
      // Prepare arguments for the prompt
      const promptArgValues: Record<string, string> = {};
      
      // Handle the command arguments based on the expected prompt arguments
      if (matchingPrompt.arguments.length === 1) {
        // If prompt expects only one argument, use the entire command text as its value
        promptArgValues[matchingPrompt.arguments[0].name] = commandArgs;
      } else if (matchingPrompt.arguments.length > 1) {
        // For multi-argument prompts, attempt to parse structured JSON, or provide guidance
        try {
          // Try to parse as JSON if it looks like JSON
          if (commandArgs.trim().startsWith("{") && commandArgs.trim().endsWith("}")) {
            const parsedArgs = JSON.parse(commandArgs);
            Object.keys(parsedArgs).forEach(key => {
              promptArgValues[key] = parsedArgs[key];
            });
          } else {
            // Otherwise treat first argument as content and leave others empty
            if (matchingPrompt.arguments.length > 0 && commandArgs) {
              promptArgValues[matchingPrompt.arguments[0].name] = commandArgs;
            }
            
            // Provide guidance on correct format
            log.debug(`Multi-argument prompt requested (${matchingPrompt.arguments.length} args). Command arguments not in JSON format.`);
          }
        } catch (e) {
          log.debug("Error parsing JSON arguments:", e);
          // Still assign the first argument if there is content
          if (matchingPrompt.arguments.length > 0 && commandArgs) {
            promptArgValues[matchingPrompt.arguments[0].name] = commandArgs;
          }
        }
      }
      
      log.debug("Prepared arguments for prompt:", promptArgValues);
      
      // Check for missing required arguments
      const missingArgs = matchingPrompt.arguments
        .filter(arg => arg.required && !promptArgValues[arg.name])
        .map(arg => arg.name);
      
      if (missingArgs.length > 0) {
        return { 
          content: [{ 
            type: "text", 
            text: `Missing required arguments for '/${commandName}': ${missingArgs.join(", ")}. Please provide values for these arguments.`
          }]
        };
      }
      
      // Find the converted prompt with template data
      const convertedPrompt = convertedPrompts.find(cp => cp.id === matchingPrompt.id);
      
      if (!convertedPrompt) {
        return {
          content: [{
            type: "text",
            text: `Error: Could not find converted prompt data for ${matchingPrompt.id}`
          }]
        };
      }
      
      // Create the prompt handler function similar to the one used for regular prompts
      const messages: { role: "user" | "assistant"; content: { type: "text"; text: string } }[] = [];
      
      // Create user message with placeholders replaced
      let userMessageText = convertedPrompt.userMessageTemplate;
      
      // If there's a system message, prepend it to the user message
      if (convertedPrompt.systemMessage) {
        userMessageText = `[System Info: ${convertedPrompt.systemMessage}]\n\n${userMessageText}`;
      }
      
      // Replace placeholders in message content with argument values
      Object.entries(promptArgValues).forEach(([key, value]) => {
        if (value !== undefined) {
          userMessageText = userMessageText.replace(
            new RegExp(`\\{${key}\\}`, "g"),
            String(value)
          );
        }
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
      log.error("Error processing slash command:", error);
      return { 
        content: [{ 
          type: "text", 
          text: `Error processing slash command: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
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
              const required = arg.required ? " (required)" : " (optional)";
              listpromptsText += `- \`${arg.name}\`${required}: ${arg.description || 'No description'}\n`;
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
    // Create a schema for the prompt arguments
    const argsSchema: Record<string, z.ZodType> = {};
    promptData.arguments.forEach(arg => {
      // All arguments are treated as strings since PromptArgument doesn't have a type property
      argsSchema[arg.name] = arg.required ? z.string() : z.string().optional();
    });

    // Create prompt handler function
    const promptHandler = async (args: any) => {
      try {
        log.debug(`Executing prompt '${promptData.name}' with args:`, args);
        
        // Create messages array with only user and assistant roles
        // System messages will be converted to user messages
        const messages: { role: "user" | "assistant"; content: { type: "text"; text: string } }[] = [];
        
        // Create user message with placeholders replaced
        let userMessageText = promptData.userMessageTemplate;
        
        // If there's a system message, prepend it to the user message
        if (promptData.systemMessage) {
          userMessageText = `[System Info: ${promptData.systemMessage}]\n\n${userMessageText}`;
        }
        
        // Replace placeholders in message content with argument values
        // Check if all required arguments are present
        const missingArgs: string[] = [];
        promptData.arguments.forEach(arg => {
          if (arg.required && (args[arg.name] === undefined || args[arg.name] === null || args[arg.name] === '')) {
            missingArgs.push(arg.name);
          }
        });
        
        if (missingArgs.length > 0) {
          log.error(`Missing required arguments for prompt '${promptData.name}': ${missingArgs.join(', ')}`);
          throw new Error(`Missing required arguments: ${missingArgs.join(', ')}`);
        }
        
        // Check if user template contains placeholders for all required arguments
        promptData.arguments.forEach(arg => {
          if (arg.required && !userMessageText.includes(`{${arg.name}}`)) {
            log.warn(`Template for prompt '${promptData.name}' is missing placeholder for required argument: ${arg.name}`);
          }
        });
        
        Object.entries(args).forEach(([key, value]) => {
          if (value !== undefined) {
            const oldText = userMessageText;
            userMessageText = userMessageText.replace(
              new RegExp(`\\{${key}\\}`, "g"),
              String(value)
            );
            
            // Check if replacement actually happened
            if (oldText === userMessageText && promptData.arguments.some(arg => arg.name === key)) {
              log.warn(`Placeholder {${key}} not found in template for prompt '${promptData.name}'`);
            }
          }
        });
        
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
