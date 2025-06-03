/**
 * Prompt Management MCP Tools
 * Contains update_prompt, delete_prompt, modify_prompt_section, and reload_prompts tools
 */

import * as fs from "fs/promises";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { ConfigManager } from "../config/index.js";
import { Logger } from "../logging/index.js";
import { modifyPromptSection, safeWriteFile } from "../promptUtils.js";
import {
  ConvertedPrompt,
  PromptData,
  PromptsConfigFile,
} from "../types/index.js";

/**
 * Prompt Management Tools implementation
 */
export class PromptManagementTools {
  private logger: Logger;
  private mcpServer: any;
  private configManager: ConfigManager;
  private promptsData: PromptData[] = [];
  private convertedPrompts: ConvertedPrompt[] = [];
  private fullServerRefresh: () => Promise<void>;
  private triggerServerRefresh: (
    restart?: boolean,
    reason?: string
  ) => Promise<void>;

  constructor(
    logger: Logger,
    mcpServer: any,
    configManager: ConfigManager,
    fullServerRefresh: () => Promise<void>,
    triggerServerRefresh: (restart?: boolean, reason?: string) => Promise<void>
  ) {
    this.logger = logger;
    this.mcpServer = mcpServer;
    this.configManager = configManager;
    this.fullServerRefresh = fullServerRefresh;
    this.triggerServerRefresh = triggerServerRefresh;
  }

  /**
   * Update internal data references
   */
  updateData(
    promptsData: PromptData[],
    convertedPrompts: ConvertedPrompt[]
  ): void {
    this.promptsData = promptsData;
    this.convertedPrompts = convertedPrompts;
  }

