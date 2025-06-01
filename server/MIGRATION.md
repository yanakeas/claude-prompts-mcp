# Migration Guide: MCP Server to Cloud-Native OpenAI API

This guide will help you migrate from the local MCP-based Claude prompts server to the new cloud-native OpenAI-compatible API.

## Overview of Changes

The migration introduces several key improvements:

1. **Cloud Storage**: All prompts are now stored in S3 instead of the local filesystem
2. **OpenAI Compatibility**: The server is now designed for OpenAI's Chat Completions API
3. **RESTful API**: Standardized HTTP endpoints replace the custom MCP protocol
4. **No Restarts Required**: S3-based storage eliminates the need for server restarts
5. **GPT Integration**: The system is optimized for Custom GPT Actions

## Migration Steps

### 1. Set Up Your AWS Account

You'll need an AWS account with:

- An S3 bucket for storing prompts
- IAM user with programmatic access to the bucket
- Access key and secret key for authentication

### 2. Install New Dependencies

Update your dependencies:

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file with the following:

```
OPENAI_API_KEY=sk-your-api-key-here
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-prompt-bucket-name
PORT=3456
```

### 4. Migrate Existing Prompts

Use the included migration script to transfer your existing prompts to S3:

```bash
npm run migrate
```

This script will:

- Read your existing `promptsConfig.json` file
- Upload each prompt markdown file to S3
- Create a new index structure in S3
- Set up the reference system

### 5. Start the New Server

Once migration is complete, start the server:

```bash
npm start
```

### 6. Update Client Applications

Update your client applications to use the new HTTP API endpoints:

- `GET /v1/prompts` - List all prompts
- `GET /v1/prompts/:id` - Get a specific prompt
- `PUT /v1/prompts/:id` - Create or update a prompt
- `DELETE /v1/prompts/:id` - Delete a prompt
- `PATCH /v1/prompts/:id` - Modify a section of a prompt
- `POST /v1/chat` - Chat completion with functions
- `POST /v1/functions` - Execute a function directly

## Syntax Changes

### Prompt Format

The basic prompt Markdown format remains the same:

```markdown
# Title

Description

## System Message

System message content

## User Message Template

Template with {{placeholders}}
```

### Tool/Function Calling

The main change is in how tools/functions are called:

**Old MCP Format:**

```
<tool_calls>
<tool_call name="function_name">
<tool_parameters>
{"param1": "value1", "param2": "value2"}
</tool_parameters>
</tool_call>
</tool_calls>
```

**New OpenAI Format:**

```json
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "function_name",
        "arguments": "{\"param1\":\"value1\",\"param2\":\"value2\"}"
      }
    }
  ]
}
```

The system handles this automatically - you don't need to modify your prompts.

## API Authentication

The new API uses an API key for authentication. Add an `x-api-key` header to all requests:

```
x-api-key: your-api-key-here
```

Configure your API key in your server environment as needed.

## Common Issues

### Connection Errors

- Check that your S3 bucket is properly configured and accessible
- Verify that your AWS credentials are correct
- Ensure your OpenAI API key is valid

### Missing Prompts

- Run the migration script again to ensure all prompts were transferred
- Check the S3 bucket contents to verify upload success

### Compatibility Issues

- Update any custom integrations to use the new HTTP API
- Ensure all clients are updated to pass the authentication header

## Getting Help

If you encounter issues, please:

1. Check the server logs for detailed error messages
2. Refer to the README.md for complete documentation
3. Submit an issue on the GitHub repository

## Next Steps

After successful migration:

1. Test all your existing prompts with the new system
2. Update any client integrations to use the new API
3. Create a Custom GPT with the Action API for seamless integration
