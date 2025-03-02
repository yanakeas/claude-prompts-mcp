# Claude Custom Prompts Server

A Node.js server implementing the Model Context Protocol (MCP) for Claude AI models, allowing you to define and use custom prompt templates.

## Features

- 🚀 Easy integration with Claude using MCP
- 📝 Define custom prompt templates using Markdown files 
- 🧩 Support for prompt arguments with validation
- 📚 Organized prompt categories for better management
- 🔄 Multiple transport options (SSE and STDIO)

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
    "port": 90901
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

## Connecting to the Server

### Build the Server First

Before connecting to the server, make sure to build it:

```bash
npm run build
```

This will compile the TypeScript code into JavaScript in the `dist` directory.

### MCP-Bridge Configuration

Add the following to your MCP-Bridge `config.json` file:

```json
"mcp_servers": {
  "claude-prompts": {
    "command": "node /path/to/claude-prompts/server/dist/index.js"
  }
}
```

Note: Replace `/path/to/claude-prompts` with the actual path to your project directory.

You can also specify additional arguments like the transport method:

```json
"mcp_servers": {
  "claude-prompts": {
    "command": "node /path/to/claude-prompts/server/dist/index.js --transport=stdio"
  }
}
```

### Using in Cursor or Claude UI

Once the server is running and configured in MCP-Bridge, you can use the custom prompts by selecting "claude-prompts" as the MCP server.

## Available Prompts

The server comes with several pre-configured prompts:

- **Friendly Greeting**: A warm, personalized greeting
- **Code Review**: A thorough code review with suggestions
- **Content Analysis**: Systematic analysis of web content
- **Explain Concept**: Clear explanation of complex concepts

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

## Creating Custom Prompts

1. Create a new markdown file in the appropriate category folder (e.g., `prompts/general/my_prompt.md`)
2. Add the prompt template to the file using markdown format
3. Register the prompt in `prompts.json` with appropriate metadata

## Troubleshooting

### Connection Issues

- Ensure the server is running on the expected port
- Check that MCP-Bridge is configured correctly
- Verify that the `prompts.json` file exists and is valid JSON

### JSON Parsing Errors

- Check the format of your JSON files
- Ensure all JSON files are properly formatted with no trailing commas
- Validate your JSON using a JSON validator

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
