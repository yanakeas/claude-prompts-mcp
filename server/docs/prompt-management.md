# Prompt Management Tools

This document describes the tools available for managing prompts in the MCP server.

## Overview

The MCP server provides two tools for managing prompts:

1. `create_category` - Creates a new prompt category
2. `update_prompt` - Creates or updates a prompt

These tools allow you to programmatically manage your prompts without having to manually edit the `prompts.json` file or create prompt files.

## Creating a Category

Before creating prompts, you need to create a category to organize them. Use the `create_category` tool to create a new category:

```javascript
// Example: Creating a new category
const response = await fetch('http://localhost:3000/api/v1/tools/create_category', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'my_category',
    name: 'My Category',
    description: 'A category for my custom prompts'
  })
});

const result = await response.json();
console.log(result);
```

### Parameters

- `id` (string, required) - Unique identifier for the category
- `name` (string, required) - Display name for the category
- `description` (string, required) - Description of the category

## Creating or Updating a Prompt

Use the `update_prompt` tool to create a new prompt or update an existing one:

```javascript
// Example: Creating a new prompt
const response = await fetch('http://localhost:3000/api/v1/tools/update_prompt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'my_prompt',
    name: 'My Prompt',
    category: 'my_category',
    description: 'A custom prompt for my use case',
    systemMessage: 'You are a helpful assistant.',
    userMessageTemplate: 'Hello {{name}}, please help me with {{task}}.',
    arguments: [
      {
        name: 'name',
        description: 'The name to greet',
        required: true
      },
      {
        name: 'task',
        description: 'The task to help with',
        required: true
      }
    ]
  })
});

const result = await response.json();
console.log(result);
```

### Parameters

- `id` (string, required) - Unique identifier for the prompt
- `name` (string, required) - Display name for the prompt
- `category` (string, required) - Category this prompt belongs to (must exist)
- `description` (string, required) - Description of the prompt
- `systemMessage` (string, optional) - System message for the prompt
- `userMessageTemplate` (string, required) - Template for generating the user message
- `arguments` (array, required) - Arguments accepted by this prompt
  - `name` (string, required) - Name of the argument
  - `description` (string, optional) - Description of the argument
  - `required` (boolean, required) - Whether this argument is required
- `isChain` (boolean, optional) - Whether this prompt is a chain of prompts
- `chainSteps` (array, optional) - Steps in the chain if this is a chain prompt
  - `promptId` (string, required) - ID of the prompt to execute in this step
  - `stepName` (string, required) - Name of this step
  - `inputMapping` (object, optional) - Maps chain inputs to this step's inputs
  - `outputMapping` (object, optional) - Maps this step's outputs to chain outputs

## Creating a Chain Prompt

Chain prompts allow you to create a sequence of prompts that are executed in order. Each step in the chain can use the outputs of previous steps as inputs.

```javascript
// Example: Creating a chain prompt
const response = await fetch('http://localhost:3000/api/v1/tools/update_prompt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'my_chain_prompt',
    name: 'My Chain Prompt',
    category: 'my_category',
    description: 'A chain prompt that processes data in multiple steps',
    userMessageTemplate: 'Process the following data: {{data}}',
    arguments: [
      {
        name: 'data',
        description: 'The data to process',
        required: true
      }
    ],
    isChain: true,
    chainSteps: [
      {
        promptId: 'step1_prompt',
        stepName: 'Step 1: Analyze Data',
        inputMapping: {
          "input_data": "data"
        },
        outputMapping: {
          "analysis_result": "step1_result"
        }
      },
      {
        promptId: 'step2_prompt',
        stepName: 'Step 2: Generate Recommendations',
        inputMapping: {
          "analysis": "step1_result"
        },
        outputMapping: {
          "recommendations": "final_recommendations"
        }
      }
    ]
  })
});

const result = await response.json();
console.log(result);
```

## File Structure

When you create a prompt using the `update_prompt` tool, the following happens:

1. A new entry is added to the `prompts.json` file
2. A new markdown file is created in the `prompts/{category}/` directory

The markdown file follows this structure:

```markdown
# Prompt Name

## Description
Prompt description

## System Message
System message content

## User Message Template
User message template content

## Chain Steps (only for chain prompts)

### Step 1: Step Name
Prompt: `prompt_id`
Input Mapping:
```json
{
  "chain_input": "step_input"
}
```
Output Mapping:
```json
{
  "step_output": "chain_output"
}
```
```

## Error Handling

Both tools return a JSON response with the following structure:

- Success:
  ```json
  {
    "content": [
      {
        "type": "text",
        "text": "Success message"
      }
    ]
  }
  ```

- Error:
  ```json
  {
    "content": [
      {
        "type": "text",
        "text": "Error message"
      }
    ],
    "isError": true
  }
  ``` 