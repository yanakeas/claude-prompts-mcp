import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import path from "path";
dotenv.config();

import {
  findAndDeletePromptFile,
  modifyPromptSection,
  parsePromptSections,
  readPromptFile,
} from "./s3PromptUtils.js";
import { PromptData } from "./types.js";
import { processTemplate as originalProcessTemplate } from "./utils/jsonUtils.js";
import { oaiTools, schemas } from "./utils/oaiTools.js";
import { listS3Files, readFromS3, writeToS3 } from "./utils/s3Utils.js";

// Extend the NodeJS global interface to include gc() function
declare global {
  namespace NodeJS {
    interface Global {
      gc?: () => void;
    }
  }
}

// Text Reference System
interface TextReference {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  lastUsed: number;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create Express app
const app = express();
const PORT = process.env.PORT || 3456;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

// Initialize text reference storage
const textReferenceStore: {
  references: TextReference[];
  maxAge: number;
  maxSize: number;
} = {
  references: [],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 1000, // Store up to 1000 references
};

// Set up logging for debugging
const log = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
};

// Create a simple conversation history tracker
const conversationHistory: Array<{
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  timestamp: number;
}> = [];

// Define maximum history size to prevent memory leaks
const MAX_HISTORY_SIZE = 100;

// Function to add items to conversation history with size management
function addToConversationHistory(item: {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  timestamp: number;
}) {
  conversationHistory.push(item);

  // Trim history if it exceeds maximum size
  if (conversationHistory.length > MAX_HISTORY_SIZE) {
    // Remove oldest entries, keeping recent ones
    conversationHistory.splice(
      0,
      conversationHistory.length - MAX_HISTORY_SIZE
    );
    log.debug(
      `Trimmed conversation history to ${MAX_HISTORY_SIZE} entries to prevent memory leaks`
    );
  }
}

// Function to generate a title for a text using OpenAI
async function generateTextTitle(text: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Return a 50-character slug ONLY." },
        { role: "user", content: text.slice(0, 4000) },
      ],
    });
    return (
      completion.choices[0].message.content?.trim() || `Text_${Date.now()}`
    );
  } catch (error) {
    log.error("Error generating title:", error);
    return `Text_${Date.now()}`;
  }
}

