# Claude Custom Prompts Server [WIP]

A Node.js server implementing the Model Context Protocol (MCP) for Claude AI models, allowing you to define and use custom prompt templates.

## Features

- 🚀 Easy integration with Claude using MCP
- 📝 Define custom prompt templates using Markdown files 
- 🧩 Support for prompt arguments with validation
- 📚 Organized prompt categories for better management
- 🔄 Multiple transport options (SSE and STDIO)
- 🔄 Special context placeholders for accessing conversation history
- ⛓️ Support for prompt chains to break complex tasks into steps

## TODO

- [ ] Add functionality to modify the prompt library with different tool commands directly within the MCP client
- [ ] Add more comprehensive testing
- [ ] Create a simple web UI for managing prompts
- [ ] Import my entire Prompt Library

## Setup

### Prerequisites

- Node.js v16 or higher
- npm or yarn

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/claude-prompts.git
   cd claude-prompts
   ```

2. Navigate to the server directory:
   ```bash
   cd server
   ```

3. Install dependencies:
   ```bash
   npm install
   ```
4. Build index.js: 
    ```bash
    npm run build
    ```

## Starting the Server

### Using npm scripts

```bash
npm start          # Start with default transport
npm run start:sse  # Start with SSE transport
npm run start:stdio # Start with STDIO transport
```

### Using direct command

```bash
node dist/index.js --transport=sse
```

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
2. `prompts.json` - Custom prompt templates

#### Server Configuration (config.json)

```json
{
  "server": {
    "name": "Claude Custom Prompts",
    "version": "1.0.0",
    "port": 9090
  },
  "prompts": {
    "file": "prompts.json",
    "registrationMode": "name"
  },
  "transports": {
    "default": "stdio",
    "sse": { "enabled": false },
    "stdio": { "enabled": true }
  }
}
```

You can modify this file to change these settings.

#### Prompt Templates (prompts.json)

This file defines the custom prompt templates available through the server. Each template includes:
- `id`: Unique identifier for the prompt
- `name`: Human-readable name
- `category`: Category for organization
- `description`: Description of what the prompt does
- `file`: Path to the markdown file containing the prompt template
- `arguments`: Expected arguments for the prompt

## Creating Custom Prompts

1. Create a new markdown file in the appropriate category folder (e.g., `prompts/general/my_prompt.md`)
2. Add the prompt template to the file using markdown format
3. Register the prompt in `prompts.json` with appropriate metadata

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

___

### Claude Desktop Configuration

To add the MCP server to your Claude Desktop, follow these steps:

1. Locate your Claude Desktop configuration file:
   - Windows: `%APPDATA%\claude-desktop\config.json` (Typically `C:\Users\YourUsername\AppData\Roaming\claude-desktop\config.json`)
   - macOS: `~/Library/Application Support/claude-desktop/config.json`

2. Add the following to your `config.json` file:

```json
"mcp_servers": {
  "claude-prompts": {
    "command": "node C:/path/to/claude-prompts/server/dist/index.js",
    "env": {
      "PORT": "9090"
    },
    "autostart": true
  }
}
```

Notes:
- Replace `C:/path/to/claude-prompts` with the actual path to your project directory
- Use forward slashes (`\\` on windows) for the paths
- Set `autostart` to `true` to have the server start automatically when Claude Desktop launches
- You can specify environment variables like `PORT` in the `env` object

3. You can also specify the transport method:

```json
"mcp_servers": {
  "claude-prompts": {
    "command": "node C:/path/to/claude-prompts/server/dist/index.js --transport=stdio",
    "autostart": true
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
- Verify that the `prompts.json` file exists and is valid JSON

### JSON Parsing Errors

- Check the format of your JSON files
- Ensure all JSON files are properly formatted with no trailing commas
- Validate your JSON using a JSON validator

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
