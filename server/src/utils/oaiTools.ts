import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Define tool schemas using zod for better type safety
const listPromptsSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe("Optional text filter to show only matching prompts"),
});

const getPromptSchema = z.object({
  id: z.string().describe("Unique identifier of the prompt to retrieve"),
});

const executePromptSchema = z.object({
  id: z.string().describe("Unique identifier of the prompt to execute"),
  args: z
    .record(z.string())
    .optional()
    .describe("Arguments to pass to the prompt template"),
});

const updatePromptSchema = z.object({
  id: z.string().describe("Unique identifier for the prompt"),
  name: z.string().describe("Display name for the prompt"),
  category: z.string().describe("Category this prompt belongs to"),
  description: z.string().describe("Description of the prompt"),
  systemMessage: z
    .string()
    .optional()
    .describe("Optional system message for the prompt"),
  userMessageTemplate: z
    .string()
    .describe("Template for generating the user message"),
  arguments: z
    .array(
      z.object({
        name: z.string().describe("Name of the argument"),
        description: z
          .string()
          .optional()
          .describe("Optional description of the argument"),
        required: z.boolean().describe("Whether this argument is required"),
      })
    )
    .describe("Arguments accepted by this prompt"),
  isChain: z
    .boolean()
    .optional()
    .describe("Whether this prompt is a chain of prompts"),
  chainSteps: z
    .array(
      z.object({
        promptId: z
          .string()
          .describe("ID of the prompt to execute in this step"),
        stepName: z.string().describe("Name of this step"),
        inputMapping: z
          .record(z.string())
          .optional()
          .describe("Maps chain inputs to this step's inputs"),
        outputMapping: z
          .record(z.string())
          .optional()
          .describe("Maps this step's outputs to chain outputs"),
      })
    )
    .optional()
    .describe("Steps in the chain if this is a chain prompt"),
});

const deletePromptSchema = z.object({
  id: z.string().describe("Unique identifier of the prompt to delete"),
});

const modifyPromptSectionSchema = z.object({
  id: z.string().describe("Unique identifier of the prompt to modify"),
  section_name: z
    .string()
    .describe(
      "Name of the section to modify (valid values: 'title', 'description', 'System Message', 'User Message Template', or any custom section)"
    ),
  new_content: z.string().describe("New content for the specified section"),
});

const reloadPromptsSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe("Optional reason for reloading/refreshing"),
});

const rebuildIndexSchema = z.object({}).describe("No parameters needed");

const storeReferenceSchema = z.object({
  content: z.string().describe("Text content to store as a reference"),
  title: z.string().optional().describe("Optional title for the reference"),
});

const getReferenceSchema = z.object({
  id: z.string().describe("Unique identifier of the reference to retrieve"),
});

const processSlashCommandSchema = z.object({
  command: z
    .string()
    .describe(
      "The command to process, e.g., '>>content_analysis Hello world' or '/content_analysis Hello world'"
    ),
});

// Convert zod schemas to OpenAI-compatible JSON schema
function createOpenAITool(
  name: string,
  description: string,
  schema: z.ZodTypeAny
): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: zodToJsonSchema(schema) as Record<string, unknown>,
    },
  };
}

// Create the OpenAI tool definitions for each function
export const oaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  createOpenAITool(
    "list_prompts",
    "Return a catalogue of available prompt templates",
    listPromptsSchema
  ),
  createOpenAITool(
    "get_prompt",
    "Get a specific prompt template by ID",
    getPromptSchema
  ),
  createOpenAITool(
    "execute_prompt",
    "Execute a specific prompt template with arguments",
    executePromptSchema
  ),
  createOpenAITool(
    "update_prompt",
    "Create or update a prompt template",
    updatePromptSchema
  ),
  createOpenAITool(
    "delete_prompt",
    "Delete a prompt template by ID",
    deletePromptSchema
  ),
  createOpenAITool(
    "modify_prompt_section",
    "Modify a specific section of a prompt template",
    modifyPromptSectionSchema
  ),
  createOpenAITool(
    "reload_prompts",
    "Reload all prompts from storage",
    reloadPromptsSchema
  ),
  createOpenAITool(
    "rebuild_index",
    "Scan S3 bucket and rebuild the prompt index file",
    rebuildIndexSchema
  ),
  createOpenAITool(
    "process_slash_command",
    "Process commands that trigger prompt templates with optional arguments",
    processSlashCommandSchema
  ),
  createOpenAITool(
    "store_reference",
    "Store a long text reference and get a reference token",
    storeReferenceSchema
  ),
  createOpenAITool(
    "get_reference",
    "Retrieve a text reference by its ID",
    getReferenceSchema
  ),
];

// Export the schema objects for use in validation
export const schemas = {
  listPrompts: listPromptsSchema,
  getPrompt: getPromptSchema,
  executePrompt: executePromptSchema,
  updatePrompt: updatePromptSchema,
  deletePrompt: deletePromptSchema,
  modifyPromptSection: modifyPromptSectionSchema,
  reloadPrompts: reloadPromptsSchema,
  rebuildIndex: rebuildIndexSchema,
  processSlashCommand: processSlashCommandSchema,
  storeReference: storeReferenceSchema,
  getReference: getReferenceSchema,
};