// Function to store a text reference
async function storeTextReference(
  text: string,
  customTitle?: string
): Promise<string> {
  try {
    const title = customTitle || (await generateTextTitle(text));
    const id = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const reference: TextReference = {
      id,
      title,
      content: text,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    // Save to S3
    await writeToS3(`references/${id}.txt`, text, "text/plain");

    // Also keep in memory for quick access
    textReferenceStore.references.push(reference);

    // Clean up old references if we exceed maxSize
    if (textReferenceStore.references.length > textReferenceStore.maxSize) {
      cleanupOldReferences();
    }

    return `{{ref:${id}}}`;
  } catch (error) {
    log.error("Error storing text reference:", error);
    throw new Error(
      `Failed to store text reference: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Function to retrieve a text reference
async function getTextReference(refId: string): Promise<string | null> {
  try {
    // First check memory cache
    const memoryRef = textReferenceStore.references.find(
      (ref) => ref.id === refId
    );

    if (memoryRef) {
      memoryRef.lastUsed = Date.now();
      return memoryRef.content;
    }

    // If not in memory, try loading from S3
    try {
      const content = await readFromS3(`references/${refId}.txt`);

      // Add to memory cache
      textReferenceStore.references.push({
        id: refId,
        title: `Reference ${refId}`,
        content,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      });

      return content;
    } catch (error) {
      log.error(`Reference not found in S3: ${refId}`);
      return null;
    }
  } catch (error) {
    log.error(`Error retrieving reference: ${refId}`, error);
    return null;
  }
}

// Function to clean up old references
function cleanupOldReferences() {
  const now = Date.now();
  textReferenceStore.references = textReferenceStore.references
    .filter((ref) => now - ref.lastUsed < textReferenceStore.maxAge)
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, textReferenceStore.maxSize);
}

// Function to list available references
async function listTextReferences(): Promise<
  Array<{
    id: string;
    title: string;
    createdAt: number;
  }>
> {
  // Return in-memory references
  const memoryRefs = textReferenceStore.references.map((ref) => ({
    id: ref.id,
    title: ref.title,
    createdAt: ref.createdAt,
  }));

  // Also list any references in S3 that aren't in memory
  try {
    const s3Refs = await listS3Files("references/");
    const additionalRefs = s3Refs
      .filter((key) => key.endsWith(".txt"))
      .map((key) => {
        // Extract the ID from the key (references/ID.txt)
        const id = path.basename(key, ".txt");
        // Check if this reference is already in our list
        if (!memoryRefs.some((ref) => ref.id === id)) {
          return {
            id,
            title: `Reference ${id}`,
            createdAt: 0, // We don't know the creation time
          };
        }
        return null;
      })
      .filter((ref) => ref !== null) as Array<{
      id: string;
      title: string;
      createdAt: number;
    }>;

    return [...memoryRefs, ...additionalRefs];
  } catch (error) {
    log.error("Error listing S3 references:", error);
    return memoryRefs;
  }
}

// Function to process templates with text references
async function processTemplateAsync(
  template: string,
  args: Record<string, string>,
  specialContext: Record<string, string> = {}
): Promise<string> {
  // Process the template with the arguments
  let processedTemplate = originalProcessTemplate(
    template,
    args,
    specialContext
  );

  // Replace any reference placeholders with their content
  const refMatches = processedTemplate.match(/{{ref:([^}]+)}}/g);
  if (refMatches) {
    for (const match of refMatches) {
      const refId = match.substring(6, match.length - 2);
      const content = await getTextReference(refId);
      if (content) {
        processedTemplate = processedTemplate.replace(match, content);
      }
    }
  }

  return processedTemplate;
}

// Synchronous version that doesn't handle text references
function processTemplate(
  template: string,
  args: Record<string, string>,
  specialContext: Record<string, string> = {}
): string {
  // Process the template with the arguments directly
  return originalProcessTemplate(template, args, specialContext);
}

// Tool Function Registry
const toolFunctions = {
  // List prompts function
  async list_prompts({ filter }: { filter?: string }) {
    try {
      // Load the index.json file from S3
      const indexContent = await readFromS3("index.json");
      const promptsIndex = JSON.parse(indexContent);

      let prompts = promptsIndex.prompts;
      const categories = promptsIndex.categories;

      // Apply filter if provided
      if (filter) {
        const filterLower = filter.toLowerCase();
        prompts = prompts.filter(
          (prompt: PromptData) =>
            prompt.id.toLowerCase().includes(filterLower) ||
            prompt.name.toLowerCase().includes(filterLower) ||
            prompt.description.toLowerCase().includes(filterLower) ||
            prompt.category.toLowerCase().includes(filterLower)
        );
      }

      // Format the response
      return {
        prompts,
        categories,
        count: prompts.length,
      };
    } catch (error) {
      log.error("Error listing prompts:", error);
      throw new Error(
        `Failed to list prompts: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Scan and rebuild index function
  async rebuild_index() {
    try {
      log.info("Rebuilding prompt index from S3 bucket contents");

      // Initialize empty index
      const promptsIndex = { prompts: [], categories: [] };
      const categoriesMap = new Map();

      // List all directories under the prompts/ prefix (these are categories)
      const promptDirs = await listS3Files("prompts/");
      const categoryDirs = new Set<string>(
        promptDirs
          .map((key) => {
            const parts = key.split("/");
            return parts.length > 1 ? parts[1] : null;
          })
          .filter((dir): dir is string => dir !== null)
      );

      // Process each category directory
      for (const categoryId of categoryDirs) {
        // Add category to index if it doesn't exist
        if (!categoriesMap.has(categoryId)) {
          const categoryName = categoryId
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const categoryObj = {
            id: categoryId,
            name: categoryName,
            description: `Prompts related to ${categoryName}`,
          };
          categoriesMap.set(categoryId, categoryObj);
          (promptsIndex.categories as any[]).push(categoryObj);
        }

        // List all markdown files in this category
        const categoryFiles = await listS3Files(`prompts/${categoryId}/`);
        const promptFiles = categoryFiles.filter((key) => key.endsWith(".md"));

        // Process each prompt file
        for (const promptFile of promptFiles) {
          try {
            // Extract the ID from the filename
            const filename = path.basename(promptFile);
            const promptId = filename.replace(".md", "");

            // Read the prompt content
            const promptContent = await readFromS3(promptFile);
            const sections = parsePromptSections(promptContent);

            // Extract basic info from content
            let name = promptId;
            let description = "";
            if (sections.title) {
              name = sections.title;
            }
            if (sections.description) {
              description = sections.description;
            }

            // Check if this prompt uses chain steps
            const isChain = !!sections["Chain Steps"];

            // Create a default arguments array
            // This is a simplification - ideally we'd parse them from the content
            const args = [];
            const templateContent = sections["User Message Template"] || "";
            const matches = templateContent.match(/{{([^}]+)}}/g) || [];
            for (const match of matches) {
              const argName = match.replace(/{{|}}/g, "").trim();
              if (argName && !argName.startsWith("ref:")) {
                args.push({
                  name: argName,
                  required: true,
                });
              }
            }

            // Create the prompt data object
            const promptData = {
              id: promptId,
              name: name,
              category: categoryId,
              description: description,
              file: filename,
              arguments: args,
              isChain: isChain,
              tools: false,
            };

            // Add to index
            (promptsIndex.prompts as any[]).push(promptData);
            log.info(`Added prompt to index: ${promptId}`);
          } catch (error) {
            log.error(`Error processing prompt file ${promptFile}:`, error);
          }
        }
      }

      // Write the updated index file
      await writeToS3(
        "index.json",
        JSON.stringify(promptsIndex, null, 2),
        "application/json"
      );

      return {
        success: true,
        message: `Index rebuilt successfully. Found ${promptsIndex.prompts.length} prompts in ${promptsIndex.categories.length} categories.`,
        stats: {
          prompts: promptsIndex.prompts.length,
          categories: promptsIndex.categories.length,
        },
      };
    } catch (error) {
      log.error("Error rebuilding index:", error);
      throw new Error(
        `Failed to rebuild index: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Get prompt function
  async get_prompt({ id }: { id: string }) {
    try {
      // Load the index.json file from S3
      const indexContent = await readFromS3("index.json");
      const promptsIndex = JSON.parse(indexContent);

      // Find the prompt in the index
      const prompt = promptsIndex.prompts.find((p: PromptData) => p.id === id);
      if (!prompt) {
        throw new Error(`Prompt with ID '${id}' not found`);
      }

      // Get the category info
      const category = promptsIndex.categories.find(
        (c: { id: string }) => c.id === prompt.category
      );

      // Get the prompt file content
      const categoryKey = `prompts/${prompt.category}`;
      const promptS3Key = path.posix.join(categoryKey, prompt.file);
      const promptContent = await readPromptFile(promptS3Key);

      // Parse the content into sections
      const sections = parsePromptSections(promptContent);

      return {
        ...prompt,
        category_name: category?.name || prompt.category,
        content: promptContent,
        sections,
      };
    } catch (error) {
      log.error(`Error getting prompt ${id}:`, error);
      throw new Error(
        `Failed to get prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Update prompt function
  async update_prompt(args: {
    id: string;
    name: string;
    category: string;
    description: string;
    systemMessage?: string;
    userMessageTemplate: string;
    arguments: Array<{
      name: string;
      description?: string;
      required: boolean;
    }>;
    isChain?: boolean;
    chainSteps?: Array<{
      promptId: string;
      stepName: string;
      inputMapping?: Record<string, string>;
      outputMapping?: Record<string, string>;
    }>;
  }) {
    try {
      log.info(`Updating prompt: ${args.id}`);

      // First check if index.json exists, if not create it
      let promptsIndex = { prompts: [], categories: [] };
      try {
        const indexContent = await readFromS3("index.json");
        promptsIndex = JSON.parse(indexContent);
      } catch (error) {
        log.warn("index.json not found, creating new index");
      }

      // Check if the category exists
      const effectiveCategory = args.category
        .toLowerCase()
        .replace(/\s+/g, "-");
      const categoryExists = (
        promptsIndex.categories as Array<{ id: string }>
      ).some((cat) => cat.id === effectiveCategory);

      // If category doesn't exist, create it
      if (!categoryExists) {
        const newCategory = {
          id: effectiveCategory,
          name: args.category,
          description: `Prompts related to ${args.category}`,
        };
        (promptsIndex.categories as any[]).push(newCategory);
        log.info(`Created new category: ${args.category}`);
      }

      // Check if prompt already exists
      const promptIndex = (promptsIndex.prompts as PromptData[]).findIndex(
        (p) => p.id === args.id
      );
      const promptExists = promptIndex !== -1;

      // Define the S3 key for the prompt file
      const promptFilename = `${args.id}.md`;
      const categoryKey = `prompts/${effectiveCategory}`;
      const promptS3Key = path.posix.join(categoryKey, promptFilename);

      // Create the markdown content
      let markdownContent = `# ${args.name}\n\n${args.description}\n\n`;

      if (args.systemMessage) {
        markdownContent += `## System Message\n\n${args.systemMessage}\n\n`;
      }

      markdownContent += `## User Message Template\n\n${args.userMessageTemplate}\n\n`;

      // Add chain steps if this is a chain prompt
      if (args.isChain && args.chainSteps && args.chainSteps.length > 0) {
        markdownContent += `## Chain Steps\n\n`;

        args.chainSteps.forEach((step, index) => {
          markdownContent += `### Step ${index + 1}: ${step.stepName}\n\n`;
          markdownContent += `Prompt: \`${step.promptId}\`\n\n`;

          if (step.inputMapping) {
            markdownContent += `Input Mapping:\n\`\`\`json\n${JSON.stringify(
              step.inputMapping,
              null,
              2
            )}\n\`\`\`\n\n`;
          }

          if (step.outputMapping) {
            markdownContent += `Output Mapping:\n\`\`\`json\n${JSON.stringify(
              step.outputMapping,
              null,
              2
            )}\n\`\`\`\n\n`;
          }
        });
      }

      // Create the prompt data object
      const promptData = {
        id: args.id,
        name: args.name,
        category: effectiveCategory,
        description: args.description,
        file: promptFilename,
        arguments: args.arguments,
        isChain: args.isChain || false,
        tools: false, // OpenAI handles tools directly
      };

      // Update or add the prompt in the index
      if (promptExists) {
        (promptsIndex.prompts as any[])[promptIndex] = promptData;
      } else {
        (promptsIndex.prompts as any[]).push(promptData);
      }

      // Write the prompt file to S3
      await writeToS3(promptS3Key, markdownContent);

      // Update the index file
      await writeToS3(
        "index.json",
        JSON.stringify(promptsIndex, null, 2),
        "application/json"
      );

      return {
        success: true,
        message: promptExists
          ? `Updated prompt: ${args.id}`
          : `Created prompt: ${args.id}`,
        prompt: promptData,
      };
    } catch (error) {
      log.error(`Error updating prompt ${args.id}:`, error);
      throw new Error(
        `Failed to update prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Delete prompt function
  async delete_prompt({ id }: { id: string }) {
    try {
      const result = await findAndDeletePromptFile(id);

      if (!result.found) {
        return {
          success: false,
          message: `Prompt with ID '${id}' not found`,
        };
      }

      if (!result.deleted) {
        return {
          success: false,
          message: `Failed to delete prompt '${id}': ${result.error}`,
        };
      }

      return {
        success: true,
        message: `Successfully deleted prompt '${id}'`,
      };
    } catch (error) {
      log.error(`Error deleting prompt ${id}:`, error);
      throw new Error(
        `Failed to delete prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Modify prompt section function
  async modify_prompt_section({
    id,
    section_name,
    new_content,
  }: {
    id: string;
    section_name: string;
    new_content: string;
  }) {
    try {
      const result = await modifyPromptSection(id, section_name, new_content);

      return {
        success: result.success,
        message: result.message,
        promptData: result.promptData,
      };
    } catch (error) {
      log.error(`Error modifying prompt section ${id}:`, error);
      throw new Error(
        `Failed to modify prompt section: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Reload prompts function
  async reload_prompts({ reason }: { reason?: string }) {
    // In the new system, this is a no-op since we load from S3 on demand
    // But we keep it for compatibility
    log.info(`Reload prompts requested. Reason: ${reason || "Not specified"}`);

    return {
      success: true,
      message:
        "Prompts will be loaded from S3 on demand. No server restart needed.",
    };
  },

  // Store reference function
  async store_reference({
    content,
    title,
  }: {
    content: string;
    title?: string;
  }) {
    try {
      const referenceToken = await storeTextReference(content, title);
      return {
        success: true,
        token: referenceToken,
        message: "Reference stored successfully",
      };
    } catch (error) {
      log.error("Error storing reference:", error);
      throw new Error(
        `Failed to store reference: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Get reference function
  async get_reference({ id }: { id: string }) {
    try {
      const content = await getTextReference(id);
      if (!content) {
        return {
          success: false,
          message: `Reference with ID '${id}' not found`,
        };
      }

      return {
        success: true,
        content,
        message: "Reference retrieved successfully",
      };
    } catch (error) {
      log.error(`Error retrieving reference ${id}:`, error);
      throw new Error(
        `Failed to retrieve reference: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Process slash command function
  async process_slash_command({ command }: { command: string }) {
    try {
      log.info(`Processing command: ${command}`);

      if (!command) {
        throw new Error("Command is required");
      }

      // Normalize command to handle >> or / prefix
      let normalizedCommand = command;
      if (command.startsWith(">>")) {
        normalizedCommand = command.substring(2).trim();
      } else if (command.startsWith("/")) {
        normalizedCommand = command.substring(1).trim();
      }

      // Special case for listprompts command
      if (normalizedCommand.startsWith("listprompts")) {
        const filterPart = normalizedCommand
          .substring("listprompts".length)
          .trim();
        const result = await toolFunctions.list_prompts({
          filter: filterPart || undefined,
        });

        // Format the prompts into a nice response
        const categories: Record<string, any[]> = {};

        // Group prompts by category
        for (const prompt of result.prompts) {
          if (!categories[prompt.category]) {
            categories[prompt.category] = [];
          }
          categories[prompt.category].push(prompt);
        }

        // Build the formatted response
        let response = "# Available Commands\n\n";

        for (const categoryId in categories) {
          // Find the category name
          const category = result.categories.find(
            (c: any) => c.id === categoryId
          );
          const categoryName = category ? category.name : categoryId;

          response += `## ${categoryName}\n\n`;

          for (const prompt of categories[categoryId]) {
            response += `### >>${prompt.id}\n`;
            response += `${prompt.description}\n\n`;

            if (prompt.arguments && prompt.arguments.length > 0) {
              response += "**Arguments:**\n";
              for (const arg of prompt.arguments) {
                const required = arg.required ? "required" : "optional";
                response += `- \`${arg.name}\` (${required}): ${
                  arg.description || "No description"
                }\n`;
              }
              response += "\n";
            }
          }
        }

        return {
          success: true,
          response,
          type: "list_prompts",
        };
      }

      // Parse the command and arguments
      // Format could be: command_name arg1=value1 arg2=value2
      // Or it could be: command_name {"arg1": "value1", "arg2": "value2"}
      const spaceIndex = normalizedCommand.indexOf(" ");
      const promptId =
        spaceIndex > 0
          ? normalizedCommand.substring(0, spaceIndex)
          : normalizedCommand;

      let args: Record<string, string> = {};

      if (spaceIndex > 0) {
        const argsStr = normalizedCommand.substring(spaceIndex + 1).trim();

        // Try to parse as JSON
        if (argsStr.startsWith("{") && argsStr.endsWith("}")) {
          try {
            args = JSON.parse(argsStr);
          } catch (e) {
            // If JSON parsing fails, fall back to key=value format
            log.warn(
              "Failed to parse arguments as JSON, falling back to key=value format"
            );
          }
        }

        // If JSON parsing failed or it's not in JSON format, parse as key=value pairs
        if (Object.keys(args).length === 0) {
          // Split by spaces, but respect quoted values
          const argParts: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];

            if (char === '"' && (i === 0 || argsStr[i - 1] !== "\\")) {
              inQuotes = !inQuotes;
              current += char;
            } else if (char === " " && !inQuotes) {
              if (current) {
                argParts.push(current);
                current = "";
              }
            } else {
              current += char;
            }
          }

          if (current) {
            argParts.push(current);
          }

          // Parse each arg part as key=value
          for (const part of argParts) {
            const eqIndex = part.indexOf("=");
            if (eqIndex > 0) {
              const key = part.substring(0, eqIndex).trim();
              let value = part.substring(eqIndex + 1).trim();

              // Remove surrounding quotes if present
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
              }

              args[key] = value;
            }
          }
        }
      }

      // Execute the prompt
      const result = await toolFunctions.execute_prompt({ id: promptId, args });

      return {
        ...result,
        type: "execute_prompt",
      };
    } catch (error) {
      log.error(`Error processing command: ${command}`, error);
      throw new Error(
        `Failed to process command: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  // Execute prompt function
  async execute_prompt({
    id,
    args = {},
  }: {
    id: string;
    args?: Record<string, string>;
  }) {
    try {
      log.info(`Executing prompt: ${id} with args:`, args);

      // Get the prompt data
      const promptData = await toolFunctions.get_prompt({ id });

      if (!promptData) {
        throw new Error(`Prompt with ID '${id}' not found`);
      }

      // Get the user message template from the sections
      const userMessageTemplate = promptData.sections["User Message Template"];
      if (!userMessageTemplate) {
        throw new Error(`User Message Template not found for prompt '${id}'`);
      }

      // Get the system message if available
      const systemMessage = promptData.sections["System Message"];

      // Validate required arguments
      const missingArgs = [];
      for (const arg of promptData.arguments) {
        if (
          arg.required &&
          (!(arg.name in args) || args[arg.name] === undefined)
        ) {
          missingArgs.push(arg.name);
        }
      }

      if (missingArgs.length > 0) {
        throw new Error(
          `Missing required arguments: ${missingArgs.join(", ")}`
        );
      }

      // Process the template with the provided arguments
      const userMessage = await processTemplateAsync(userMessageTemplate, args);

      return {
        success: true,
        prompt: {
          id: promptData.id,
          name: promptData.name,
          messages: [
            ...(systemMessage
              ? [{ role: "system", content: systemMessage }]
              : []),
            { role: "user", content: userMessage },
          ],
          original_template: userMessageTemplate,
          processed_template: userMessage,
          arguments: args,
        },
      };
    } catch (error) {
      log.error(`Error executing prompt ${id}:`, error);
      throw new Error(
        `Failed to execute prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

// Chat handler
async function handleChat(req: Request, res: Response) {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Invalid request. 'messages' array is required.",
      });
    }

    // Store messages in conversation history
    messages.forEach((msg) => {
      if (msg.role === "user" || msg.role === "assistant") {
        addToConversationHistory({
          role: msg.role,
          content: msg.content as string,
          timestamp: Date.now(),
        });
      }
    });

    // Create the OpenAI API call
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages,
      tools: oaiTools,
      stream: true,
    });

    // Set up streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create a copy of the messages array for handling tool calls
    const updatedMessages = [...messages];

    // Process the stream
    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta;

      // Handle tool calls
      if (delta?.tool_calls && delta.tool_calls.length > 0) {
        const toolCall = delta.tool_calls[0];

        // If this is the start of a tool call, initialize the tool call in the message
        if (toolCall.index === 0 && toolCall.id) {
          const newToolCall = {
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.function?.name || "",
              arguments: toolCall.function?.arguments || "",
            },
          };

          updatedMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [newToolCall],
          });

          // Send the tool call start to the client
          res.write(
            `data: ${JSON.stringify({
              type: "tool_call_start",
              tool_call: newToolCall,
            })}\n\n`
          );
        }
        // If this is a continuation of a tool call
        else if (toolCall.function?.arguments) {
          // Find the last message with this tool call
          const lastMessageIndex = updatedMessages.length - 1;
          const lastMessage = updatedMessages[lastMessageIndex];

          if (lastMessage.role === "assistant" && lastMessage.tool_calls) {
            // Update the arguments for this tool call
            const lastToolCallIndex = lastMessage.tool_calls.length - 1;
            lastMessage.tool_calls[lastToolCallIndex].function.arguments +=
              toolCall.function.arguments;

            // Send the tool call update to the client
            res.write(
              `data: ${JSON.stringify({
                type: "tool_call_update",
                tool_call_id: lastMessage.tool_calls[lastToolCallIndex].id,
                arguments_delta: toolCall.function.arguments,
              })}\n\n`
            );
          }
        }

        // If the tool call is complete, execute the function
        if (chunk.choices[0]?.finish_reason === "tool_calls") {
          const lastMessage = updatedMessages[updatedMessages.length - 1];

          if (lastMessage.role === "assistant" && lastMessage.tool_calls) {
            for (const toolCall of lastMessage.tool_calls) {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);

              // Check if the function exists
              if (!(functionName in toolFunctions)) {
                res.write(
                  `data: ${JSON.stringify({
                    type: "tool_call_result",
                    tool_call_id: toolCall.id,
                    result: { error: `Function ${functionName} not found` },
                  })}\n\n`
                );
                continue;
              }

              try {
                // Execute the function
                const result = await (toolFunctions as any)[functionName](
                  functionArgs
                );

                // Add the result to the messages
                updatedMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result),
                });

                // Send the tool call result to the client
                res.write(
                  `data: ${JSON.stringify({
                    type: "tool_call_result",
                    tool_call_id: toolCall.id,
                    result,
                  })}\n\n`
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);

                // Add the error to the messages
                updatedMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: errorMessage }),
                });

                // Send the tool call error to the client
                res.write(
                  `data: ${JSON.stringify({
                    type: "tool_call_result",
                    tool_call_id: toolCall.id,
                    result: { error: errorMessage },
                  })}\n\n`
                );
              }
            }

            // Continue the conversation with the updated messages
            const continuationCompletion = await openai.chat.completions.create(
              {
                model: process.env.OPENAI_MODEL || "gpt-4o",
                messages: updatedMessages,
                tools: oaiTools,
                stream: true,
              }
            );

            // Process the continuation stream
            for await (const continuationChunk of continuationCompletion) {
              if (continuationChunk.choices[0]?.delta?.content) {
                const content = continuationChunk.choices[0].delta.content;
                res.write(
                  `data: ${JSON.stringify({ type: "content", content })}\n\n`
                );
              }
            }
          }
        }
      }
      // Handle regular content
      else if (delta?.content) {
        res.write(
          `data: ${JSON.stringify({
            type: "content",
            content: delta.content,
          })}\n\n`
        );
      }
    }

    // End the stream
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    log.error("Error in chat handler:", error);

    // If headers haven't been sent yet, return a JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        error: `Chat completion failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    // If headers have been sent (streaming already started), send an error in the stream
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: `Chat completion failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })}\n\n`
    );
    res.end();
  }
}

