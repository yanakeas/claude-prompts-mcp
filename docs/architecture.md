# Architecture Overview

This document provides an overview of the Claude Custom Prompts system architecture, explaining how the different components work together.

## System Architecture

The Claude Custom Prompts system follows a client-server architecture with the following main components:

1. **Server**: A Node.js application that manages prompts and communicates with Claude
2. **Admin UI**: A React-based web application for managing prompts
3. **API**: RESTful endpoints for integrating with other applications
4. **Storage**: File-based storage for prompts and configuration

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │
│  Admin UI   │◄───►│   Server    │◄───►│   Claude    │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                          ▲
                          │
                          ▼
                    ┌─────────────┐
                    │             │
                    │  Storage    │
                    │             │
                    └─────────────┘
```

## Component Details

### Server

The server is built with Node.js and Express, using TypeScript. It is responsible for:

- Managing prompts and categories
- Processing prompt templates
- Communicating with Claude
- Providing API endpoints
- Logging and error handling

Key files:

- `server/src/index.ts`: Main server file
- `server/config.json`: Server configuration
- `server/prompts.json`: Stored prompts

#### Server Modules

1. **Configuration**: Loads and validates server configuration
2. **Logging**: Handles logging to files and console
3. **Prompt Management**: Loads, saves, and processes prompts
4. **API Endpoints**: Provides RESTful endpoints for the admin UI and other clients
5. **Claude Integration**: Communicates with Claude for prompt execution

### Admin UI

The admin UI is built with React and React Admin. It provides a user-friendly interface for:

- Creating and editing prompts
- Managing categories
- Executing prompts
- Viewing statistics

Key files:

- `admin-ui/src/App.tsx`: Main application component
- `admin-ui/src/dataProvider.ts`: Data provider for React Admin
- `admin-ui/src/components/`: React components

#### Admin UI Components

1. **Dashboard**: Displays statistics and quick links
2. **Prompt Management**: Interface for creating and editing prompts
3. **Category Management**: Interface for managing categories
4. **Authentication**: (Not implemented in the current version)

### API

The API provides RESTful endpoints for interacting with the system. Key endpoints:

- `/prompts`: List all prompts
- `/api/v1/tools/execute_prompt`: Execute a prompt
- `/api/v1/tools/execute_chain`: Execute a chain prompt
- `/api/v1/tools/update_prompt`: Create or update a prompt
- `/api/v1/tools/create_category`: Create a category

See the [API Endpoints Reference](api-endpoints-reference.md) for a complete list.

### Storage

The system uses file-based storage for:

- Prompts: Stored in `prompts.json`
- Configuration: Stored in `config.json`
- Logs: Stored in the configured log directory

## Data Flow

### Prompt Execution Flow

1. Client sends a request to execute a prompt with arguments
2. Server loads the prompt from storage
3. Server processes the template, replacing placeholders with arguments
4. Server sends the processed prompt to Claude
5. Claude generates a response
6. Server returns the response to the client

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│         │     │             │     │             │     │         │
│ Client  │────►│   Server    │────►│   Claude    │────►│ Client  │
│         │     │             │     │             │     │         │
└─────────┘     └─────────────┘     └─────────────┘     └─────────┘
                      ▲
                      │
                      ▼
                ┌─────────────┐
                │             │
                │  Storage    │
                │             │
                └─────────────┘
```

### Chain Execution Flow

1. Client sends a request to execute a chain prompt with arguments
2. Server loads the chain prompt from storage
3. Server executes each step in the chain:
   a. Process the step's template
   b. Send the processed template to Claude
   c. Store the result
   d. Map the result to inputs for the next step
4. Server returns the final result to the client

```
┌─────────┐     ┌─────────────────────────────────────┐     ┌─────────┐
│         │     │              Server                 │     │         │
│ Client  │────►│  ┌─────┐    ┌─────┐    ┌─────┐     │────►│ Client  │
│         │     │  │Step1│───►│Step2│───►│Step3│     │     │         │
└─────────┘     │  └─────┘    └─────┘    └─────┘     │     └─────────┘
                └─────────────────────────────────────┘
                      ▲             ▲
                      │             │
                      ▼             ▼
                ┌─────────────┐ ┌─────────────┐
                │             │ │             │
                │  Storage    │ │   Claude    │
                │             │ │             │
                └─────────────┘ └─────────────┘
```

## Technology Stack

### Server

- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **TypeScript**: Type-safe JavaScript
- **Zod**: Schema validation
- **Winston**: Logging

### Admin UI

- **React**: UI library
- **React Admin**: Admin framework
- **Material UI**: Component library
- **TypeScript**: Type-safe JavaScript

## Security Considerations

The current implementation has the following security considerations:

- **Authentication**: Not implemented in the current version
- **Authorization**: Not implemented in the current version
- **Input Validation**: Implemented using Zod schema validation
- **Error Handling**: Implemented to prevent information leakage
- **CORS**: Configured to allow cross-origin requests from the admin UI

## Scalability

The current implementation is designed for small to medium-scale deployments. For larger deployments, consider:

- **Database Storage**: Replace file-based storage with a database
- **Caching**: Implement caching for frequently used prompts
- **Load Balancing**: Deploy multiple instances behind a load balancer
- **Authentication**: Implement authentication for the API
- **Rate Limiting**: Implement rate limiting for the API

## Future Enhancements

Potential enhancements to the architecture include:

1. **Authentication and Authorization**: Implement user authentication and role-based access control
2. **Database Storage**: Replace file-based storage with a database for better scalability
3. **Caching**: Implement caching for frequently used prompts
4. **Webhooks**: Implement webhooks for event-driven integrations
5. **Monitoring**: Add monitoring and alerting capabilities
6. **Testing**: Enhance test coverage for all components

## Deployment Architecture

For production deployments, consider the following architecture:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│  Load       │────►│  Server     │────►│  Database   │     │  Claude     │
│  Balancer   │     │  Cluster    │     │             │     │             │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       ▲                                                          ▲
       │                                                          │
       │                                                          │
       │                                                          │
       ▼                                                          │
┌─────────────┐                                                   │
│             │                                                   │
│  Admin UI   │───────────────────────────────────────────────────┘
│             │
└─────────────┘
```

This architecture includes:

1. **Load Balancer**: Distributes traffic across multiple server instances
2. **Server Cluster**: Multiple server instances for high availability
3. **Database**: Centralized storage for prompts and configuration
4. **Admin UI**: Deployed separately from the server
5. **Claude**: External service for prompt execution

## Conclusion

The Claude Custom Prompts system follows a client-server architecture with a focus on simplicity and flexibility. The modular design allows for easy extension and customization, while the RESTful API enables integration with other applications.

For more detailed information on specific components, refer to the other documentation files:

- [Installation and Setup Guide](installation-guide.md)
- [Prompt Format Guide](prompt-format-guide.md)
- [Chain Execution Guide](chain-execution-guide.md)
- [API Endpoints Reference](api-endpoints-reference.md)
- [Index.ts Reference](index-ts-reference.md) 