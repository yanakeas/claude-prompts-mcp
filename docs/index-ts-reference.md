# index.ts Reference Documentation

This document provides a comprehensive reference for the main functions and components in the `index.ts` file, which serves as the core of the Claude Custom Prompts server.

## Table of Contents

1. [Configuration and Setup](#configuration-and-setup)
2. [Logging Functions](#logging-functions)
3. [Prompt Management](#prompt-management)
4. [Conversation History](#conversation-history)
5. [Error Handling](#error-handling)
6. [Prompt Execution](#prompt-execution)
7. [Chain Execution](#chain-execution)
8. [API Endpoints](#api-endpoints)
9. [MCP Tool Handlers](#mcp-tool-handlers)

## Configuration and Setup

The server configuration is loaded from `config.json` and can be overridden by environment variables.

### Key Configuration Functions

- **loadConfig()**: Loads the server configuration from `config.json` and applies environment variable overrides
- **initLogFile()**: Initializes the log file based on configuration settings
- **setupServer()**: Sets up the Express server and configures middleware

## Logging Functions

The server includes a robust logging system that writes to both console and file.

### Key Logging Functions

- **initLogFile()** (Line ~124): Initializes the log file for the current session
- **logToFile(level, message, ...args)** (Line ~134): Writes log entries to the configured log file
- **log.info(), log.warn(), log.error(), log.debug()**: Convenience methods for different log levels

## Prompt Management

Functions for loading, parsing, and managing prompt templates.

### Key Prompt Management Functions

- **loadPromptFile(filePath)** (Line ~244): Loads a prompt from a markdown file and parses its sections
- **convertMarkdownPromptsToJson(promptsData)** (Line ~328): Converts markdown prompts to a structured JSON format
- **loadPrompts()**: Loads all prompts from the configured directories
- **savePromptsFile(promptsFile)**: Saves the prompts data to the prompts.json file
- **createCategory(name)**: Creates a new prompt category
- **updatePrompt(promptData)**: Updates an existing prompt or creates a new one

## Conversation History

Functions for managing conversation history and context.

### Key Conversation History Functions

- **addToConversationHistory(item)** (Line ~385): Adds a message to the conversation history
- **getPreviousMessage()** (Line ~402): Retrieves the previous message from conversation history
- **clearConversationHistory()**: Clears the conversation history

## Error Handling

Functions for handling and reporting errors.

### Key Error Handling Functions

- **handleError(error, context)** (Line ~421): Processes errors and returns a formatted error message
- **PromptError, ArgumentError, ValidationError**: Custom error classes for different error scenarios

## Prompt Execution

Functions for executing prompts and processing templates.

### Key Prompt Execution Functions

- **runPromptDirectly(promptId, parsedArgs)** (Line ~426): Executes a single prompt with the provided arguments
- **processTemplate(template, args)**: Processes a template string by replacing placeholders with argument values
- **validateJsonArguments(args, promptArgs)**: Validates that the provided arguments match the prompt's requirements

## Chain Execution

Functions for executing prompt chains.

### Key Chain Execution Functions

- **executePromptChain(chainPromptId, inputArgs)** (Line ~486): Executes a chain of prompts, passing data between steps
- **ChainExecutionState interface** (Line ~657): Tracks the state of a chain execution

## API Endpoints

The server exposes several API endpoints for managing prompts and categories.

### Key API Endpoints

- **/api/v1/tools/prompts**: Returns all prompts and categories
- **/api/v1/tools/create_category**: Creates a new category
- **/api/v1/tools/update_prompt**: Creates or updates a prompt
- **/api/v1/tools/delete_prompt**: Deletes a prompt

## MCP Tool Handlers

Handlers for the Model Context Protocol (MCP) tools.

### Key MCP Tool Handlers

- **promptHandler** (Line ~1515): Handles the execution of prompts through the MCP
- **process_slash_command**: Processes slash commands for executing prompts
- **listprompts**: Lists available prompts, optionally filtered by a search term
- **update_prompt**: Updates an existing prompt
- **delete_prompt**: Deletes a prompt
- **modify_prompt_section**: Modifies a specific section of a prompt

## Usage Examples

### Running a Prompt

```javascript
// Example of running a prompt directly
const result = await runPromptDirectly("my-prompt-id", {
  arg1: "value1",
  arg2: "value2"
});
```

### Executing a Chain

```javascript
// Example of executing a prompt chain
const chainResult = await executePromptChain("my-chain-prompt-id", {
  input1: "value1",
  input2: "value2"
});
```

### Error Handling

```javascript
try {
  // Some operation that might fail
} catch (error) {
  const formattedError = handleError(error, "Operation context");
  console.error(formattedError.message);
}
```

## Best Practices

1. **Error Handling**: Always use the `handleError` function to process errors for consistent formatting
2. **Prompt Design**: Follow the markdown format for prompts with clear sections
3. **Chain Design**: Ensure input and output mappings are correctly defined for chain steps
4. **Logging**: Use the appropriate log level for different types of messages

## Common Issues and Solutions

### Prompt Not Found

If a prompt is not found, check:
- The prompt ID is correct
- The prompt file exists in the prompts directory
- The prompts.json file includes the prompt

### Chain Execution Failures

If a chain execution fails, check:
- All referenced prompts exist
- Input and output mappings are correctly defined
- Each step's required arguments are provided

### File System Errors

If file system operations fail, check:
- Permissions on the prompts directory
- Available disk space
- File locks from other processes 