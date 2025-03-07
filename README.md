# Claude Custom Prompts Server

A Node.js server implementing the Model Context Protocol (MCP) for Claude AI models, allowing you to define and use custom prompt templates with a modular, category-based organization system.

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

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-prompts.git
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

## TODO

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
- On Windows, use backslashes (`\\`) in the path to follow Windows conventions, making sure to escape them properly in JSON files (double backslashes)

### Common Working Directory Issues

- If the server can't find configuration files or prompt files, the working directory is likely incorrect
- The server logs its working directory at startup - check this to verify it's what you expect
- If using relative paths, be aware that they're relative to the working directory, not the script location

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

### Special Placeholders

The server supports special placeholders that can be used in your prompt templates:

- `{{previous_message}}` - Inserts a prompt asking Claude to reference the previous message in its context
  - This leverages Claude's built-in conversation memory rather than trying to track messages server-side
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
   - `prompt_input: chain_input` means "pass the chain's input named 'chain_input' to the prompt's input named 'prompt_input'"
   - `prompt_output: chain_variable` means "store the prompt's output named 'prompt_output' in the chain variable named 'chain_variable'"

3. Chain variables persist throughout the execution of the chain and can be used by any subsequent step

### Debugging Chain Prompts

If your chain prompt isn't working as expected:

1. Check that all prompt IDs in the chain steps exist in your category prompts.json files
2. Verify that the input and output mappings match the expected inputs and outputs of each prompt
3. Test each individual prompt in the chain to ensure it works correctly on its own
4. Look for error messages in the server logs related to chain execution
5. Try running the chain with simple inputs to isolate any issues

### Example Chain Prompt

Here's a simple example of a chain prompt that generates random facts and then summarizes them:

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

___

### Claude Desktop Configuration

To add the MCP server to your Claude Desktop, follow these steps:

1. Locate your Claude Desktop configuration file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json` (Typically `C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json`)
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the following to your `claude_desktop_config.json` file:

```json
"mcp_servers": {
  "claude-prompts": {
    "command": "node",
    "args": [
      "C:\\path\\to\\claude-prompts\\server\\dist\\index.js",
      "--transport=stdio"
    ],
    "cwd": "C:\\path\\to\\claude-prompts\\server",
    "env": {
      "PORT": "9090"
    },
    "autostart": true
  }
}
```

Notes:
- Replace `C:\\path\\to\\claude-prompts\\server` with the absolute path to your server directory
- For Windows paths, use double backslashes (`\\`) to properly escape them in JSON
- The `cwd` parameter is critical as it sets the working directory for the server
- Without the correct `cwd`, the server won't be able to find prompt files, config files, or log files
- All file paths in the server code are resolved relative to this working directory
- Set `autostart` to `true` to have the server start automatically when Claude Desktop launches
- You can specify environment variables like `PORT` in the `env` object

3. You can also specify the transport method by adding it to the args array:

```json
"mcp_servers": {
  "claude-prompts": {
    "command": "node",
    "args": [
      "C:\\path\\to\\claude-prompts\\server\\dist\\index.js",
      "--transport=stdio"
    ],
    "env": {
      "PORT": "9090"
    },
  }
}
```

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

### JSON Parsing Errors

- Check the format of your JSON files
- Ensure all JSON files are properly formatted with no trailing commas
- Validate your JSON using a JSON validator

### File Path Issues

- If you see errors about files not being found, check your `cwd` parameter
- The server logs its working directory at startup - verify it matches your expectations
- All file paths in the server are resolved relative to the working directory
- Use absolute paths in the `cwd` parameter to avoid confusion
- Windows paths should use double backslashes (`\\`) in JSON configuration files to properly escape the backslash character

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

- On Windows, check the log file at `C:\\path\\to\\claude-prompts\\server\\server.log`
- On macOS, check the log file at `/path/to/claude-prompts/server/server.log`
- The log file contains detailed information about server initialization, prompt loading, and any errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Usage

Once the server is running, you can use the following commands:

- `>>listprompts` or `/listprompts` - List all available commands
- `>>command_name [arguments]` or `/command_name [arguments]` - Execute a specific command

**Note:** The double colon prefix (`>>`) is the preferred format as it's less likely to be confused with regular text. The slash prefix (`/`) is still supported for backward compatibility.

For example:
```
>>friendly_greeting name=John
```

Or with multiple arguments in JSON format:
```
>>content_analysis {"text": "Your content here", "focus": "clarity"}
```