// API Routes
// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// List prompts
app.get("/v1/prompts", async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string | undefined;
    const result = await toolFunctions.list_prompts({ filter });
    res.json(result);
  } catch (error) {
    log.error("Error handling /v1/prompts GET:", error);
    res.status(500).json({
      error: `Failed to list prompts: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Get a specific prompt
app.get("/v1/prompts/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await toolFunctions.get_prompt({ id });
    res.json(result);
  } catch (error) {
    log.error(`Error handling /v1/prompts/${req.params.id} GET:`, error);
    res.status(500).json({
      error: `Failed to get prompt: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Create or update a prompt
app.put("/v1/prompts/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const promptData = req.body;

    // Validate the prompt data
    try {
      schemas.updatePrompt.parse({ ...promptData, id });
    } catch (error) {
      return res.status(400).json({
        error: `Invalid prompt data: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    const result = await toolFunctions.update_prompt({ ...promptData, id });
    res.json(result);
  } catch (error) {
    log.error(`Error handling /v1/prompts/${req.params.id} PUT:`, error);
    res.status(500).json({
      error: `Failed to update prompt: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Delete a prompt
app.delete("/v1/prompts/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await toolFunctions.delete_prompt({ id });
    res.json(result);
  } catch (error) {
    log.error(`Error handling /v1/prompts/${req.params.id} DELETE:`, error);
    res.status(500).json({
      error: `Failed to delete prompt: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Modify a prompt section
app.patch("/v1/prompts/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { section_name, new_content } = req.body;

    // Validate the request data
    if (!section_name || !new_content) {
      return res.status(400).json({
        error: "Both 'section_name' and 'new_content' are required",
      });
    }

    const result = await toolFunctions.modify_prompt_section({
      id,
      section_name,
      new_content,
    });

    res.json(result);
  } catch (error) {
    log.error(`Error handling /v1/prompts/${req.params.id} PATCH:`, error);
    res.status(500).json({
      error: `Failed to modify prompt section: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Store a reference
app.post("/v1/references", async (req: Request, res: Response) => {
  try {
    const { content, title } = req.body;

    if (!content) {
      return res.status(400).json({
        error: "'content' is required",
      });
    }

    const result = await toolFunctions.store_reference({ content, title });
    res.json(result);
  } catch (error) {
    log.error("Error handling /v1/references POST:", error);
    res.status(500).json({
      error: `Failed to store reference: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Get a reference
app.get("/v1/references/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await toolFunctions.get_reference({ id });

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    log.error(`Error handling /v1/references/${req.params.id} GET:`, error);
    res.status(500).json({
      error: `Failed to get reference: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Chat API endpoint (OpenAI-compatible)
app.post("/v1/chat", handleChat);

// Function API endpoint
app.post("/v1/functions", async (req: Request, res: Response) => {
  try {
    const { name, arguments: args } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "'name' is required",
      });
    }

    // Check if the function exists
    if (!(name in toolFunctions)) {
      return res.status(404).json({
        error: `Function '${name}' not found`,
      });
    }

    // Execute the function
    const result = await (toolFunctions as any)[name](args || {});
    res.json(result);
  } catch (error) {
    log.error("Error handling /v1/functions POST:", error);
    res.status(500).json({
      error: `Function execution failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Execute prompt endpoint
app.post("/v1/execute", async (req: Request, res: Response) => {
  try {
    const { id, args } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "'id' is required",
      });
    }

    // Execute the prompt
    const result = await toolFunctions.execute_prompt({ id, args });
    res.json(result);
  } catch (error) {
    log.error("Error handling /v1/execute POST:", error);
    res.status(500).json({
      error: `Prompt execution failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  log.info(`Server running on port ${PORT}`);
  log.info(`API available at http://localhost:${PORT}/v1/`);
  log.info(`Health check endpoint: http://localhost:${PORT}/health`);
});

// Add a route for rebuilding the index
app.post("/v1/rebuild-index", async (req: Request, res: Response) => {
  try {
    const result = await toolFunctions.rebuild_index();
    res.json(result);
  } catch (error) {
    log.error("Error handling /v1/rebuild-index POST:", error);
    res.status(500).json({
      error: `Failed to rebuild index: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

// Add an export statement for the Express app
// (Add this after the app declaration)
export { app, openai, toolFunctions };

// And also export at the end of the file
export default app;
