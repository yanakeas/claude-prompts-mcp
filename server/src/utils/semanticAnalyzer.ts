/**
 * Semantic Analyzer Module
 * Intelligent content-based detection of prompt types and execution requirements
 * Replaces header-based detection with semantic analysis
 */

import { ConvertedPrompt } from "../types/index.js";

export type ExecutionType = "template" | "workflow" | "chain" | "auto";
export type PromptClassification = {
  executionType: ExecutionType;
  requiresExecution: boolean;
  confidence: number;
  reasoning: string[];
  suggestedGates: string[];
};

/**
 * Semantic Analyzer for intelligent prompt classification
 */
export class SemanticAnalyzer {
  
  /**
   * Analyze a prompt and classify its execution requirements
   */
  analyzePrompt(prompt: ConvertedPrompt): PromptClassification {
    const reasoning: string[] = [];
    let executionType: ExecutionType = "template";
    let requiresExecution = false;
    let confidence = 0;
    const suggestedGates: string[] = [];

    // Step 1: Check if it's explicitly a chain
    if (prompt.isChain) {
      executionType = "chain";
      requiresExecution = true;
      confidence = 1.0;
      reasoning.push("Explicitly defined as a chain prompt");
      suggestedGates.push("step_completion", "content_quality");
      
      return {
        executionType,
        requiresExecution,
        confidence,
        reasoning,
        suggestedGates
      };
    }

    // Step 2: Semantic analysis of content
    const contentAnalysis = this.analyzeContent(prompt.userMessageTemplate, prompt.systemMessage);
    
    // Step 3: Structural analysis
    const structuralAnalysis = this.analyzeStructure(prompt);
    
    // Step 4: Combine analyses
    const combinedAnalysis = this.combineAnalyses(contentAnalysis, structuralAnalysis);
    
    return {
      executionType: combinedAnalysis.executionType,
      requiresExecution: combinedAnalysis.requiresExecution,
      confidence: combinedAnalysis.confidence,
      reasoning: combinedAnalysis.reasoning,
      suggestedGates: combinedAnalysis.suggestedGates
    };
  }

  /**
   * Analyze the semantic content of the prompt
   */
  private analyzeContent(userTemplate: string, systemMessage?: string): Partial<PromptClassification> {
    const reasoning: string[] = [];
    const suggestedGates: string[] = [];
    let executionType: ExecutionType = "template";
    let requiresExecution = false;
    let confidence = 0;

    const combinedText = `${systemMessage || ""} ${userTemplate}`.toLowerCase();

    // Analysis patterns
    const patterns = {
      // Workflow indicators (high confidence)
      workflowPatterns: [
        /(?:follow|execute|perform|carry out|implement).*(?:steps?|process|workflow|procedure)/,
        /(?:step\s*(?:by\s*step|1|one)|systematic(?:ally)?|methodical(?:ly)?)/,
        /(?:analyze|review|examine|process).*(?:using|following|with).*(?:framework|methodology|approach)/,
        /(?:break\s*down|structure|organize).*(?:analysis|approach|method)/
      ],
      
      // Instruction generators (high confidence)
      instructionPatterns: [
        /(?:provide|give|create|generate).*(?:instructions|steps|guidance|procedure)/,
        /(?:how to|guide for|approach to).*(?:implement|execute|perform|carry out)/,
        /(?:template for|framework for|structure for)/,
        /(?:outline|plan).*(?:approach|strategy|method)/
      ],
      
      // Direct action indicators (medium confidence)
      actionPatterns: [
        /(?:please|kindly)?\s*(?:analyze|review|examine|evaluate|assess|investigate)/,
        /(?:identify|find|determine|discover|locate)/,
        /(?:compare|contrast|differentiate|distinguish)/,
        /(?:summarize|explain|describe|detail)/
      ],
      
      // Template/info indicators (low execution probability)
      templatePatterns: [
        /(?:show|display|list|return).*(?:information|details|data)/,
        /(?:what is|what are|define|definition of)/,
        /(?:example of|sample|template|format)/
      ]
    };

    // Check workflow patterns (highest priority)
    for (const pattern of patterns.workflowPatterns) {
      if (pattern.test(combinedText)) {
        executionType = "workflow";
        requiresExecution = true;
        confidence = Math.max(confidence, 0.9);
        reasoning.push(`Workflow pattern detected: ${pattern.source}`);
        suggestedGates.push("content_validation", "structured_format");
      }
    }

    // Check instruction generation patterns
    for (const pattern of patterns.instructionPatterns) {
      if (pattern.test(combinedText)) {
        executionType = "workflow";
        requiresExecution = true;
        confidence = Math.max(confidence, 0.8);
        reasoning.push(`Instruction generation pattern detected: ${pattern.source}`);
        suggestedGates.push("content_quality", "keyword_presence");
      }
    }

    // Check action patterns
    for (const pattern of patterns.actionPatterns) {
      if (pattern.test(combinedText)) {
        if (executionType === "template") {
          executionType = "workflow";
          requiresExecution = true;
          confidence = Math.max(confidence, 0.6);
          reasoning.push(`Action pattern detected: ${pattern.source}`);
          suggestedGates.push("content_length");
        }
      }
    }

    // Check template patterns (reduce execution likelihood)
    for (const pattern of patterns.templatePatterns) {
      if (pattern.test(combinedText)) {
        confidence = Math.max(0, confidence - 0.3);
        reasoning.push(`Template pattern detected, reducing execution confidence: ${pattern.source}`);
      }
    }

    return {
      executionType,
      requiresExecution,
      confidence,
      reasoning,
      suggestedGates
    };
  }

