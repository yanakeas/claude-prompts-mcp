# API Endpoints Reference

This document provides a comprehensive reference for all API endpoints available in the Claude Custom Prompts server.

## Base URL

All API endpoints are relative to the base URL of the server. By default, this is:

```
http://localhost:9090
```

The port can be configured in the `config.json` file.

## Authentication

Currently, the API does not implement authentication. It is recommended to run the server in a secure environment or implement your own authentication layer if needed.

## Prompt Management Endpoints

### List All Prompts

```
GET /prompts
```

Returns a list of all available prompts with their metadata.

**Response:**
```json
{
  "prompts": [
    {
      "id": "category/prompt-id",
      "name": "Prompt Name",
      "category": "Category Name",
      "description": "Description of the prompt"
    },
    ...
  ]
}
```

### Get Prompt Details

```
GET /api/v1/tools/get_prompt/:id
```

Returns detailed information about a specific prompt.

**Parameters:**
- `id`: The ID of the prompt to retrieve

**Response:**
```json
{
  "id": "category/prompt-id",
  "name": "Prompt Name",
  "category": "Category Name",
  "description": "Description of the prompt",
  "systemMessage": "System message content",
  "userMessageTemplate": "User message template content",
  "arguments": [
    {
      "name": "arg1",
      "description": "Description of argument 1",
      "required": true
    },
    ...
  ],
  "isChain": false
}
```

### Update Prompt

```
POST /api/v1/tools/update_prompt
```

Creates a new prompt or updates an existing one.

**Request Body:**
```json
{
  "id": "category/prompt-id",
  "name": "Prompt Name",
  "category": "Category Name",
  "description": "Description of the prompt",
  "systemMessage": "System message content",
  "userMessageTemplate": "User message template content",
  "arguments": [
    {
      "name": "arg1",
      "description": "Description of argument 1",
      "required": true
    },
    ...
  ],
  "isChain": false,
  "chainSteps": []
}
```

**Response:**
```json
{
  "success": true,
  "id": "category/prompt-id"
}
```

### Delete Prompt

```
POST /api/v1/tools/delete_prompt
```

Deletes an existing prompt.

**Request Body:**
```json
{
  "id": "category/prompt-id"
}
```

**Response:**
```json
{
  "success": true
}
```

## Category Management Endpoints

### List All Categories

```
GET /api/v1/tools/list_categories
```

Returns a list of all available categories.

**Response:**
```json
{
  "categories": [
    {
      "id": "category-id",
      "name": "Category Name"
    },
    ...
  ]
}
```

### Create Category

```
POST /api/v1/tools/create_category
```

Creates a new category.

**Request Body:**
```json
{
  "id": "category-id",
  "name": "Category Name"
}
```

**Response:**
```json
{
  "success": true,
  "id": "category-id"
}
```

## Prompt Execution Endpoints

### Execute Prompt

```
POST /api/v1/tools/execute_prompt
```

Executes a prompt with the provided arguments.

**Request Body:**
```json
{
  "promptId": "category/prompt-id",
  "args": {
    "arg1": "value1",
    "arg2": "value2",
    ...
  }
}
```

**Response:**
```json
{
  "result": "Generated content from Claude based on the prompt"
}
```

### Execute Chain Prompt

```
POST /api/v1/tools/execute_chain
```

Executes a chain prompt with the provided arguments.

**Request Body:**
```json
{
  "chainId": "category/chain-prompt-id",
  "args": {
    "arg1": "value1",
    "arg2": "value2",
    ...
  }
}
```

**Response:**
```json
{
  "result": "Final output from the chain execution",
  "stepResults": {
    "step1": "Output from step 1",
    "step2": "Output from step 2",
    ...
  }
}
```

## Utility Endpoints

### Server Status

```
GET /status
```

Returns the current status of the server.

**Response:**
```json
{
  "status": "running",
  "version": "1.0.0",
  "uptime": "1d 2h 3m 4s"
}
```

### Reload Prompts

```
POST /api/v1/tools/reload_prompts
```

Reloads all prompts from the prompts file.

**Response:**
```json
{
  "success": true,
  "count": 42
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK`: The request was successful
- `400 Bad Request`: The request was malformed or missing required parameters
- `404 Not Found`: The requested resource was not found
- `500 Internal Server Error`: An error occurred on the server

Error responses include a JSON body with details:

```json
{
  "error": true,
  "message": "Description of the error",
  "details": {
    // Additional error details if available
  }
}
```

## Rate Limiting

The server does not currently implement rate limiting. If needed, it is recommended to implement rate limiting at the infrastructure level.

## Versioning

API endpoints are versioned with the `/api/v1/` prefix. Future versions may use different prefixes (e.g., `/api/v2/`).

## Examples

### Example: Executing a Simple Prompt

**Request:**
```bash
curl -X POST http://localhost:9090/api/v1/tools/execute_prompt \
  -H "Content-Type: application/json" \
  -d '{
    "promptId": "writing/blog-post",
    "args": {
      "topic": "Artificial Intelligence",
      "tone": "informative",
      "length": "medium"
    }
  }'
```

**Response:**
```json
{
  "result": "# Understanding Artificial Intelligence\n\nArtificial Intelligence (AI) has become an integral part of our daily lives..."
}
```

### Example: Creating a New Category

**Request:**
```bash
curl -X POST http://localhost:9090/api/v1/tools/create_category \
  -H "Content-Type: application/json" \
  -d '{
    "id": "technical",
    "name": "Technical Documentation"
  }'
```

**Response:**
```json
{
  "success": true,
  "id": "technical"
}
```

### Example: Updating a Prompt

**Request:**
```bash
curl -X POST http://localhost:9090/api/v1/tools/update_prompt \
  -H "Content-Type: application/json" \
  -d '{
    "id": "writing/blog-post",
    "name": "Blog Post Generator",
    "category": "writing",
    "description": "Generates a blog post on a given topic",
    "systemMessage": "You are a professional blog writer...",
    "userMessageTemplate": "Write a {{length}} blog post about {{topic}} in a {{tone}} tone.",
    "arguments": [
      {
        "name": "topic",
        "description": "The topic of the blog post",
        "required": true
      },
      {
        "name": "tone",
        "description": "The tone of the blog post",
        "required": true
      },
      {
        "name": "length",
        "description": "The length of the blog post (short, medium, long)",
        "required": true
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "id": "writing/blog-post"
}
``` 