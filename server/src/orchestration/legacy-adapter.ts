/**
 * Legacy Adapter Module
 * Provides backwards compatibility for legacy functions and gradual migration path
 */

import path from "path";
import { ConfigManager } from "../config/index.js";
import { Logger } from "../logging/index.js";
import { McpToolsManager } from "../mcp-tools/index.js";
import { PromptManager } from "../prompts/index.js";
import { TextReferenceManager } from "../text-references/index.js";
import { Category, ConvertedPrompt, PromptData } from "../types/index.js";
import { ConversationManager } from "./conversation-manager.js";
import { PromptExecutor } from "./prompt-executor.js";

/**
 * Legacy Adapter class
 * Handles migration of legacy functions and provides backward compatibility
 */
export class LegacyAdapter {
  private logger: Logger;
  private configManager: ConfigManager;
  private promptManager: PromptManager;
  private textReferenceManager: TextReferenceManager;
  private mcpToolsManager?: McpToolsManager;
  private conversationManager: ConversationManager;
  private promptExecutor: PromptExecutor;

  constructor(
    logger: Logger,
    configManager: ConfigManager,
    promptManager: PromptManager,
    textReferenceManager: TextReferenceManager,
    conversationManager: ConversationManager,
    promptExecutor: PromptExecutor,
    mcpToolsManager?: McpToolsManager
  ) {
    this.logger = logger;
    this.configManager = configManager;
    this.promptManager = promptManager;
    this.textReferenceManager = textReferenceManager;
    this.conversationManager = conversationManager;
    this.promptExecutor = promptExecutor;
    this.mcpToolsManager = mcpToolsManager;
  }

  /**
   * Legacy: Clear require cache (deprecated - using ES modules now)
   */
  clearRequireCache(): void {
    this.logger.warn(
      "clearRequireCache is deprecated with ES modules - cache clearing not needed"
    );
  }

  /**
   * Legacy: Reload prompts data
   */
  async reloadPrompts(): Promise<{
    promptsData: PromptData[];
    categories: Category[];
    convertedPrompts: ConvertedPrompt[];
  }> {
    try {
      const config = this.configManager.getConfig();

      // ENHANCED: Use same path resolution logic as orchestration module
      // This ensures refresh operations also respect MCP_PROMPTS_CONFIG_PATH environment variable
      let PROMPTS_FILE: string;

      if (process.env.MCP_PROMPTS_CONFIG_PATH) {
        PROMPTS_FILE = process.env.MCP_PROMPTS_CONFIG_PATH;
        this.logger.info(
          "🎯 Reload: Using MCP_PROMPTS_CONFIG_PATH environment variable override"
        );
      } else {
        // Fallback to ConfigManager's getPromptsFilePath() method which handles server root properly
        PROMPTS_FILE = this.configManager.getPromptsFilePath();
        this.logger.info(
          "📁 Reload: Using config-based prompts file path resolution"
        );
      }

      // Ensure absolute path (critical for Claude Desktop)
      if (!path.isAbsolute(PROMPTS_FILE)) {
        PROMPTS_FILE = path.resolve(PROMPTS_FILE);
        this.logger.info(
          `🔧 Reload: Converted to absolute path: ${PROMPTS_FILE}`
        );
      }

      this.logger.info(`📖 Reload: Loading prompts from: ${PROMPTS_FILE}`);

      const result = await this.promptManager.loadAndConvertPrompts(
        PROMPTS_FILE
      );
      return result;
    } catch (error) {
      this.logger.error("Error reloading prompts:", error);
      throw error;
    }
  }

  /**
   * Legacy: Re-register all prompts
   */
  async reRegisterAllPrompts(prompts: ConvertedPrompt[]): Promise<void> {
    try {
      if (this.promptManager) {
        await this.promptManager.registerAllPrompts(prompts);
      }
    } catch (error) {
      this.logger.error("Error re-registering prompts:", error);
      throw error;
    }
  }

  /**
   * Legacy: Full server refresh
   */
  async fullServerRefresh(): Promise<void> {
    try {
      this.logger.info("Performing full server refresh...");
      const result = await this.reloadPrompts();
      await this.reRegisterAllPrompts(result.convertedPrompts);

      // Update prompt executor with new prompts
      this.promptExecutor.updatePrompts(result.convertedPrompts);

      // Update MCP tools manager if available
      if (this.mcpToolsManager) {
        this.mcpToolsManager.updateData(
          result.promptsData,
          result.convertedPrompts,
          result.categories
        );
      }

      this.logger.info("Full server refresh completed successfully");
    } catch (error) {
      this.logger.error("Error during full server refresh:", error);
      throw error;
    }
  }

