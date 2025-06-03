/**
 * Template Processor Module
 * Handles template processing with text references, validation, and placeholder extraction
 */

import { Logger } from "../logging/index.js";
import { TextReferenceManager } from "../text-references/index.js";
import { getAvailableTools } from "../utils/index.js";
import { processTemplate as originalProcessTemplate } from "../utils/jsonUtils.js";

/**
 * Template Processor class
 */
export class TemplateProcessor {
  private logger: Logger;
  private textReferenceManager: TextReferenceManager;

  constructor(logger: Logger, textReferenceManager: TextReferenceManager) {
    this.logger = logger;
    this.textReferenceManager = textReferenceManager;
  }

  /**
   * Process template asynchronously with text reference support
   */
  async processTemplateAsync(
    template: string,
    args: Record<string, string>,
    specialContext: Record<string, string> = {},
    toolsEnabled: boolean = false
  ): Promise<string> {
    try {
      // First, store any long text arguments as references
      const processedArgs = { ...args };
      for (const [key, value] of Object.entries(processedArgs)) {
        if (value && value.length > 500) {
          // Store texts longer than 500 characters as references
          processedArgs[key] =
            await this.textReferenceManager.storeTextReference(value);
        }
      }

      // Add tools_available to specialContext if tools are enabled
      const enhancedSpecialContext = { ...specialContext };
      if (toolsEnabled) {
        enhancedSpecialContext["tools_available"] = getAvailableTools();
      }

      // Process the template with the modified arguments
      let processedTemplate = originalProcessTemplate(
        template,
        processedArgs,
        enhancedSpecialContext
      );

      // Replace any reference placeholders with their content
      processedTemplate =
        this.textReferenceManager.processTemplateReferences(processedTemplate);

      return processedTemplate;
    } catch (error) {
      this.logger.error("Error processing template async:", error);
      throw error;
    }
  }

  /**
   * Process template synchronously (no text reference storage)
   */
  processTemplateSync(
    template: string,
    args: Record<string, string>,
    specialContext: Record<string, string> = {},
    toolsEnabled: boolean = false
  ): string {
    try {
      // Add tools_available to specialContext if tools are enabled
      const enhancedSpecialContext = { ...specialContext };
      if (toolsEnabled) {
        enhancedSpecialContext["tools_available"] = getAvailableTools();
      }

      // Process the template with the arguments directly
      let processedTemplate = originalProcessTemplate(
        template,
        args,
        enhancedSpecialContext
      );

      // Replace any reference placeholders with their content
      processedTemplate =
        this.textReferenceManager.processTemplateReferences(processedTemplate);

      return processedTemplate;
    } catch (error) {
      this.logger.error("Error processing template sync:", error);
      throw error;
    }
  }

  /**
   * Extract placeholders from a template
   */
  extractPlaceholders(template: string): string[] {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = placeholderRegex.exec(template)) !== null) {
      const placeholder = match[1].trim();
      if (!placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }

    return placeholders;
  }

  /**
   * Validate template against provided arguments
   *
   * @remarks
   * Current validation relies on regex-based placeholder extraction (`extractPlaceholders`).
   * This means it will accurately identify orphaned/unused arguments for simple `{{placeholder}}` syntax.
   * However, it will NOT detect variables used only within Nunjucks tags (e.g., `{% if my_var %}`)
   * or arguments used only within Nunjucks logic blocks. True Nunjucks AST-based validation
   * would be needed for comprehensive analysis and is a potential future enhancement (Phase 4+).
   */
  validateTemplate(
    template: string,
    argumentNames: string[]
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    orphanedPlaceholders: string[];
    unusedArguments: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!template || typeof template !== "string") {
      errors.push("Template must be a non-empty string");
      return {
        isValid: false,
        errors,
        warnings,
        orphanedPlaceholders: [],
        unusedArguments: argumentNames,
      };
    }

    const placeholders = this.extractPlaceholders(template);

    // Find placeholders that don't have corresponding arguments
    const orphanedPlaceholders = placeholders.filter(
      (placeholder) =>
        !argumentNames.includes(placeholder) &&
        !this.isSpecialPlaceholder(placeholder)
    );

    // Find arguments that aren't used in the template
    const unusedArguments = argumentNames.filter(
      (argName) => !placeholders.includes(argName)
    );

    if (orphanedPlaceholders.length > 0) {
      warnings.push(
        `Template has placeholders without arguments: ${orphanedPlaceholders.join(
          ", "
        )}`
      );
    }

    if (unusedArguments.length > 0) {
      warnings.push(
        `Arguments not used in template: ${unusedArguments.join(", ")}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      orphanedPlaceholders,
      unusedArguments,
    };
  }

  /**
   * Check if a placeholder is a special system placeholder
   */
  private isSpecialPlaceholder(placeholder: string): boolean {
    const specialPlaceholders = [
      "previous_message",
      "tools_available",
      "current_step_number",
      "total_steps",
      "current_step_name",
      "step_number",
      "step_name",
    ];

    return (
      specialPlaceholders.includes(placeholder) ||
      placeholder.startsWith("ref:")
    );
  }

  /**
   * Process template with special context for conversation history
   */
  async processTemplateWithContext(
    template: string,
    args: Record<string, string>,
    contextProvider: () => string,
    toolsEnabled: boolean = false
  ): Promise<string> {
    const specialContext = {
      previous_message: contextProvider(),
    };

    return this.processTemplateAsync(
      template,
      args,
      specialContext,
      toolsEnabled
    );
  }

  /**
   * Get template processing statistics
   */
  getTemplateStats(template: string): {
    totalLength: number;
    placeholderCount: number;
    uniquePlaceholders: string[];
    specialPlaceholders: string[];
    argumentPlaceholders: string[];
  } {
    const placeholders = this.extractPlaceholders(template);
    const specialPlaceholders = placeholders.filter((p) =>
      this.isSpecialPlaceholder(p)
    );
    const argumentPlaceholders = placeholders.filter(
      (p) => !this.isSpecialPlaceholder(p)
    );

    return {
      totalLength: template.length,
      placeholderCount: placeholders.length,
      uniquePlaceholders: placeholders,
      specialPlaceholders,
      argumentPlaceholders,
    };
  }

  /**
   * Preview template processing without actually storing text references
   */
  previewTemplate(
    template: string,
    args: Record<string, string>,
    specialContext: Record<string, string> = {},
    toolsEnabled: boolean = false
  ): {
    processedTemplate: string;
    longTextArguments: string[];
    placeholdersUsed: string[];
  } {
    const longTextArguments: string[] = [];

    // Identify long text arguments that would be stored as references
    for (const [key, value] of Object.entries(args)) {
      if (value && value.length > 500) {
        longTextArguments.push(key);
      }
    }

    // Process template without storing references
    const enhancedSpecialContext = { ...specialContext };
    if (toolsEnabled) {
      enhancedSpecialContext["tools_available"] = getAvailableTools();
    }

    const processedTemplate = originalProcessTemplate(
      template,
      args,
      enhancedSpecialContext
    );

    const placeholdersUsed = this.extractPlaceholders(template);

    return {
      processedTemplate,
      longTextArguments,
      placeholdersUsed,
    };
  }
}
