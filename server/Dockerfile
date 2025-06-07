# Multi-stage build for optimal image size
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy prompts directory if it exists
COPY --from=builder /app/prompts ./prompts 2>/dev/null || true

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpserver -u 1001

# Change ownership of the app directory
RUN chown -R mcpserver:nodejs /app

# Switch to non-root user
USER mcpserver

# Expose port (MCP servers typically don't need exposed ports, but good to have)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const health = require('./dist/index.js').getApplicationHealth(); process.exit(health.server ? 0 : 1)" || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV MCP_SERVER_ROOT=/app

# Start the server
CMD ["node", "dist/index.js", "--transport=stdio", "--quiet"]