  /**
   * Legacy: Trigger server refresh
   */
  async triggerServerRefresh(
    restart: boolean = false,
    reason: string = ""
  ): Promise<void> {
    try {
      await this.fullServerRefresh();
      if (restart) {
        await this.handleServerRestart(reason);
      }
    } catch (error) {
      this.logger.error("Error triggering server refresh:", error);
      throw error;
    }
  }

  /**
   * Legacy: Handle server restart
   */
  async handleServerRestart(reason: string): Promise<void> {
    try {
      this.logger.info(`Initiating server restart: ${reason}`);
      setTimeout(() => {
        if (process.send) {
          process.send("restart");
        } else {
          process.exit(100);
        }
      }, 1000);
    } catch (error) {
      this.logger.error("Error in handleServerRestart:", error);
      throw error;
    }
  }

  /**
   * Legacy: Generate title for text (now uses TextReferenceManager)
   */
  async generateTextTitle(text: string): Promise<string> {
    this.logger.warn(
      "generateTextTitle is deprecated - TextReferenceManager handles title generation internally"
    );
    // Since generateTextTitle is private, we'll create a simple title here
    const title = text.substring(0, 50).trim();
    return title || `Text_${Date.now()}`;
  }

  /**
   * Legacy: Store text reference (now uses TextReferenceManager)
   */
  async storeTextReference(text: string): Promise<string> {
    this.logger.warn(
      "storeTextReference is deprecated - use TextReferenceManager.storeTextReference instead"
    );
    return this.textReferenceManager.storeTextReference(text);
  }

  /**
   * Legacy: Get text reference (now uses TextReferenceManager)
   */
  getTextReference(refId: string): string | null {
    this.logger.warn(
      "getTextReference is deprecated - use TextReferenceManager.getTextReference instead"
    );
    return this.textReferenceManager.getTextReference(refId);
  }

  /**
   * Legacy: Process template async (now uses PromptManager)
   */
  async processTemplateAsync(
    template: string,
    args: Record<string, string>,
    specialContext: Record<string, string> = {},
    toolsEnabled: boolean = false
  ): Promise<string> {
    this.logger.warn(
      "processTemplateAsync is deprecated - use PromptManager.processTemplateAsync instead"
    );
    return this.promptManager.processTemplateAsync(
      template,
      args,
      specialContext,
      toolsEnabled
    );
  }

  /**
   * Legacy: Run prompt directly (now uses PromptExecutor)
   */
  async runPromptDirectly(
    promptId: string,
    parsedArgs: Record<string, string>
  ): Promise<string> {
    this.logger.warn(
      "runPromptDirectly is deprecated - use PromptExecutor.runPromptDirectly instead"
    );
    return this.promptExecutor.runPromptDirectly(promptId, parsedArgs);
  }

  /**
   * Legacy: Execute prompt chain (now uses PromptExecutor)
   */
  async executePromptChain(
    chainPromptId: string,
    inputArgs: Record<string, string> = {}
  ): Promise<{
    results: Record<string, string>;
    messages: {
      role: "user" | "assistant";
      content: { type: "text"; text: string };
    }[];
  }> {
    this.logger.warn(
      "executePromptChain is deprecated - use PromptExecutor.executePromptChain instead"
    );
    return this.promptExecutor.executePromptChain(chainPromptId, inputArgs);
  }

  /**
   * Get available tools as formatted string (legacy helper)
   */
  getAvailableTools(): string {
    return `You have access to a set of tools to help solve tasks.
Use the following format to utilize these tools:

<tool_calls>
<tool_call name="TOOL_NAME">
<tool_parameters>
PARAMETERS_IN_JSON_FORMAT
</tool_parameters>
</tool_call>
</tool_calls>

Always check if a tool is appropriate for the task at hand before using it.
Use tools only when necessary to complete the task.`;
  }
}

/**
 * Create and configure a legacy adapter
 */
export function createLegacyAdapter(
  logger: Logger,
  configManager: ConfigManager,
  promptManager: PromptManager,
  textReferenceManager: TextReferenceManager,
  conversationManager: ConversationManager,
  promptExecutor: PromptExecutor,
  mcpToolsManager?: McpToolsManager
): LegacyAdapter {
  return new LegacyAdapter(
    logger,
    configManager,
    promptManager,
    textReferenceManager,
    conversationManager,
    promptExecutor,
    mcpToolsManager
  );
}
