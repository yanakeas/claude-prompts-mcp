/**
 * Index file that re-exports everything from server.ts
 * This is for backward compatibility with existing code that imports from 'index.js'
 */

// Main server implementation has been moved to server.ts
// This file is kept for backward compatibility
console.log(
  "NOTE: The MCP server has been migrated to OpenAI. Using server.ts implementation."
);

export * from "./server.js";

// Import server and re-export
import * as server from "./server.js";
export default server;
