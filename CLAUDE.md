# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Essential Commands
- **Build**: `npm run build` - Compiles TypeScript to JavaScript in `dist/`
- **Start**: `npm start` - Runs the compiled server
- **Development**: `npm run dev` - Watches TypeScript files and restarts on changes
- **Test**: `npm test` - Runs the test server

### Transport-Specific Commands
- **STDIO Transport**: `npm run start:stdio` - For MCP clients like Claude Desktop
- **SSE Transport**: `npm run start:sse` - For web-based clients
- **Production**: `npm run start:production` - Quiet mode with STDIO transport
- **Development**: `npm run start:development` - Verbose mode with SSE transport

### Debugging Commands
- **Verbose Mode**: `npm run start:verbose` - Detailed diagnostics
- **Debug Startup**: `npm run start:debug` - Extra debugging information
- **Help**: `npm run help` - Show command line options

### Working Directory
All commands should be run from the `server/` directory: `cd server && npm run build`

## Project Architecture

### Core System Structure
This is a **Model Context Protocol (MCP) server** that provides AI prompt management with hot-reloading capabilities. The architecture follows a multi-phase orchestration pattern:

1. **Foundation Phase**: Configuration loading, logging setup, core services
2. **Data Loading Phase**: Prompt loading, category parsing, validation
3. **Module Initialization Phase**: Tools, executors, conversation managers
4. **Server Launch Phase**: Transport layer, API endpoints, health monitoring

### Key Components

#### `/server/src/orchestration/`
- **Main entry point** with comprehensive health monitoring and graceful shutdown
- **Multi-phase startup** with dependency management and error recovery
- **Performance monitoring** with memory usage tracking and uptime metrics

#### `/server/src/prompts/`
- **Template processor** using Nunjucks with advanced features (conditionals, loops, macros)
- **Prompt registry** for dynamic loading and hot-reloading
- **Converter system** for format transformation and validation

#### `/server/src/mcp-tools/`
- **Prompt management tools** for create, update, delete, and reload operations
- **Interactive prompt execution** with argument parsing and validation
- **Chain execution** support for multi-step workflows

#### `/server/src/transport/`
- **STDIO transport** for Claude Desktop integration
- **SSE transport** for web-based clients
- **Transport-aware logging** to avoid interference with STDIO protocol

### Configuration System

#### Main Configuration (`server/config.json`)
- Server settings (name, version, port)
- Transport configuration (STDIO/SSE)
- Logging configuration (directory, level)
- Prompts file reference

#### Prompts Configuration (`server/promptsConfig.json`)
- **Category organization** with logical grouping
- **Modular import system** using category-specific `prompts.json` files
- **Registration modes** (ID, NAME, or BOTH)

### Prompt Organization

#### File Structure
```
server/prompts/
├── category-name/
│   ├── prompts.json          # Category prompt registry
│   ├── prompt-name.md        # Individual prompt files
│   └── ...
└── promptsConfig.json        # Main configuration
```

#### Prompt Format
- **Markdown files** with structured sections
- **Nunjucks templating** with `{{variable}}` syntax
- **Argument definitions** with type information and validation
- **Category association** for organization

### TypeScript Architecture

#### Core Types (`src/types.ts`)
- **Config interfaces** for application configuration
- **PromptData** for prompt metadata and structure
- **Message types** for conversation handling
- **Transport types** for protocol abstraction

#### Key Interfaces
- `PromptData`: Complete prompt structure with metadata, arguments, and configuration
- `PromptArgument`: Typed argument definitions with validation
- `Category`: Prompt organization and categorization
- `MessageContent`: Extensible content type system

### Development Patterns

#### Hot-Reloading System
- **File watching** for prompt changes
- **Registry updates** without server restart
- **Template recompilation** on modification
- **MCP client notification** of changes

#### Error Handling
- **Comprehensive error boundaries** at all levels
- **Graceful degradation** for partial failures
- **Health monitoring** with periodic validation
- **Rollback mechanisms** for startup failures

#### Template Processing
- **Nunjucks engine** with full feature support
- **Dynamic variable substitution** from arguments
- **Conditional logic** and loops in templates
- **Macro system** for reusable components

### MCP Integration

#### Protocol Implementation
- **Model Context Protocol SDK** integration
- **Tool registration** for prompt management
- **Conversation management** with state tracking
- **Transport abstraction** for multiple client types

#### Client Compatibility
- **Claude Desktop** via STDIO transport
- **Cursor Windsurf** via STDIO transport
- **Web clients** via SSE transport
- **Custom MCP clients** via standard protocol

### Performance Considerations

#### Startup Optimization
- **Strategy-based server detection** with early termination
- **Environment variable bypass** for instant path detection
- **Conditional logging** based on verbosity level
- **Dependency management** with proper initialization order

#### Runtime Performance
- **Memory usage monitoring** with periodic reporting
- **Health check validation** every 30 seconds
- **Diagnostic collection** for troubleshooting
- **Graceful shutdown** with resource cleanup

### Key Development Guidelines

#### Configuration Management
- Use environment variables for path overrides (`MCP_SERVER_ROOT`, `MCP_PROMPTS_CONFIG_PATH`)
- Maintain separation between server config and prompts config
- Follow modular import patterns for prompt organization

#### Prompt Development
- Use Nunjucks templating for dynamic content
- Define clear argument structures with validation
- Organize prompts by logical categories
- Test templates with various input scenarios

#### Error Handling
- Implement comprehensive error boundaries
- Use structured logging with appropriate levels
- Provide meaningful error messages
- Include diagnostic information for debugging

#### Testing
- Test transport layer compatibility
- Validate prompt template rendering
- Check hot-reloading functionality
- Verify MCP protocol compliance

### Environment Setup

#### Required Environment Variables
- `MCP_SERVER_ROOT`: Override server root directory detection
- `MCP_PROMPTS_CONFIG_PATH`: Direct path to prompts configuration file

#### Development Environment
- Node.js 16+ required
- TypeScript compilation with `tsc`
- File watching for hot-reloading
- Transport-specific testing modes

This architecture provides a robust, scalable system for AI prompt management with enterprise-grade features including hot-reloading, comprehensive error handling, and multi-transport support.