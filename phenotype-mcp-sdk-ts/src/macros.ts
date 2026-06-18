/**
 * Declarative factory functions for the MCP SDK.
 *
 * TypeScript has no preprocessor macros, so the Rust `mcp_tool!` and
 * `mcp_resource!` macros become plain factory functions. Behaviour
 * matches the Rust versions in `macros.rs`:
 * - `mcpTool(name, description, schema, handler)` — `Tool::new`
 * - `mcpResource(uri, name, mimeType?, description?)` — `Resource { ... }`
 *   with the 4-arg form setting both `mimeType` and `description`,
 *   and the 2-arg form leaving both as `undefined`.
 */

import type { z } from 'zod';
import type { Resource } from './types.js';
import { Tool, ToolHandler } from './tool.js';

/** Build a `Tool` with a zod schema and a handler. */
export function mcpTool(
  name: string,
  description: string,
  schema: z.ZodTypeAny,
  handler: ToolHandler,
): Tool {
  return new Tool(name, description, schema, handler);
}

/**
 * Build a `Resource`.
 * - 4-arg form: `mimeType` and `description` both set.
 * - 2-arg form: both left as `undefined`.
 */
export function mcpResource(
  uri: string,
  name: string,
  mimeType?: string,
  description?: string,
): Resource {
  const r: Resource = { uri, name };
  if (mimeType !== undefined) {
    r.mimeType = mimeType;
  }
  if (description !== undefined) {
    r.description = description;
  }
  return r;
}