  /**
   * Register update_prompt tool
   */
  registerUpdatePrompt(): void {
    this.mcpServer.tool(
      "update_prompt",
      {
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
              required: z
                .boolean()
                .describe("Whether this argument is required"),
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
        onEmptyInvocation: z
          .enum(["return_template", "execute_if_possible"])
          .optional()
          .describe(
            "Defines behavior when prompt is invoked without its defined arguments. Defaults to execute_if_possible if omitted."
          ),
        fullServerRestart: z
          .boolean()
          .optional()
          .describe(
            "Whether to perform a full server restart after updating the prompt. Defaults to false (hot-reload only)."
          ),
      },
      async (
        args: {
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
          onEmptyInvocation?: "return_template" | "execute_if_possible";
          fullServerRestart?: boolean;
        },
        extra: any
      ) => {
        try {
          this.logger.info(`Updating prompt: ${args.id}`);

          const result = await this.updatePromptImplementation(args);

          if (args.fullServerRestart) {
            setTimeout(async () => {
              try {
                await this.triggerServerRefresh(
                  true,
                  `Prompt updated: ${args.id}`
                );
              } catch (error) {
                this.logger.error(
                  `Error during server restart after updating prompt: ${args.id}`,
                  error
                );
              }
            }, 1000);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `${result.message}\n\nFull server restart initiated as requested...`,
                },
              ],
            };
          } else {
            // Default to hot-reload if not a full server restart
            try {
              await this.triggerServerRefresh(
                false,
                `Prompt updated: ${args.id}`
              );
              this.logger.info(
                `Hot-reload after updating prompt: ${args.id} completed.`
              );
            } catch (refreshError) {
              this.logger.error(
                `Error during hot-reload after updating prompt: ${args.id}`,
                refreshError
              );
              // Potentially append to result.message or return a specific error message
            }
            return {
              content: [
                {
                  type: "text" as const,
                  text: `${result.message} Changes were hot-reloaded. Server was not restarted.`,
                },
              ],
            };
          }
        } catch (error) {
          this.logger.error(`Error in update_prompt:`, error);
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to update prompt: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Implementation of update prompt logic
   */
  private async updatePromptImplementation(
    args: any
  ): Promise<{ message: string }> {
    const PROMPTS_FILE = this.configManager.getPromptsFilePath();
    const fileContent = await readFile(PROMPTS_FILE, "utf8");
    const promptsConfig = JSON.parse(fileContent) as PromptsConfigFile;

    // Ensure required arrays exist
    if (!promptsConfig.categories) {
      promptsConfig.categories = [];
    }
    if (!promptsConfig.imports) {
      promptsConfig.imports = [];
    }

    // Handle category creation if needed
    const effectiveCategory = await this.ensureCategoryExists(
      args.category,
      promptsConfig,
      PROMPTS_FILE
    );

    // Create prompt file and update category
    const promptExists = await this.createOrUpdatePromptFile(
      args,
      effectiveCategory,
      PROMPTS_FILE
    );

    return {
      message: `Successfully ${promptExists ? "updated" : "created"} prompt: ${
        args.id
      }`,
    };
  }

  /**
   * Ensure category exists, create if needed
   */
  private async ensureCategoryExists(
    category: string,
    promptsConfig: PromptsConfigFile,
    promptsFile: string
  ): Promise<string> {
    const effectiveCategory = category.toLowerCase().replace(/\s+/g, "-");
    const categoryExists = promptsConfig.categories.some(
      (cat) => cat.id === effectiveCategory
    );

    if (!categoryExists) {
      this.logger.info(
        `Category '${category}' does not exist. Creating it automatically.`
      );

      // Add new category
      promptsConfig.categories.push({
        id: effectiveCategory,
        name: category,
        description: `Prompts related to ${category}`,
      });

      // Create category directory
      const categoryDirPath = path.join(
        path.dirname(promptsFile),
        "prompts",
        effectiveCategory
      );
      await fs.mkdir(categoryDirPath, { recursive: true });

      // Create category prompts.json
      const categoryPromptsPath = path.join(categoryDirPath, "prompts.json");
      await safeWriteFile(
        categoryPromptsPath,
        JSON.stringify({ prompts: [] }, null, 2),
        "utf8"
      );

      // Add to imports
      const relativeCategoryPath = path
        .join("prompts", effectiveCategory, "prompts.json")
        .replace(/\\/g, "/");
      if (!promptsConfig.imports.includes(relativeCategoryPath)) {
        promptsConfig.imports.push(relativeCategoryPath);
      }

      // Save updated config
      await safeWriteFile(
        promptsFile,
        JSON.stringify(promptsConfig, null, 2),
        "utf8"
      );
    }

    return effectiveCategory;
  }

  /**
   * Create or update prompt file and category entry
   */
  private async createOrUpdatePromptFile(
    args: any,
    effectiveCategory: string,
    promptsFile: string
  ): Promise<boolean> {
    const promptFilename = `${args.id}.md`;
    const promptDirPath = path.join(
      path.dirname(promptsFile),
      "prompts",
      effectiveCategory
    );
    const fullPromptFilePath = path.join(promptDirPath, promptFilename);

    // Create prompt file content
    let promptFileContent = `# ${args.name}\n\n`;
    promptFileContent += `## Description\n${args.description}\n\n`;

    if (args.systemMessage) {
      promptFileContent += `## System Message\n${args.systemMessage}\n\n`;
    }

    promptFileContent += `## User Message Template\n${args.userMessageTemplate}\n`;

    // Add chain steps if present
    if (args.isChain && args.chainSteps && args.chainSteps.length > 0) {
      promptFileContent += `\n## Chain Steps\n\n`;

      args.chainSteps.forEach((step: any, index: number) => {
        promptFileContent += `${index + 1}. promptId: ${step.promptId}\n`;
        promptFileContent += `   stepName: ${step.stepName}\n`;

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
    }

    // Write prompt file
    await safeWriteFile(fullPromptFilePath, promptFileContent, "utf8");

    // Update category prompts.json
    const categoryPromptsPath = path.join(promptDirPath, "prompts.json");
    let categoryPrompts: { prompts: PromptData[] };

    try {
      const content = await readFile(categoryPromptsPath, "utf8");
      categoryPrompts = JSON.parse(content);
    } catch {
      categoryPrompts = { prompts: [] };
    }

    const promptEntry: PromptData = {
      id: args.id,
      name: args.name,
      category: effectiveCategory,
      description: args.description,
      file: promptFilename,
      arguments: args.arguments || [],
      ...(args.onEmptyInvocation && {
        onEmptyInvocation: args.onEmptyInvocation,
      }),
    };

    const existingIndex = categoryPrompts.prompts.findIndex(
      (p) => p.id === args.id
    );
    const promptExists = existingIndex !== -1;

    if (promptExists) {
      categoryPrompts.prompts[existingIndex] = promptEntry;
    } else {
      categoryPrompts.prompts.push(promptEntry);
    }

    await safeWriteFile(
      categoryPromptsPath,
      JSON.stringify(categoryPrompts, null, 2),
      "utf8"
    );

    return promptExists;
  }

  /**
   * Register delete_prompt tool
   */
  registerDeletePrompt(): void {
    this.mcpServer.tool(
      "delete_prompt",
      {
        id: z.string().describe("Unique identifier for the prompt to delete"),
        fullServerRestart: z
          .boolean()
          .optional()
          .describe(
            "Whether to perform a full server restart after deleting the prompt. Defaults to false (hot-reload only)."
          ),
      },
      async (
        { id, fullServerRestart }: { id: string; fullServerRestart?: boolean },
        extra: any
      ) => {
        try {
          this.logger.info(`Deleting prompt: ${id}`);

          const result = await this.deletePromptImplementation(id);

          if (fullServerRestart) {
            setTimeout(async () => {
              try {
                await this.triggerServerRefresh(true, `Prompt deleted: ${id}`);
              } catch (err) {
                this.logger.error(
                  `Error during server restart after deleting prompt: ${id}`,
                  err
                );
              }
            }, 1000);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `${result.message}\n\nFull server restart initiated as requested...`,
                },
              ],
            };
          } else {
            // Default to hot-reload if not a full server restart
            try {
              await this.triggerServerRefresh(false, `Prompt deleted: ${id}`);
              this.logger.info(
                `Hot-reload after deleting prompt: ${id} completed.`
              );
            } catch (refreshError) {
              this.logger.error(
                `Error during hot-reload after deleting prompt: ${id}`,
                refreshError
              );
              // Potentially append to result.message or return a specific error message
            }
            return {
              content: [
                {
                  type: "text" as const,
                  text: `${result.message} Changes were hot-reloaded. Server was not restarted.`,
                },
              ],
            };
          }
        } catch (error) {
          this.logger.error("Error in delete_prompt tool:", error);
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to delete prompt: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Implementation of delete prompt logic
   */
  private async deletePromptImplementation(
    id: string
  ): Promise<{ message: string }> {
    const PROMPTS_CONFIG_FILE_PATH = this.configManager.getPromptsFilePath();
    const promptsConfigDir = path.dirname(PROMPTS_CONFIG_FILE_PATH);
    let promptsConfig: PromptsConfigFile;

    try {
      const configContent = await readFile(PROMPTS_CONFIG_FILE_PATH, "utf8");
      promptsConfig = JSON.parse(configContent);
    } catch (e) {
      this.logger.error(
        `Failed to read or parse promptsConfig.json at ${PROMPTS_CONFIG_FILE_PATH}`,
        e
      );
      throw new Error("Could not load main prompt configuration.");
    }

    if (!promptsConfig.imports) promptsConfig.imports = [];
    if (!promptsConfig.categories) promptsConfig.categories = [];

    let promptFoundAndDeleted = false;
    let modifiedCategoryImportPath: string | null = null;
    let promptMarkdownFilePath: string | null = null;

    for (const categoryImport of [...promptsConfig.imports]) {
      // Iterate over a copy for safe modification
      const fullCategoryPromptsPath = path.join(
        promptsConfigDir,
        categoryImport
      );
      let categoryPromptsFileContent;
      let categoryPromptsJson;

      try {
        categoryPromptsFileContent = await readFile(
          fullCategoryPromptsPath,
          "utf8"
        );
        categoryPromptsJson = JSON.parse(categoryPromptsFileContent);
      } catch (e) {
        this.logger.warn(
          `Could not read or parse category prompts file: ${fullCategoryPromptsPath}`,
          e
        );
        continue; // Skip to next import
      }

      if (
        !categoryPromptsJson.prompts ||
        !Array.isArray(categoryPromptsJson.prompts)
      ) {
        this.logger.warn(
          `Category file ${fullCategoryPromptsPath} has no valid 'prompts' array. Skipping.`
        );
        continue;
      }

      const originalPromptsCount = categoryPromptsJson.prompts.length;
      const promptToDeleteIndex = categoryPromptsJson.prompts.findIndex(
        (p: PromptData) => p.id === id
      );

      if (promptToDeleteIndex > -1) {
        const promptEntry = categoryPromptsJson.prompts[promptToDeleteIndex];
        promptMarkdownFilePath = path.join(
          path.dirname(fullCategoryPromptsPath),
          promptEntry.file
        );

        categoryPromptsJson.prompts.splice(promptToDeleteIndex, 1);
        await safeWriteFile(
          fullCategoryPromptsPath,
          JSON.stringify(categoryPromptsJson, null, 2),
          "utf8"
        );
        this.logger.info(
          `Removed prompt '${id}' from category file: ${fullCategoryPromptsPath}`
        );
        promptFoundAndDeleted = true;
        modifiedCategoryImportPath = categoryImport; // Store which import was modified

        // Attempt to delete the markdown file
        if (promptMarkdownFilePath) {
          try {
            await fs.unlink(promptMarkdownFilePath);
            this.logger.info(
              `Deleted markdown file: ${promptMarkdownFilePath}`
            );
          } catch (unlinkError: any) {
            // Log if it's not a "not found" error, as it might have been deleted already or never existed
            if (unlinkError.code !== "ENOENT") {
              this.logger.warn(
                `Could not delete markdown file '${promptMarkdownFilePath}':`,
                unlinkError
              );
            } else {
              this.logger.info(
                `Markdown file '${promptMarkdownFilePath}' not found, possibly already deleted.`
              );
            }
          }
        }
        break; // Exit loop once prompt is found and processed
      }
    }

    if (!promptFoundAndDeleted) {
      throw new Error(
        `Prompt with ID '${id}' not found in any category's prompts.json.`
      );
    }

    // If a category was modified, check if it's now empty and clean up promptsConfig.json
    if (modifiedCategoryImportPath) {
      const fullModifiedCategoryPath = path.join(
        promptsConfigDir,
        modifiedCategoryImportPath
      );
      try {
        const categoryFileContent = await readFile(
          fullModifiedCategoryPath,
          "utf8"
        );
        const categoryPromptsConfig = JSON.parse(categoryFileContent);

        if (
          categoryPromptsConfig.prompts &&
          categoryPromptsConfig.prompts.length === 0
        ) {
          this.logger.info(
            `Category file '${modifiedCategoryImportPath}' is now empty. Removing from promptsConfig.json.`
          );
          promptsConfig.imports = promptsConfig.imports.filter(
            (impPath) => impPath !== modifiedCategoryImportPath
          );

          const categoryIdMatch = modifiedCategoryImportPath.match(
            // Adjusted regex to be more flexible with path separators and prompts folder name
            /(?:prompts[\\/])?([^\\/]+)[\\/]prompts\.json$/
          );
          if (categoryIdMatch && categoryIdMatch[1]) {
            const categoryIdToRemove = categoryIdMatch[1];
            this.logger.info(
              `Also removing category definition for '${categoryIdToRemove}' from promptsConfig.json.`
            );
            promptsConfig.categories = promptsConfig.categories.filter(
              (cat) => cat.id !== categoryIdToRemove
            );

            // Optionally delete the empty category directory and its prompts.json file
            const categoryDirPath = path.dirname(fullModifiedCategoryPath);
            try {
              // Check if directory is empty before removing (safer)
              const filesInDir = await fs.readdir(categoryDirPath);
              if (
                filesInDir.length === 0 ||
                (filesInDir.length === 1 &&
                  filesInDir[0] === "prompts.json" &&
                  categoryPromptsConfig.prompts.length === 0)
              ) {
                await fs.rm(categoryDirPath, { recursive: true, force: true });
                this.logger.info(
                  `Deleted empty category directory: ${categoryDirPath}`
                );
              } else if (
                filesInDir.length === 1 &&
                filesInDir[0] === "prompts.json" &&
                categoryPromptsConfig.prompts.length > 0
              ) {
                // This case should not happen if we just emptied it.
                this.logger.warn(
                  `Category directory ${categoryDirPath} still contains prompts.json with prompts. Not deleting directory.`
                );
              } else {
                this.logger.info(
                  `Category directory ${categoryDirPath} not empty (contains: ${filesInDir.join(
                    ", "
                  )}). Not deleting.`
                );
              }
            } catch (dirRemoveError) {
              this.logger.warn(
                `Could not delete or check category directory ${categoryDirPath}:`,
                dirRemoveError
              );
            }
          } else {
            this.logger.warn(
              `Could not determine category ID from path '${modifiedCategoryImportPath}' to remove its definition.`
            );
          }
          await safeWriteFile(
            PROMPTS_CONFIG_FILE_PATH,
            JSON.stringify(promptsConfig, null, 2),
            "utf8"
          );
          this.logger.info(
            "Updated promptsConfig.json after removing empty category references."
          );
        }
      } catch (readCheckError) {
        this.logger.error(
          `Could not re-read category file '${fullModifiedCategoryPath}' to check if empty:`,
          readCheckError
        );
      }
    }
    return {
      message: `Prompt '${id}' processed. If found, it has been deleted.`,
    };
  }

  /**
   * Register modify_prompt_section tool
   */
  registerModifyPromptSection(): void {
    this.mcpServer.tool(
      "modify_prompt_section",
      {
        id: z.string().describe("Unique identifier of the prompt to modify"),
        section_name: z
          .string()
          .describe(
            "Name of the section to modify (valid values: 'title', 'description', 'System Message', 'User Message Template', or any custom section)"
          ),
        new_content: z
          .string()
          .describe("New content for the specified section"),
        fullServerRestart: z
          .boolean()
          .optional()
          .describe(
            "Whether to perform a full server restart after modifying the prompt section. Defaults to false (hot-reload only)."
          ),
      },
      async (args: {
        id: string;
        section_name: string;
        new_content: string;
        fullServerRestart?: boolean;
      }) => {
        try {
          this.logger.info(
            `Attempting to modify section '${args.section_name}' of prompt '${args.id}'`
          );

          const PROMPTS_FILE = this.configManager.getPromptsFilePath();
          const result = await modifyPromptSection(
            args.id,
            args.section_name,
            args.new_content,
            PROMPTS_FILE
          );

          if (!result.success) {
            return {
              content: [{ type: "text" as const, text: result.message }],
              isError: true,
            };
          }

          // Trigger server refresh: hot-reload if fullServerRestart is false/undefined, full restart if true.
          try {
            await this.triggerServerRefresh(
              args.fullServerRestart || false,
              `Section modified: ${args.section_name} in prompt: ${args.id}`
            );
          } catch (refreshError) {
            this.logger.error(
              `Error refreshing server after modifying section: ${args.section_name}`,
              refreshError
            );
          }

          if (args.fullServerRestart) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `${result.message}\n\nFull server restart initiated as requested...`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: `${result.message} Changes were hot-reloaded. Server was not restarted.`,
              },
            ],
          };
        } catch (error) {
          this.logger.error(`Error in modify_prompt_section:`, error);
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to modify prompt section: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Register reload_prompts tool
   */
  registerReloadPrompts(): void {
    this.mcpServer.tool(
      "reload_prompts",
      {
        fullServerRestart: z
          .boolean()
          .optional()
          .describe(
            "Whether to perform a full server restart after reloading prompts. Defaults to false (hot-reload only)."
          ),
        reason: z
          .string()
          .optional()
          .describe("Optional reason for reloading/restarting"),
      },
      async (
        {
          fullServerRestart,
          reason,
        }: { fullServerRestart?: boolean; reason?: string },
        extra: any
      ) => {
        try {
          const reloadReason = reason || "Manual reload requested";
          this.logger.info(
            `Reload prompts request received${
              fullServerRestart
                ? " (full server restart requested)"
                : " (hot-reload only)"
            }: ${reloadReason}`
          );

          if (fullServerRestart) {
            // If restarting, the triggerServerRefresh(true, ...) will handle everything,
            // including data reload as part of the orchestrator's restart sequence.
            this.logger.info(
              `Initiating full server restart. Reason: ${reloadReason}`
            );
            // Schedule restart after response.
            setTimeout(async () => {
              try {
                await this.triggerServerRefresh(true, reloadReason);
              } catch (error) {
                this.logger.error("Error handling server restart:", error);
              }
            }, 1000); // Delay to allow the current response to be sent

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Server is restarting. Prompts and configuration will be reloaded. Reason: ${reloadReason}\n\nThe server will be back online in a few seconds. You may need to refresh your client.`,
                },
              ],
            };
          } else {
            // If NOT performing a full server restart, just perform the hot-reload.
            this.logger.info(
              `Performing hot-reload of prompts. Reason: ${reloadReason}`
            );
            try {
              await this.fullServerRefresh(); // This calls orchestrator.loadAndProcessData()
              this.logger.info(
                `Completed hot-reload of prompts. Successfully reloaded ${this.promptsData.length} prompts from ${this.convertedPrompts.length} categories.`
              );
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Successfully hot-reloaded ${this.promptsData.length} prompts from ${this.convertedPrompts.length} categories. Server was not restarted.`,
                  },
                ],
              };
            } catch (refreshError) {
              this.logger.error(
                "Error during hot-reload of prompts:",
                refreshError
              );
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Error during hot-reload of prompts: ${
                      refreshError instanceof Error
                        ? refreshError.message
                        : String(refreshError)
                    }`,
                  },
                ],
                isError: true,
              };
            }
          }
        } catch (error) {
          this.logger.error("Error in reload_prompts tool:", error);
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to process reload_prompts request: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
}
