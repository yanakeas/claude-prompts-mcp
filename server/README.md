# Prompt Library API

A cloud-native API server for managing and executing prompt templates, designed for integration with OpenAI's Custom GPT Actions.

## Features

- **Cloud Storage**: All prompts stored in S3 for scalability and durability
- **RESTful API**: OpenAPI 3.1 compliant HTTP endpoints
- **GPT Integration**: Native integration with OpenAI's function/tool calling
- **OpenAI Compatibility**: Built for the Chat Completions API
- **Reference System**: Store and retrieve long texts via tokens
- **Prompt Chains**: Multi-step workflows with input/output mapping

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- AWS account with S3 bucket access
- OpenAI API key

### Environment Setup

Copy the `.env.example` file to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Required environment variables:

- `OPENAI_API_KEY`: Your OpenAI API key
- `S3_BUCKET`: Name of your S3 bucket
- `AWS_REGION`: AWS region (e.g., 'us-east-1')
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `PORT`: Server port (default: 3456)

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Run the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

The server exposes the following endpoints:

- `GET /v1/prompts` - List all prompts
- `GET /v1/prompts/:id` - Get a specific prompt
- `PUT /v1/prompts/:id` - Create or update a prompt
- `DELETE /v1/prompts/:id` - Delete a prompt
- `PATCH /v1/prompts/:id` - Modify a section of a prompt
- `POST /v1/references` - Store a text reference
- `GET /v1/references/:id` - Retrieve a text reference
- `POST /v1/chat` - Chat completion with functions
- `POST /v1/functions` - Execute a function directly

See the OpenAPI specification at `/.well-known/openapi.yaml` for details.

## S3 Storage Structure

The system stores all data in the configured S3 bucket:

- `/index.json` - Main index of all prompts and categories
- `/prompts/{category}/{id}.md` - Prompt template files
- `/references/{id}.txt` - Reference text files

## Prompt Format

Prompts are stored as Markdown files with a specific structure:

```markdown
# Title

Description of the prompt

## System Message

System message for the AI model

## User Message Template

Template with {{placeholders}} for variables
```

## GPT Action Integration

To use as a Custom GPT Action:

1. Host the server with a public HTTPS URL
2. Update the URLs in `.well-known/ai-plugin.json` and `.well-known/openapi.yaml`
3. Configure your GPT with the Action URL
4. Use the tools provided by the API to manage prompts

## Migrating from Claude MCP

This system replaces the previous MCP (Model Context Protocol) implementation. Key differences:

- No more server restarts required; S3 provides on-demand loading
- Native OpenAI function calling replaces XML-style tool calls
- Express HTTP API endpoints instead of transport-specific handlers

## Authentication

The API supports authentication via the `x-api-key` header. Configure this in your environment as needed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
