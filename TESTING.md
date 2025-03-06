# Testing Guide for Claude Custom Prompts

This guide will help you test the Claude Custom Prompts application, including both the server and the admin UI.

## Prerequisites

- Node.js 16+ installed
- npm 7+ installed
- Git (for cloning the repository)

## Setup

1. Clone the repository (if you haven't already):
   ```bash
   git clone <repository-url>
   cd claude-prompts
   ```

2. Install dependencies for both the server and admin UI:
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Build the server
   npm run build
   
   # Return to the root directory
   cd ..
   
   # Install admin UI dependencies
   cd admin-ui
   npm install
   
   # Return to the root directory
   cd ..
   ```

## Configuration

Both the server and admin UI are already configured with default settings that work together:

- Server runs on port 9090 (configurable via `PORT` environment variable)
- Admin UI connects to `http://localhost:9090` (configurable via `REACT_APP_API_URL` environment variable)

If you need to change these settings:

1. For the server, edit `server/.env` or `server/config.json`
2. For the admin UI, edit `admin-ui/.env`

See `admin-ui/CONFIGURATION.md` for more details on configuration options.

## Starting the Application

### 1. Start the Server

```bash
cd server
npm start
```

You should see output indicating that the server is running on http://localhost:9090.

### 2. Start the Admin UI

In a new terminal window:

```bash
cd admin-ui
npm start
```

The React application should automatically open in your browser at http://localhost:3000.

## Testing the Admin UI

### Testing Categories

1. **View Categories**
   - Navigate to the Categories section in the sidebar
   - Verify that existing categories are displayed in a list

2. **Create a Category**
   - Click the "Create" button in the Categories list
   - Fill in the required fields:
     - ID: A unique identifier (e.g., "test_category")
     - Name: A display name (e.g., "Test Category")
     - Description: A brief description
   - Click "Save"
   - Verify that the new category appears in the list

3. **Edit a Category**
   - Click on a category in the list
   - Modify some fields
   - Click "Save"
   - Verify that the changes are reflected in the list

### Testing Prompts

1. **View Prompts**
   - Navigate to the Prompts section in the sidebar
   - Verify that existing prompts are displayed in a list

2. **Create a Prompt**
   - Click the "Create" button in the Prompts list
   - Fill in the required fields:
     - ID: A unique identifier (e.g., "test_prompt")
     - Name: A display name (e.g., "Test Prompt")
     - Category: Select a category from the dropdown
     - Description: A brief description
     - User Message Template: A template for the prompt (e.g., "This is a test prompt for {{argument}}")
     - Arguments: Add at least one argument with:
       - Name: The argument name (e.g., "argument")
       - Required: Check if the argument is required
       - Description: A brief description of the argument
   - Click "Save"
   - Verify that the new prompt appears in the list

3. **Edit a Prompt**
   - Click on a prompt in the list
   - Modify some fields
   - Click "Save"
   - Verify that the changes are reflected in the list

4. **Test Chain Prompts**
   - Create a new prompt with "Is Chain" checked
   - Add chain steps with:
     - Step Name: A name for the step
     - Prompt ID: Select an existing prompt
     - Input Mapping: Map chain inputs to step inputs
     - Output Mapping: Map step outputs to chain outputs
   - Save and verify the chain prompt works correctly

## Troubleshooting

### Server Issues

1. **Port Already in Use**
   - If port 9090 is already in use, change the port in `server/.env` or `server/config.json`
   - Remember to update the `REACT_APP_API_URL` in `admin-ui/.env` to match

2. **Transport Issues**
   - The server supports both STDIO and SSE transports
   - You can specify the transport using:
     ```bash
     npm run start:sse   # For SSE transport
     npm run start:stdio # For STDIO transport
     ```

### Admin UI Issues

1. **API Connection Errors**
   - Check that the server is running
   - Verify that `REACT_APP_API_URL` in `admin-ui/.env` points to the correct server address
   - Check the browser console for specific error messages

2. **Form Validation Errors**
   - Ensure all required fields are filled in
   - Check that IDs are unique
   - Verify that arguments are properly configured

## Network Debugging

To debug API calls:

1. Open your browser's developer tools (F12 or Ctrl+Shift+I)
2. Go to the Network tab
3. Filter for "api" or "prompts" to see the relevant requests
4. Check request payloads and response data for errors

## Testing with curl

You can also test the server API directly using curl:

```bash
# Get all prompts and categories
curl http://localhost:9090/prompts

# Create a category
curl -X POST http://localhost:9090/api/v1/tools/create_category \
  -H "Content-Type: application/json" \
  -d '{"id":"test_category","name":"Test Category","description":"A test category"}'

# Create/update a prompt
curl -X POST http://localhost:9090/api/v1/tools/update_prompt \
  -H "Content-Type: application/json" \
  -d '{"id":"test_prompt","name":"Test Prompt","category":"test_category","description":"A test prompt","userMessageTemplate":"This is a test prompt","arguments":[{"name":"arg1","required":true,"description":"Test argument"}]}'
```

## Next Steps

After successfully testing the application, you can:

1. Create your own custom prompts
2. Organize prompts into meaningful categories
3. Develop chain prompts for complex workflows
4. Integrate the server with your Claude applications 