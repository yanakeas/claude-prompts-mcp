# Claude Custom Prompts Server

[![npm version](https://img.shields.io/npm/v/your-package-name.svg?style=flat-square)](https://www.npmjs.com/package/your-package-name)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A Node.js server implementing the Model Context Protocol (MCP) for Claude AI models, allowing you to define and use custom prompt templates with a modular, category-based organization system.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [License](#license)
- [Working Directory Considerations](#working-directory-considerations)
  - [How the Server Uses Working Directory](#how-the-server-uses-working-directory)
  - [Setting the Working Directory](#setting-the-working-directory)
  - [Common Working Directory Issues](#common-working-directory-issues)
- [Using Built-in Commands](#using-built-in-commands)
  - [Configuration](#configuration)
    - [Server Configuration (config.json)](#server-configuration-configjson)
    - [Prompts Configuration (promptsConfig.json)](#prompts-configuration-promptsconfigjson)
    - [Category-Specific Prompt Files](#category-specific-prompt-files)
- [Creating Custom Prompts](#creating-custom-prompts)
  - **Important Note on Prompt Updates:** Currently, after adding a new prompt, creating a new category, or modifying existing prompt files (`.md` or `prompts.json` files), a server restart is generally required for the changes to take full effect. While some tools offer a `restartServer` option, manual edits or tool usage without this option will necessitate a restart.
  - [Adding a New Prompt to an Existing Category](#adding-a-new-prompt-to-an-existing-category)
  - [Creating a New Category](#creating-a-new-category)
  - [Special Placeholders](#special-placeholders)
  - [Example Template](#example-template)
- [Prompt Chains](#prompt-chains)
  - [Creating a Chain Prompt](#creating-a-chain-prompt)
  - [How Chain Prompts Work](#how-chain-prompts-work)
  - [Debugging Chain Prompts](#debugging-chain-prompts)
  - [Example Chain Prompt](#example-chain-prompt)
- [Claude Desktop Configuration](#claude-desktop-configuration)
  - [Using in Claude Desktop](#using-in-claude-desktop)
- [Troubleshooting](#troubleshooting)
  - [Connection Issues](#connection-issues)
  - [JSON Parsing Errors](#json-parsing-errors)
  - [File Path Issues](#file-path-issues)
  - [Checking Server Status](#checking-server-status)
  - [Verifying Node.js Installation](#verifying-nodejs-installation)
  - [Checking Logs](#checking-logs)
- [Contributing](#contributing)
- [Usage](#usage)
- [Available Tools](#available-tools)
  - [Prompt Management Tools](#prompt-management-tools)
  - [Server Management Tools](#server-management-tools)
  - [Category Management](#category-management)
  - [Command Processing Tools](#command-processing-tools)
  - [Activating Tools in Claude](#activating-tools-in-claude)
  - [API Usage Examples](#api-usage-examples)

## Features

- 🚀 Easy integration with Claude using MCP
- 📝 Define custom prompt templates using Markdown files
- 🧩 Support for prompt arguments with validation
- 📚 Organized prompt categories for better management
- 🔄 Multiple transport options (SSE and STDIO)
- 🔄 Special context placeholders for accessing conversation history
- ⛓️ Support for prompt chains to break complex tasks into steps
- 📂 Distributed prompts configuration with category-specific files

## Quick Start

### Prerequisites

- Node.js v16 or higher
- npm or yarn

### Installation

Ensure you have a compatible Node.js version (v16 or higher as specified in Prerequisites). Consider using a Node Version Manager (e.g., `nvm`) to manage Node.js versions for different projects.

```bash
# Clone the repository
git clone https://github.com/minipuft/claude-prompts.git
cd claude-prompts

# Install dependencies and build the server
cd server
npm install
npm run build

# Start the server
npm start
```

### Basic Usage

Once the server is running, you can use your custom prompts in Claude Desktop by typing:

```
>>command_name argument1 argument2
```

For example:

```
>>friendly_greeting name=John
```

For chain prompts:

```
>>content_analysis_chain text="Your content here" focus="clarity"
```

## Documentation

For more detailed information, please see the documentation in the `docs` folder:

- [Installation Guide](server/docs/installation-guide.md) - Detailed setup instructions and configuration
- [Prompt Format Guide](server/docs/prompt-format-guide.md) - How to create and format prompt templates
- [Chain Execution Guide](server/docs/chain-execution-guide.md) - Creating and using prompt chains
- [Prompt Management](server/docs/prompt-management.md) - Managing prompts and categories
- [Architecture](server/docs/architecture.md) - System architecture and internals
- [API Endpoints Reference](server/docs/api-endpoints-reference.md) - Available API endpoints
- [Contributing Guide](server/docs/contributing.md) - How to contribute to this project

## Roadmap

This project is actively under development. Here are some of the planned features and improvements:

- [ ] Add functionality to modify the prompt library with different tool commands directly within the MCP client
- [ ] Add more comprehensive testing
- [ ] Create a simple web UI for managing prompts

## License

MIT

## Working Directory Considerations

The server relies heavily on the working directory to locate and load files. Understanding how this works is crucial for proper configuration:

### How the Server Uses Working Directory

- The server uses `process.cwd()` to determine its working directory
- All file paths in the code are constructed relative to this directory using `path.join(__dirname, "..", ...)`
- Key files that must be accessible from the working directory:
  - `config.json` - Server configuration
  - `promptsConfig.json` - Main prompt configuration and category imports
  - `prompts/` directory - Contains all category folders and prompt template files
  - `server.log` - Log file (created automatically)

### Setting the Working Directory

- When running the server directly, the working directory is the directory from which you run the command
- When using Claude Desktop, the working directory is set by the `cwd` parameter in the configuration
- Always use absolute paths for the `cwd` parameter to avoid confusion
- On Windows, use backslashes (`\\\\`) in the path to follow Windows conventions, making sure to escape them properly in JSON files (double backslashes)

### Common Working Directory Issues

- If the server can\'t find configuration files or prompt files, the working directory is likely incorrect
- The server logs its working directory at startup - check this to verify it\'s what you expect
- If using relative paths, be aware that they\'re relative to the working directory, not the script location

## Using Built-in Commands

The server supports the following built-in commands:

- **process_slash_command**: Processes slash commands that trigger prompt templates with optional arguments

  ```
  /command_name argument1 argument2
  ```

- **listprompts**: Displays a formatted list of all available commands and their usage
  ```
  /listprompts
  ```

These commands can be used directly through the Claude interface once the MCP server is properly connected.

### Configuration

The server uses two main configuration files:

1. `config.json` - Server configuration (created automatically if not present)
2. `promptsConfig.json` - Main configuration for prompts categories and imports

#### Server Configuration (config.json)

```json
{
  "server": {
    "name": "Claude Custom Prompts",
    "version": "1.0.0",
    "port": 9090
  },
  "prompts": {
    "file": "promptsConfig.json",
    "registrationMode": "name"
  },
  "transports": {
    "default": "stdio",
    "sse": { "enabled": false },
    "stdio": { "enabled": true }
  }
}
```

You can modify this file to change these settings. Note that the `prompts.file` property now points to `promptsConfig.json`.

#### Prompts Configuration (promptsConfig.json)

This file defines the categories and imports category-specific prompt files:

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
    ...
  ],
  "imports": [
    "prompts/general/prompts.json",
    "prompts/code/prompts.json",
    "prompts/analysis/prompts.json",
    ...
  ]
}
```

The `categories` array defines all available prompt categories, and the `imports` array specifies the paths to category-specific prompt files.

#### Category-Specific Prompt Files

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
    ...
  ]
}
```

The `file` property in each prompt definition is relative to the category folder.

## Creating Custom Prompts

**Important Note on Prompt Updates:** Currently, after adding a new prompt, creating a new category, or modifying existing prompt files (`.md` or `prompts.json` files), a server restart is generally required for the changes to take full effect. While some tools offer a `restartServer` option, manual edits or tool usage without this option will necessitate a restart.

### Adding a New Prompt to an Existing Category

1. Create a new markdown file in the appropriate category folder (e.g., `prompts/general/my_prompt.md`)
2. Add the prompt template to the file using markdown format
3. Register the prompt in the category\'s prompts.json file (e.g., `prompts/general/prompts.json`)

### Creating a New Category

1. Create a new folder in the `prompts` directory for your category (e.g., `prompts/mycategory/`)
2. Create a `prompts.json` file in the new category folder with the following structure:
   ```json
   {
     "prompts": []
   }
   ```
3. Add your category to the `categories` array in `promptsConfig.json`
4. Add the path to your category\'s prompts.json file to the `imports` array in `promptsConfig.json`

### Special Placeholders

The server supports special placeholders that can be used in your prompt templates:

- `{{previous_message}}` - Inserts a prompt asking Claude to reference the previous message in its context
  - This leverages Claude\'s built-in conversation memory rather than trying to track messages server-side
  - The actual message content is never accessed by the server, only by Claude

These placeholders are useful for creating prompts that build on previous context without requiring the user to copy and paste content.

### Example Template

```markdown
# Example Prompt with Context

## Description

A prompt that builds on previous conversation context.

## User Message Template

Based on this previous message:
{{previous_message}}

Please provide additional insights on the topic.
```

## Prompt Chains

Prompt chains allow you to define and execute a sequence of prompts, with each prompt in the chain using the results from previous prompts. This is useful for breaking down complex tasks into smaller, more manageable steps.

### Creating a Chain Prompt

To create a chain prompt, add a markdown file with the following structure:

```markdown
# My Chain Prompt

## Description

Description of what this chain does.

## User Message Template

Initial message template with {{variables}}.

## Chain Steps

1. promptId: first_prompt_id
   stepName: Step 1: Description of first step
   inputMapping:
   prompt_input: chain_input
   outputMapping:
   prompt_output: chain_variable

2. promptId: second_prompt_id
   stepName: Step 2: Description of second step
   inputMapping:
   input1: chain_input
   input2: chain_variable
   outputMapping:
   output: final_result

## Output Format

Description of the expected final output format.
```

Each step in the chain specifies:

- The prompt ID to execute
- A descriptive name for the step
- Input mapping (how chain inputs map to prompt inputs)
- Output mapping (how prompt outputs map to chain variables)

The chain executes each step in sequence, with outputs from earlier steps available as inputs to later steps.

### How Chain Prompts Work

1. When a chain prompt is executed, the server:

   - Processes the initial user message template with the provided arguments
   - Executes each step in sequence, passing inputs and collecting outputs
   - Maps variables between steps according to the input/output mappings
   - Returns the final result to Claude

2. Input and output mappings use a simple key-value format:

   - `prompt_input: chain_input` means "pass the chain\'s input named \'chain_input\' to the prompt\'s input named \'prompt_input\'"
   - `prompt_output: chain_variable` means "store the prompt\'s output named \'prompt_output\' in the chain variable named \'chain_variable\'"

3. Chain variables persist throughout the execution of the chain and can be used by any subsequent step

### Debugging Chain Prompts

If your chain prompt isn\'t working as expected:

1. Check that all prompt IDs in the chain steps exist in your category prompts.json files
2. Verify that the input and output mappings match the expected inputs and outputs of each prompt
3. Test each individual prompt in the chain to ensure it works correctly on its own
4. Look for error messages in the server logs related to chain execution
5. Try running the chain with simple inputs to isolate any issues

### Example Chain Prompt

Here\'s a simple example of a chain prompt that generates random facts and then summarizes them:

```markdown
# Test Chain

## Description

A test chain that generates random facts and then summarizes them.

## User Message Template

Generate {{count}} random facts about {{topic}} and then summarize them.

## Chain Steps

1. promptId: generate_facts
   stepName: Step 1: Generate Random Facts
   inputMapping:
   count: count
   topic: topic
   outputMapping:
   facts: generated_facts

2. promptId: create_summary
   stepName: Step 2: Create Summary
   inputMapping:
   content: generated_facts
   format: "bullet points"
   outputMapping:
   summary: final_summary

## Output Format

The chain will return a summary of random facts in bullet point format.
```

---

### Claude Desktop Configuration

To add the MCP server to your Claude Desktop, follow these steps:

1. Locate your Claude Desktop configuration file:

   - Windows: `%APPDATA%\\Claude\\claude_desktop_config.json` (Typically `C:\\Users\\YourUsername\\AppData\\Roaming\\Claude\\claude_desktop_config.json`)
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the following to your `claude_desktop_config.json` file:

```json
"mcp_servers": {
  "claude-prompts": {
    "command": "node",
    "args": [
      "C:\\\\path\\\\to\\\\claude-prompts\\\\server\\\\dist\\\\index.js",
      "--transport=stdio"
    ],
    "cwd": "C:\\\\path\\\\to\\\\claude-prompts\\\\server",
    "env": {
      "PORT": "9090"
    },
  }
}
```

Notes:

- Replace `C:\\\\path\\\\to\\\\claude-prompts\\\\server` with the absolute path to your server directory
- For Windows paths, use double backslashes (`\\\\`) to properly escape them in JSON
- The `cwd` parameter is critical as it sets the working directory for the server
- Without the correct `cwd`, the server won\'t be able to find prompt files, config files, or log files
- All file paths in the server code are resolved relative to this working directory
- Set `autostart` to `true` to have the server start automatically when Claude Desktop launches
- You can specify environment variables like `PORT` in the `env` object

3. You can also specify the transport method by adding it to the args array:

4. After saving the configuration, restart Claude Desktop to apply the changes.

### Using in Claude Desktop

Once the server is running and configured, you can use your custom prompts in Claude Desktop by typing:

- `>>command_name argument1 argument2` - For regular prompts
- `>>chain_command_name argument1 argument2` - For chain prompts

Example:

```
>>friendly_greeting name=John
```

For chain prompts:

```
>>content_analysis_chain text="Your content here" focus="clarity"
```

## Troubleshooting

### Connection Issues

- Ensure the server is running on the expected port
- Check that the paths in your Claude Desktop config.json are correct
- Verify that the `cwd` parameter points to the correct server directory
- Make sure the `promptsConfig.json` file and category prompts.json files exist and are valid JSON

### Prompts Not Updating or Appearing

- **Server Restart:** The most common reason for prompts not updating or new prompts not appearing after creation/modification is that the server needs to be restarted. The server loads prompts at startup. Ensure you restart the server after any changes to prompt files or configurations unless a tool explicitly handled the restart (e.g., `reload_prompts` or `update_prompt` with `restartServer=true`).
- **Cache:** While less common for server-side changes, if you suspect a client-side caching issue (e.g., in Claude Desktop), try restarting the client application as well.
- **File Paths and Configuration:** Double-check that your prompt files are in the correct category directories and that `promptsConfig.json` correctly imports your category-specific `prompts.json` files. Verify that the `file` property in each prompt definition within a category's `prompts.json` correctly points to the `.md` template file relative to that category's folder.

### JSON Parsing Errors

- Check the format of your JSON files
- Ensure all JSON files are properly formatted with no trailing commas
- Validate your JSON using a JSON validator

### File Path Issues

- If you see errors about files not being found, check your `cwd` parameter
- The server logs its working directory at startup - verify it matches your expectations
- All file paths in the server are resolved relative to the working directory
- Use absolute paths in the `cwd` parameter to avoid confusion
- Windows paths should use double backslashes (`\\\\`) in JSON configuration files to properly escape the backslash character

### Checking Server Status

- The server logs its status to the console and to a log file (`server.log` in the server directory)
- If using Claude Desktop, check the Claude Desktop logs for server startup messages
- You can manually run the server to see if it starts correctly:
  ```bash
  cd path/to/claude-prompts/server
  node dist/index.js
  ```
- Look for messages like "Server initialized successfully" and "All prompts loaded successfully"
- If you see error messages, they can help identify the specific issue

### Verifying Node.js Installation

- Ensure Node.js is installed and accessible:
  ```bash
  node --version
  npm --version
  ```
- Both commands should return version numbers without errors

### Checking Logs

- On Windows, check the log file at `C:\\\\path\\\\to\\\\claude-prompts\\\\server\\\\server.log`
- On macOS, check the log file at `/path/to/claude-prompts/server/server.log`
- The log file contains detailed information about server initialization, prompt loading, and any errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For more detailed guidelines on contributing, please consider creating a `CONTRIBUTING.md` file.

## Usage

Once the server is running, you can use the following commands:

- `>>listprompts` or `/listprompts` - List all available commands
- `>>command_name [arguments]` or `/command_name [arguments]` - Execute a specific command

**Note:** The double colon prefix (`>>`) is the preferred format as it\'s less likely to be confused with regular text. The slash prefix (`/`) is still supported for backward compatibility.

For example:

```
>>friendly_greeting name=John
```

Or with multiple arguments in JSON format:

```
>>content_analysis {"text": "Your content here", "focus": "clarity"}
```

## Available Tools

The server provides several built-in tools to manage prompts and control server behavior. These tools can be accessed via API endpoints, through the Claude interface (for some tools), or invoked programmatically by Model Context Protocol (MCP) compliant agents.

### Prompt Management Tools

- **listprompts**: Displays a formatted list of all available commands and their usage

  ```
  /listprompts [filter_text]
  ```

  - Optional `filter_text` parameter to show only commands matching the filter

- **update_prompt**: Creates or updates a prompt

  ```
  POST /api/v1/tools/update_prompt
  ```

  Parameters:

  - `id` (required): Unique identifier for the prompt
  - `name` (required): Display name for the prompt
  - `category` (required): Category this prompt belongs to
  - `description` (required): Description of the prompt
  - `systemMessage` (optional): System message for the prompt
  - `userMessageTemplate` (required): Template for generating the user message
  - `arguments` (required): Array of argument objects with name, description, and required properties
  - `isChain` (optional): Whether this prompt is a chain of prompts
  - `chainSteps` (optional): Array of steps for chain prompts
  - `restartServer` (optional): Whether to restart the server after updating the prompt

  Note: This tool also handles category creation. If the specified category ID does not exist, it will be created automatically along with the necessary directory structure and configuration files.

  **Server Restart Note:** While this tool includes a `restartServer` parameter, if you use the tool without this parameter or if you manually edit prompt files, a server restart is required for the modifications to be applied.

- **delete_prompt**: Deletes a prompt

  ```
  POST /api/v1/tools/delete_prompt
  ```

  Parameters:

  - `id` (required): Unique identifier for the prompt to delete
  - `restartServer` (optional): Whether to restart the server after deleting the prompt

- **modify_prompt_section**: Modifies a specific section of a prompt

  ```
  POST /api/v1/tools/modify_prompt_section
  ```

  Parameters:

  - `id` (required): Unique identifier of the prompt to modify
  - `section_name` (required): Name of the section to modify (e.g., "title", "description", "System Message", "User Message Template")
  - `new_content` (required): New content for the specified section
  - `restartServer` (optional): Whether to restart the server after modifying the prompt section

  **Server Restart Note:** If changes are made using this tool without the `restartServer` parameter, or if prompt section files are manually edited, a server restart is required for the modifications to be applied.

### Server Management Tools

- **reload_prompts**: Refreshes all prompts and optionally restarts the server
  ```
  POST /api/v1/tools/reload_prompts
  ```
  Parameters:
  - `restart` (optional): Whether to restart the server after reloading prompts (boolean)
  - `reason` (optional): Reason for reloading/restarting the server

### Category Management

Category creation and management are primarily handled by the **update_prompt** tool. When using `update_prompt` (either via its API endpoint or as an MCP tool), if you provide a category ID that does not currently exist, the server will automatically:

1. Create the new category in the `promptsConfig.json` file.
2. Create the corresponding directory for the category (e.g., `prompts/<category_id>/`).
3. Create a `prompts.json` file within the new category directory.

Therefore, a separate `create_category` tool is not typically needed when interacting via the documented MCP tools or the `update_prompt` API. The API endpoint `POST /api/v1/tools/create_category` may still exist for direct manipulation but using `update_prompt` is the recommended approach for integrated prompt and category management.

### Command Processing Tools

- **process_slash_command**: Processes slash commands that trigger prompt templates
  ```
  POST /api/v1/tools/process_slash_command
  ```
  Parameters:
  - `command` (required): The command to process (e.g., "/content_analysis Hello world")

### Activating Tools in Claude

Some tools can be accessed directly through the Claude interface:

- **listprompts**: List all available commands

  ```
  >>listprompts
  ```

  or

  ```
  /listprompts
  ```

- **reload_prompts**: Reload all prompts and optionally restart the server

  ```
  >>reload_prompts restart=true reason="Updated configuration"
  ```

- **update_prompt**, **delete_prompt**, **modify_prompt_section**: These tools are available as:

  - Direct API endpoints (see `POST` examples above and "API Usage Examples" below).
  - Programmatic MCP tools for agents.
    They are not typically invoked directly by users via `>>` commands in the same way as `listprompts` or `reload_prompts`.

- **Executing a prompt**:

  ```
  >>prompt_name argument1=value1 argument2=value2
  ```

  or

  ```
  /prompt_name argument1=value1 argument2=value2
  ```

- **Using JSON format for arguments**:
  ```
  >>prompt_name {"argument1": "value1", "argument2": "value2"}
  ```

#### Reloading prompts:

```bash
curl -X POST http://localhost:9090/api/v1/tools/reload_prompts
```

#### Reloading prompts and restarting the server:

```bash
curl -X POST http://localhost:9090/api/v1/tools/reload_prompts \\\
  -H "Content-Type: application/json" \\\
  -d \'{
    "restart": true,
    "reason": "Configuration update"
  }\'
```

### API Usage Examples

#### Creating a new prompt:

```bash
curl -X POST http://localhost:9090/api/v1/tools/update_prompt \\\
  -H "Content-Type: application/json" \\\
  -d \'{
    "id": "example_prompt",
    "name": "Example Prompt",
    "category": "general",
    "description": "An example prompt template",
    "userMessageTemplate": "This is an example with {{variable}}",
    "arguments": [
      {
        "name": "variable",
        "description": "Example variable",
        "required": true
      }
    ]
  }\'
```

#### Deleting a prompt:

```bash
curl -X POST http://localhost:9090/api/v1/tools/delete_prompt \\\
  -H "Content-Type: application/json" \\\
  -d \'{
    "id": "example_prompt"
  }\'
```

#### Reloading prompts:

```bash
curl -X POST http://localhost:9090/api/v1/tools/reload_prompts
```
