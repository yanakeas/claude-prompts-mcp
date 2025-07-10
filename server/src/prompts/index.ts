/**
 * Prompt Management System
 * Main module that orchestrates prompt loading, conversion, and registration
 */

// Import the individual modules
export * from "./converter.js";
export * from "./loader.js";
export * from "./registry.js";
export * from "./template-processor.js";

import { ConfigManager } from "../config/index.js";
import { Logger } from "../logging/index.js";
import { TextReferenceManager } from "../text-references/index.js";
import {
  Category,
  CategoryPromptsResult,
  ConvertedPrompt,
  PromptData,
} from "../types/index.js";

// Import the actual modules
import { PromptConverter } from "./converter.js";
import { PromptLoader } from "./loader.js";
import { PromptRegistry } from "./registry.js";
import { TemplateProcessor } from "./template-processor.js";

/**
 * Main Prompt Manager class that coordinates all prompt operations
 */
export class PromptManager {
  private logger: Logger;
  private textReferenceManager: TextReferenceManager;
  private configManager: ConfigManager;
  private mcpServer: any;

  // Individual module instances
  private converter: PromptConverter;
  private loader: PromptLoader;
  private registry?: PromptRegistry;
  private templateProcessor: TemplateProcessor;

  constructor(
    logger: Logger,
    textReferenceManager: TextReferenceManager,
    configManager: ConfigManager,
    mcpServer?: any
  ) {
    this.logger = logger;
    this.textReferenceManager = textReferenceManager;
    this.configManager = configManager;
    this.mcpServer = mcpServer;

    // Initialize individual modules
    this.loader = new PromptLoader(logger);
    this.templateProcessor = new TemplateProcessor(
      logger,
      textReferenceManager
    );
    this.converter = new PromptConverter(logger, this.loader);

    if (mcpServer) {
      this.registry = new PromptRegistry(
        logger,
        mcpServer,
        configManager,
        this.templateProcessor
      );
    }
  }

  /**
   * Load prompts from category-specific configuration files
   */
  async loadCategoryPrompts(
    configPath: string
  ): Promise<CategoryPromptsResult> {
    return this.loader.loadCategoryPrompts(configPath);
  }

  /**
   * Convert markdown prompts to JSON structure
   */
  async convertMarkdownPromptsToJson(
    promptsData: PromptData[],
    basePath?: string
  ): Promise<ConvertedPrompt[]> {
    return this.converter.convertMarkdownPromptsToJson(promptsData, basePath);
  }

  /**
   * Process template with text references and special context
   */
  async processTemplateAsync(
    template: string,
    args: Record<string, string>,
    specialContext: Record<string, string> = {},
    toolsEnabled: boolean = false
  ): Promise<string> {
    return this.templateProcessor.processTemplateAsync(
      template,
      args,
      specialContext,
      toolsEnabled
    );
  }

  /**
   * Register prompts with MCP server
   */
  async registerAllPrompts(prompts: ConvertedPrompt[]): Promise<number> {
    if (!this.registry) {
      throw new Error("MCP server not provided - cannot register prompts");
    }
    return this.registry.registerAllPrompts(prompts);
  }

