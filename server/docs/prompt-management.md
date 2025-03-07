# Prompt Management

This document describes how to manage prompts in the MCP server using the distributed prompts configuration system.

## Distributed Prompts Configuration System

The MCP server now uses a distributed configuration system where prompts are organized by category, with each category having its own configuration file. This makes it easier to manage large numbers of prompts and enables modular organization.

### Key Components

1. **promptsConfig.json** - The main configuration file that defines categories and imports category-specific prompts.json files
2. **Category-specific prompts.json files** - Each category has its own prompts.json file in its directory

## Main Configuration (promptsConfig.json)

The main configuration file defines all available categories and specifies which category-specific prompts.json files to import:

```json
{
  "categories": [
    {
      "id": "general",
      "name": "General",
      "description": "General-purpose prompts for everyday tasks"
    },
    {
      "id": "code",
      "name": "Code",
      "description": "Prompts related to programming and software development"
    },
    // More categories...
  ],
  "imports": [
    "prompts/general/prompts.json",
    "prompts/code/prompts.json",
    "prompts/analysis/prompts.json",
    // More imports...
  ]
}
```

### Categories

Each category in the `categories` array has the following properties:

- `id` (string) - Unique identifier for the category (used in URLs and file paths)
- `name` (string) - Display name for the category
- `description` (string) - Description of what the category is for

### Imports

The `imports` array lists the paths to the category-specific prompts.json files, relative to the server's working directory.

## Category-Specific Prompts Files

Each category has its own prompts.json file in its directory (e.g., `prompts/general/prompts.json`):

```json
{
  "prompts": [
    {
      "id": "friendly_greeting",
      "name": "Friendly Greeting",
      "category": "general",
      "description": "A warm, personalized greeting that makes the user feel welcome and valued.",
      "file": "friendly_greeting.md",
      "arguments": [
        {
          "name": "name",
          "description": "The name of the person to greet",
          "required": false
        }
      ]
    },
    // More prompts...
  ]
}
```

Each prompt in the `prompts` array has:

- `id` (string) - Unique identifier for the prompt
- `name` (string) - Display name for the prompt
- `category` (string) - Category this prompt belongs to
- `description` (string) - Description of what the prompt does
- `file` (string) - Path to the markdown file containing the prompt template, relative to the category directory
- `arguments` (array) - Arguments accepted by the prompt
  - `name` (string) - Name of the argument
  - `description` (string) - Description of the argument
  - `required` (boolean) - Whether this argument is required
- `isChain` (boolean, optional) - Whether this prompt is a chain of prompts
- `chainSteps` (array, optional) - Steps in the chain if this is a chain prompt
- `tools` (boolean, optional) - Whether this prompt should use available tools

## Working with Prompts

### Adding a New Prompt to an Existing Category

1. Create a new markdown file in the appropriate category folder (e.g., `prompts/general/my_prompt.md`)
2. Add the prompt template to the file using markdown format
3. Register the prompt in the category's prompts.json file (e.g., `prompts/general/prompts.json`)

### Creating a New Category

1. Create a new folder in the `prompts` directory for your category (e.g., `prompts/mycategory/`)
2. Create a `prompts.json` file in the new category folder with the following structure:
   ```json
   {
     "prompts": []
   }
   ```
3. Add your category to the `categories` array in `promptsConfig.json`
4. Add the path to your category's prompts.json file to the `imports` array in `promptsConfig.json`

## Programmatic Management Tools

The MCP server provides tools for programmatically managing prompts:

1. `create_category` - Creates a new prompt category
2. `update_prompt` - Creates or updates a prompt
3. `delete_prompt` - Deletes a prompt

These tools allow you to manage your prompts without having to manually edit the configuration files.

### Creating a Category

Use the `create_category` tool to create a new category:

```javascript
// Example: Creating a new category
const response = await fetch('http://localhost:9090/api/v1/tools/create_category', {
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

#### Parameters

- `id` (string, required) - Unique identifier for the category
- `name` (string, required) - Display name for the category
- `description` (string, required) - Description of the category

### Creating or Updating a Prompt

Use the `update_prompt` tool to create a new prompt or update an existing one:

```javascript
// Example: Creating a new prompt
const response = await fetch('http://localhost:9090/api/v1/tools/update_prompt', {
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

#### Parameters

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

### Creating a Chain Prompt

Chain prompts allow you to create a sequence of prompts that are executed in order. Each step in the chain can use the outputs of previous steps as inputs.

```javascript
// Example: Creating a chain prompt
const response = await fetch('http://localhost:9090/api/v1/tools/update_prompt', {
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

1. A new entry is added to the appropriate category's prompts.json file
2. A new markdown file is created in the corresponding category directory (e.g., `prompts/my_category/my_prompt.md`)

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

1. promptId: prompt_id
   stepName: Step Name
   inputMapping:
     chain_input: step_input
   outputMapping:
     step_output: chain_output
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