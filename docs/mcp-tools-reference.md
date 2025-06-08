# MCP Tools Reference

This document provides a comprehensive reference for all MCP (Model Context Protocol) tools available in the server. The primary way to interact with the server is by invoking these tools through a compatible MCP client (like Claude Desktop or Cursor Windsurf), not through a traditional REST API.

## Interaction Model

Clients execute server capabilities by sending `tool_code` requests. Each tool has a unique name and a defined set of arguments based on a Zod schema, ensuring type safety and validation.

---

## Core Tools

These tools provide the main functionality for prompt discovery and execution.

### `process_slash_command`

Processes slash commands (e.g., `/analysis`) to execute prompts. This is the primary tool for running your defined prompts.

**Description**: "Process commands that trigger prompt templates with optional arguments"

**Parameters**:

- `command` (string, required): The full command string, including the slash prefix and any arguments.
  - Example: `"/content_analysis Hello world"`
  - Example: `">>friendly_greeting name=\"Developer\""`

**Behavior**:

- Parses the command name (e.g., `content_analysis`) and arguments.
- Finds the corresponding prompt.
- If arguments are provided, it uses them to populate the prompt's template.
- If a single argument is expected, the entire string after the command is used as its value.
- If multiple arguments are expected, they should be provided as a JSON string.
- If no arguments are provided, it substitutes `{{previous_message}}` for all arguments.
- If a prompt has `onEmptyInvocation` set to `return_template` and is called without arguments, the tool returns a help message detailing the required arguments.

### `listprompts`

Lists all available commands/prompts, grouped by category, with descriptions and usage examples.

**Description**: "Optional filter text to show only matching commands"

**Parameters**:

- `command` (string, optional): A filter to show only commands matching the text. (Note: The schema shows an optional `command` arg, which seems to be for parsing the filter text from the command itself, e.g., `/listprompts myfilter`).

**Example Invocation**: A client would invoke the `listprompts` tool, often without arguments, to get a full list of available prompts to display to the user.

---

## Prompt Management Tools

These tools allow for dynamic, real-time management of prompts directly from an MCP client, triggering the server's hot-reload or restart functionality.

### `update_prompt`

Creates a new prompt or updates an existing one. This involves creating/updating the prompt's `.md` file and ensuring it's correctly registered in the category's `prompts.json`.

**Parameters**:

- `id` (string, required): Unique identifier (e.g., `analysis/code_review`).
- `name` (string, required): Display name (e.g., "Code Review").
- `category` (string, required): The ID of the category it belongs to.
- `description` (string, required): A description of what the prompt does.
- `userMessageTemplate` (string, required): The Nunjucks template for the user message.
- `arguments` (array, required): An array of objects defining the prompt's arguments. Each object has `name` (string), `description` (string, optional), and `required` (boolean).
- `systemMessage` (string, optional): The system message for the prompt.
- `isChain` (boolean, optional): Whether this is a prompt chain.
- `chainSteps` (array, optional): The steps for a prompt chain.
- `onEmptyInvocation` (enum, optional): Either `"return_template"` or `"execute_if_possible"`.
- `fullServerRestart` (boolean, optional): If `true`, performs a full server restart instead of a hot-reload. Defaults to `false`.

### `delete_prompt`

Deletes an existing prompt file and removes its entry from the category's `prompts.json`.

**Parameters**:

- `id` (string, required): The ID of the prompt to delete.
- `fullServerRestart` (boolean, optional): If `true`, performs a full server restart. Defaults to `false`.

### `modify_prompt_section`

Modifies a specific section of an existing prompt's `.md` file (e.g., its `System Message` or `User Message Template`).

**Parameters**:

- `id` (string, required): The ID of the prompt to modify.
- `section_name` (string, required): The name of the section to modify (e.g., "System Message").
- `new_content` (string, required): The new content for the section.
- `fullServerRestart` (boolean, optional): If `true`, performs a full server restart. Defaults to `false`.

### `reload_prompts`

Manually triggers the server's hot-reload or full restart mechanism.

**Parameters**:

- `reason` (string, optional): A reason for the reload, for logging purposes.
- `fullServerRestart` (boolean, optional): If `true`, performs a full server restart. Defaults to `false` (hot-reload).
