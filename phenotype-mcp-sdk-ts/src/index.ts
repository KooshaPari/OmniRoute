/**
 * Public entry point for `phenotype-mcp-sdk-ts`.
 *
 * Re-exports the data types, the `Tool` class, the `McpServer`
 * interface and `McpServerImpl` base class, the stdio/SSE
 * transports, and the `mcpTool` / `mcpResource` factory functions.
 *
 * Surface mirrors `phenotype-mcp-sdk-rs` 1:1 (lib.rs, tool.rs,
 * transport.rs, macros.rs).
 */

export {
  McpError,
  type McpErrorKind,
  type Resource,
  type ResourceContent,
  type ServerCapabilities,
  type ServerInfo,
  DEFAULT_CAPABILITIES,
} from './types.js';

export { Tool, type ToolHandler, type JsonSchema } from './tool.js';

export { McpServer, McpServerImpl } from './server.js';

export { StdioTransport, SseTransport } from './transport.js';

export { mcpTool, mcpResource } from './macros.js';