  /**
   * Load and convert prompts in one operation
   */
  async loadAndConvertPrompts(
    configPath: string,
    basePath?: string
  ): Promise<{
    promptsData: PromptData[];
    categories: Category[];
    convertedPrompts: ConvertedPrompt[];
  }> {
    try {
      this.logger.info(`📁 PromptManager: Loading prompts from: ${configPath}`);

      // Verify config path exists
      const fs = await import("fs/promises");
      try {
        const stats = await fs.stat(configPath);
        this.logger.info(
          `✓ Config file found, size: ${
            stats.size
          } bytes, modified: ${stats.mtime.toISOString()}`
        );
      } catch (error) {
        this.logger.error(`✗ Config file access error:`, error);
        throw error;
      }

      this.logger.info("🔄 Calling PromptLoader.loadCategoryPrompts()...");

      // Load the raw prompt data
      const { promptsData, categories } = await this.loadCategoryPrompts(
        configPath
      );

      this.logger.info(
        "✅ PromptLoader.loadCategoryPrompts() completed successfully"
      );
      this.logger.info(
        `📊 Raw data loaded: ${promptsData.length} prompts from ${categories.length} categories`
      );

      // Log detailed breakdown by category
      if (categories.length > 0) {
        this.logger.info("📋 Category breakdown:");
        categories.forEach((category) => {
          const categoryPrompts = promptsData.filter(
            (p) => p.category === category.id
          );
          this.logger.info(
            `   ${category.name} (${category.id}): ${categoryPrompts.length} prompts`
          );
        });
      } else {
        this.logger.warn("⚠️ No categories found in loaded data!");
      }

      if (promptsData.length === 0) {
        this.logger.warn("⚠️ No prompts found in loaded data!");
      }

      this.logger.info("🔄 Converting prompts to JSON structure...");

      // Convert to JSON structure
      const convertedPrompts = await this.convertMarkdownPromptsToJson(
        promptsData,
        basePath
      );

      this.logger.info(
        `✅ Conversion completed: ${convertedPrompts.length} prompts converted`
      );

      if (convertedPrompts.length !== promptsData.length) {
        this.logger.warn(
          `⚠️ Conversion count mismatch! Input: ${promptsData.length}, Output: ${convertedPrompts.length}`
        );
      }

      this.logger.info(
        "🎉 PromptManager.loadAndConvertPrompts() completed successfully"
      );
      return { promptsData, categories, convertedPrompts };
    } catch (error) {
      this.logger.error("❌ PromptManager.loadAndConvertPrompts() FAILED:");
      this.logger.error("Error type:", error?.constructor?.name);
      this.logger.error(
        "Error message:",
        error instanceof Error ? error.message : String(error)
      );
      this.logger.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack trace available"
      );
      throw error;
    }
  }

  /**
   * Complete prompt system initialization
   */
  async initializePromptSystem(
    configPath: string,
    basePath?: string
  ): Promise<{
    promptsData: PromptData[];
    categories: Category[];
    convertedPrompts: ConvertedPrompt[];
    registeredCount: number;
  }> {
    try {
      // Load and convert prompts
      const result = await this.loadAndConvertPrompts(configPath, basePath);

      // Register with MCP server if available
      let registeredCount = 0;
      if (this.registry) {
        registeredCount = await this.registerAllPrompts(
          result.convertedPrompts
        );
      } else {
        this.logger.warn(
          "MCP server not available - skipping prompt registration"
        );
      }

      return { ...result, registeredCount };
    } catch (error) {
      this.logger.error("Error initializing prompt system:", error);
      throw error;
    }
  }

  /**
   * Reload prompts (useful for hot-reloading)
   */
  async reloadPrompts(
    configPath: string,
    basePath?: string
  ): Promise<{
    promptsData: PromptData[];
    categories: Category[];
    convertedPrompts: ConvertedPrompt[];
    registeredCount: number;
  }> {
    this.logger.info("Reloading prompt system...");

    // Unregister existing prompts if registry is available
    if (this.registry) {
      await this.registry.unregisterAllPrompts();
    }

    // Reinitialize the system
    return this.initializePromptSystem(configPath, basePath);
  }

  /**
   * Get all individual module instances for external access
   */
  getModules() {
    return {
      converter: this.converter,
      loader: this.loader,
      registry: this.registry,
      templateProcessor: this.templateProcessor,
    };
  }

  /**
   * Get system statistics
   */
  getStats(prompts?: ConvertedPrompt[]) {
    const stats: any = {
      textReferences: this.textReferenceManager.getStats(),
    };

    if (prompts && this.registry) {
      stats.registration = this.registry.getRegistrationStats(prompts);
      stats.conversation = this.registry.getConversationStats();
    }

    if (prompts && this.converter) {
      stats.conversion = this.converter.getConversionStats(
        prompts.length,
        prompts
      );
    }

    return stats;
  }
}