  /**
   * Analyze the structural characteristics of the prompt
   */
  private analyzeStructure(prompt: ConvertedPrompt): Partial<PromptClassification> {
    const reasoning: string[] = [];
    const suggestedGates: string[] = [];
    let confidence = 0;
    let requiresExecution = false;

    // Analyze complexity indicators
    const userTemplate = prompt.userMessageTemplate;
    const argumentCount = prompt.arguments.length;
    
    // Multiple arguments suggest complex processing
    if (argumentCount > 2) {
      confidence += 0.2;
      requiresExecution = true;
      reasoning.push(`Multiple arguments (${argumentCount}) suggest complex processing`);
      suggestedGates.push("content_validation");
    }

    // Template complexity analysis
    const placeholderCount = (userTemplate.match(/\{\{[^}]+\}\}/g) || []).length;
    if (placeholderCount > 3) {
      confidence += 0.15;
      reasoning.push(`High placeholder count (${placeholderCount}) indicates dynamic content generation`);
    }

    // Conditional logic in templates
    if (userTemplate.includes('{% if') || userTemplate.includes('{% for')) {
      confidence += 0.25;
      requiresExecution = true;
      reasoning.push("Conditional templating logic detected");
      suggestedGates.push("structured_format");
    }

    // Length and complexity
    if (userTemplate.length > 500) {
      confidence += 0.1;
      reasoning.push("Long template suggests complex processing requirements");
    }

    return {
      requiresExecution,
      confidence,
      reasoning,
      suggestedGates
    };
  }

  /**
   * Combine content and structural analyses
   */
  private combineAnalyses(
    contentAnalysis: Partial<PromptClassification>,
    structuralAnalysis: Partial<PromptClassification>
  ): PromptClassification {
    
    // Combine confidence scores
    const combinedConfidence = Math.min(1.0, 
      (contentAnalysis.confidence || 0) + (structuralAnalysis.confidence || 0)
    );

    // Determine final execution type
    let finalExecutionType: ExecutionType = contentAnalysis.executionType || "template";
    
    // Determine if execution is required
    const finalRequiresExecution = 
      (contentAnalysis.requiresExecution || false) || 
      (structuralAnalysis.requiresExecution || false);

    // If execution is required but type is still template, upgrade to workflow
    if (finalRequiresExecution && finalExecutionType === "template") {
      finalExecutionType = "workflow";
    }

    // Combine reasoning
    const combinedReasoning = [
      ...(contentAnalysis.reasoning || []),
      ...(structuralAnalysis.reasoning || [])
    ];

    // Combine suggested gates
    const combinedGates = Array.from(new Set([
      ...(contentAnalysis.suggestedGates || []),
      ...(structuralAnalysis.suggestedGates || [])
    ]));

    return {
      executionType: finalExecutionType,
      requiresExecution: finalRequiresExecution,
      confidence: combinedConfidence,
      reasoning: combinedReasoning,
      suggestedGates: combinedGates
    };
  }

  /**
   * Get human-readable analysis summary
   */
  getAnalysisSummary(classification: PromptClassification): string {
    const confidence = Math.round(classification.confidence * 100);
    
    let summary = `🧠 **Semantic Analysis**: ${classification.executionType} (${confidence}% confidence)\n`;
    summary += `⚡ **Execution Required**: ${classification.requiresExecution ? 'Yes' : 'No'}\n`;
    
    if (classification.suggestedGates.length > 0) {
      summary += `🛡️ **Suggested Gates**: ${classification.suggestedGates.join(', ')}\n`;
    }
    
    if (classification.reasoning.length > 0) {
      summary += `📝 **Analysis Reasoning**:\n`;
      classification.reasoning.forEach((reason, index) => {
        summary += `   ${index + 1}. ${reason}\n`;
      });
    }
    
    return summary;
  }
}