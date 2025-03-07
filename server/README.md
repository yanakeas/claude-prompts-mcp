# Claude Custom Prompts MCP Server

This is a Model Context Protocol (MCP) server that provides a flexible, template-based prompt system for Claude. It allows you to define custom prompts in markdown format and use them with Claude.

## Recent Fixes and Improvements

- **Enhanced Error Handling**: Added comprehensive error handling for transport configuration, ensuring the server continues operating if one transport fails.
- **Test Script Added**: Included a test script that validates server startup, prompt loading, and transport configuration.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

## Installation

1. Install dependencies:

```bash
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

## Configuration

The server is configured using the `config.json` file in the root directory. The main configuration options are:

- **server**: Basic server settings (name, version, port)
- **prompts**: Prompt file location and registration mode
- **transports**: Transport configuration (STDIO, SSE)
- **logging**: Logging configuration

Example configuration:

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
  },
  "logging": {
    "directory": "./logs",
    "level": "info"
  }
}
```

### Environment Variables

The server also supports configuration through environment variables, which take precedence over the config file:

- **PORT**: Server port number (overrides `server.port` in config.json)
- **DEBUG**: Enable debug logging when set to any truthy value

You can create a `.env` file in the server directory to set these variables:

```
PORT=9090
DEBUG=true
```

## Testing

To verify that the server is working correctly, run:

```bash
npm test
```

This will start the server, check if it initializes correctly, and then shut it down.

## Running the Server

### Standard Mode

To run the server in standard mode:

```bash
npm start
```

### Development Mode

For development with automatic reloading:

```bash
npm run dev
```

### Transport-Specific Modes

To run with a specific transport:

```bash
# For STDIO transport
npm run start:stdio

# For SSE transport
npm run start:sse
```

## Troubleshooting

If you encounter issues with the server:

1. **Check Logs**: Look in the `logs` directory for detailed error messages
2. **Verify Configuration**: Ensure your `config.json` is properly formatted
3. **Check Dependencies**: Make sure all dependencies are installed correctly
4. **Port Conflicts**: Verify that port 9090 (or your configured port) is not in use
5. **Transport Issues**: Try switching between STDIO and SSE transports

## Common Issues and Solutions

### Server Won't Start

- Check for error messages in the console or log files
- Verify that the port is not already in use
- Ensure all dependencies are installed correctly

### Prompts Not Loading

- Check that your prompts.json file exists and is properly formatted
- Verify that the prompt markdown files exist at the specified paths
- Check for syntax errors in your prompt templates

### Transport Connection Issues

- For STDIO: Ensure the client is properly configured to use STDIO
- For SSE: Check that the server is accessible at the configured port
- Verify that the correct transport is enabled in the configuration

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# Prompt Server Documentation

## Prompt Chains

Prompt chains allow you to define and execute a sequence of prompts, with each prompt in the chain using the results from previous prompts. This is useful for breaking down complex tasks into smaller, more manageable steps.

### Creating a Chain Prompt

To create a chain prompt, you need to define:

1. The basic prompt information (id, name, description, category)
2. The chain steps, each with:
   - A prompt ID to execute
   - A step name for reference
   - Input mappings to map chain inputs to step inputs
   - Output mappings to map step outputs to chain outputs

Here's an example of a chain prompt markdown file:

```markdown
# Content Analysis Chain

## Description
A chain of prompts that analyzes content in multiple steps.

## System Message
You are a content analysis assistant that follows a structured process.

## User Message Template
This is a chain prompt that will analyze the content provided.

## Chain Steps

### Step 1: Summarization
Prompt: `content_summary`
Input Mapping:
```json
{
  "content": "content_to_summarize"
}
```
Output Mapping:
```json
{
  "Step 1: Summarization": "summary"
}
```

### Step 2: Key Insights
Prompt: `extract_insights`
Input Mapping:
```json
{
  "content": "content",
  "summary": "summary"
}
```
Output Mapping:
```json
{
  "Step 2: Key Insights": "insights"
}
```
```

### Chain Flow

1. When a chain prompt is executed, the system first identifies it as a chain based on the presence of the `Chain Steps` section.
2. Each step in the chain is executed sequentially.
3. For each step:
   - The input mapping determines which chain arguments are passed to the step
   - The step prompt is executed with those inputs
   - The output mapping determines how to store the step's results for use by later steps
4. After all steps are executed, the results from all steps are combined and returned.

### Best Practices

1. **Chain Independence**: Ensure each prompt referenced in a chain exists and is a non-chain prompt.
2. **Data Flow**: Use input/output mappings to control how data flows between steps.
3. **Error Handling**: Chain execution will stop if any step fails, with an error message indicating which step failed.
4. **Computation Efficiency**: Break complex tasks into meaningful steps, but avoid creating too many small steps that could increase latency.

### Example Use Cases

- Content analysis with multiple levels of processing
- Multi-step data transformations
- Sequential decision-making processes
- Complex reasoning tasks broken down into steps 
```

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