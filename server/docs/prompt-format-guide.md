# Prompt Format Guide

This document explains the format and structure of prompts in the Claude Custom Prompts server.

## Prompt File Structure

Prompts are stored as markdown files with a specific structure. Each prompt file must include certain sections, and may optionally include others.

### Basic Structure

```markdown
# Prompt Title

Brief description of what the prompt does.

## System Message

System instructions for Claude.

## User Message Template

Template for the user message with {{placeholders}}.

## Arguments

- argument1: Description of the first argument
- argument2: Description of the second argument
```

### Required Sections

1. **Title** (Level 1 Heading): The name of the prompt
2. **Description** (Text after title): Brief explanation of the prompt's purpose
3. **User Message Template** (Level 2 Heading): The template for the user message with placeholders

### Optional Sections

1. **System Message** (Level 2 Heading): Instructions for Claude's behavior
2. **Arguments** (Level 2 Heading): Definitions of arguments used in the template
3. **Chain Steps** (Level 2 Heading): For chain prompts, defines the steps in the chain

## Placeholders and Arguments

Placeholders in templates are denoted by double curly braces: `{{argument_name}}`.

### Argument Definition

Arguments are defined in the Arguments section as a list:

```markdown
## Arguments

- argument_name: Description of the argument
- another_argument: Description of another argument (optional)
```

Each argument can be marked as required or optional in its description.

### Special Placeholders

The system supports several special placeholders:

- `{{previous_message}}`: Inserts the previous message from the conversation
- `{{conversation_history}}`: Inserts the entire conversation history
- `{{current_date}}`: Inserts the current date
- `{{current_time}}`: Inserts the current time

## Example Prompt

```markdown
# Code Review

This prompt helps Claude review code and provide feedback.

## System Message

You are an expert code reviewer with deep knowledge of software engineering principles and best practices. Your task is to review code snippets and provide constructive feedback.

## User Message Template

Please review the following {{language}} code:

```{{language}}
{{code}}
```

Focus on:
- Code quality
- Potential bugs
- Performance issues
- Security concerns
- Readability and maintainability

{{#if best_practices}}
Also check for adherence to {{language}} best practices.
{{/if}}

## Arguments

- language: The programming language of the code (e.g., JavaScript, Python, etc.)
- code: The code snippet to review
- best_practices: Whether to check for language-specific best practices (optional)
```

## Chain Prompt Format

Chain prompts include an additional section that defines the steps in the chain:

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

Each step includes:
1. **promptId**: The ID of the prompt to execute
2. **stepName**: A descriptive name for the step
3. **inputMapping**: How to map chain inputs to step inputs
4. **outputMapping**: How to map step outputs to chain outputs

## Conditional Logic

The template system supports basic conditional logic using Handlebars-style syntax:

```
{{#if condition}}
  Content to include if condition is true
{{else}}
  Content to include if condition is false
{{/if}}
```

## File Organization

Prompts are organized in directories by category:

```
prompts/
  category1/
    prompt1.md
    prompt2.md
  category2/
    prompt3.md
    prompt4.md
```

The category is determined by the directory name.

## Prompt IDs

Prompt IDs are generated based on the file path and name:

- For a file at `prompts/category/file.md`, the ID would be `category/file`
- IDs are used to reference prompts in API calls and chain definitions

## Best Practices

1. **Clear Descriptions**: Provide clear descriptions of what the prompt does
2. **Descriptive Arguments**: Clearly describe each argument and whether it's required
3. **Organized Structure**: Use consistent formatting and organization
4. **Meaningful Names**: Use descriptive names for prompts and arguments
5. **Documentation**: Include examples and usage notes where helpful
6. **Testing**: Test prompts with various inputs to ensure they work as expected

## Common Issues

### Missing Placeholders

If a placeholder in the template doesn't have a corresponding argument, it will remain as is in the output.

### Invalid Markdown

If the markdown structure is invalid (missing sections, incorrect headings), the prompt may not load correctly.

### Circular References

In chain prompts, avoid circular references where prompts depend on each other in a loop.

## Advanced Usage

### Multi-paragraph Arguments

For arguments that may contain multiple paragraphs, use triple backticks in the template:

```markdown
## User Message Template

Please analyze the following text:

```
{{long_text}}
```

## Arguments

- long_text: A potentially long text that may contain multiple paragraphs
```

### Dynamic Templates

You can create dynamic templates that adapt based on the provided arguments:

```markdown
## User Message Template

{{#if detailed}}
Please provide a detailed analysis of {{topic}}, covering all aspects in depth.
{{else}}
Please provide a brief overview of {{topic}}, highlighting only the key points.
{{/if}}

## Arguments

- topic: The subject to analyze
- detailed: Whether to provide a detailed analysis (true/false)
``` 