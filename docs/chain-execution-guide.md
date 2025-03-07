# Chain Execution Guide

This document provides a detailed explanation of how prompt chains work in the Claude Custom Prompts server.

## What are Prompt Chains?

Prompt chains allow you to create multi-step prompt workflows where the output of one prompt becomes the input for subsequent prompts. This enables complex reasoning, multi-stage processing, and more sophisticated interactions with Claude AI models.

## Chain Structure

A chain prompt is defined with the following components:

1. **Chain Definition**: A prompt marked as `isChain: true` in its metadata
2. **Chain Steps**: An ordered array of steps, each referencing another prompt
3. **Input Mapping**: For each step, defines how chain inputs map to step inputs
4. **Output Mapping**: For each step, defines how step outputs map to chain outputs

### Example Chain Structure

```markdown
## Chain Steps

1. promptId: first-step-prompt
   stepName: Initial Analysis
   inputMapping:
     topic: input_topic
   outputMapping:
     keyPoints: analysis_results

2. promptId: second-step-prompt
   stepName: Detailed Exploration
   inputMapping:
     analysisResults: analysis_results
     depth: exploration_depth
   outputMapping:
     detailedFindings: detailed_results
```

## How Chain Execution Works

The chain execution process is handled by the `executePromptChain` function (Line ~486) and follows these steps:

1. **Chain Initialization**:
   - Load the chain prompt definition
   - Validate that it's a valid chain
   - Initialize the chain execution state

2. **Step Execution**:
   - For each step in the chain:
     - Map chain inputs to step inputs using the input mapping
     - Execute the step's prompt with the mapped inputs
     - Map step outputs to chain outputs using the output mapping
     - Store the results for use in subsequent steps

3. **Result Collection**:
   - Collect all outputs from all steps
   - Return the final results and conversation messages

## Chain Execution State

The `ChainExecutionState` interface (Line ~657) tracks the progress of a chain execution:

```typescript
interface ChainExecutionState {
  chainId: string;            // ID of the chain being executed
  currentStepIndex: number;   // Current step index (0-based)
  totalSteps: number;         // Total number of steps in the chain
  stepResults: Record<string, string>; // Results from previous steps
  startTime: number;          // Timestamp when execution started
}
```

## Input and Output Mapping

### Input Mapping

Input mapping defines how values from the chain's inputs and previous steps' outputs are passed to the current step:

```
inputMapping: {
  targetParam: sourceParam
}
```

Where:
- `targetParam` is the parameter name expected by the step prompt
- `sourceParam` is either:
  - A chain input parameter name
  - An output parameter name from a previous step

### Output Mapping

Output mapping defines how the step's outputs are stored for use in subsequent steps or as final chain outputs:

```
outputMapping: {
  sourceOutput: targetChainParam
}
```

Where:
- `sourceOutput` is the output parameter name from the step prompt
- `targetChainParam` is the parameter name to store the value under in the chain's results

## Creating a Chain Prompt

To create a chain prompt:

1. Create a markdown file with the standard prompt sections
2. Add a `## Chain Steps` section with numbered steps
3. For each step, specify:
   - `promptId`: The ID of the prompt to execute
   - `stepName`: A descriptive name for the step
   - `inputMapping`: How to map inputs to this step
   - `outputMapping`: How to map outputs from this step

## Example: Deep Research Chain

The Deep Research Chain is an example of a complex chain that processes research topics through six stages:

1. Initial Topic Exploration
2. Research Planning
3. Deep Information Gathering
4. Critical Analysis
5. Synthesis and Integration
6. Research Report Generation

Each step builds on the results of previous steps, creating a comprehensive research workflow.

## Debugging Chain Execution

When debugging chain execution issues:

1. **Check Step Order**: Ensure steps are in the correct logical order
2. **Verify Prompt IDs**: Confirm all referenced prompts exist
3. **Review Mappings**: Ensure input and output mappings are correctly defined
4. **Examine Step Results**: Check intermediate results between steps
5. **Validate Arguments**: Ensure all required arguments are provided

## Best Practices

1. **Step Naming**: Use clear, descriptive names for each step
2. **Consistent Parameter Names**: Use consistent naming conventions for parameters
3. **Documentation**: Document the purpose and expected inputs/outputs of each step
4. **Error Handling**: Include error handling in chain prompts
5. **Testing**: Test each step individually before combining into a chain

## Advanced Techniques

### Conditional Chains

You can implement conditional logic in chains by:
1. Having steps output decision parameters
2. Using those parameters in subsequent step prompts to guide processing

### Recursive Chains

For iterative processing, you can create chains that:
1. Process a batch of data
2. Determine if more processing is needed
3. Call themselves again with updated parameters if necessary

## Limitations

1. **Error Propagation**: Errors in early steps affect all subsequent steps
2. **Debugging Complexity**: Multi-step chains can be difficult to debug
3. **Performance**: Each step adds processing time
4. **Context Limits**: Long chains may exceed Claude's context window 