/**
 * Core data types for the MCP SDK.
 *
 * Mirrors `phenotype-mcp-sdk-rs`:
 * - `Resource` (lib.rs:39-45)
 * - `ResourceContent` (lib.rs:48-54)
 * - `McpError` (lib.rs:57-69) — TS class with `kind` discriminator
 * - `ServerCapabilities` (lib.rs:72-77)
 * - `ServerInfo` (lib.rs:80-85)
 */

/**
 * The five McpError variants from the Rust enum, surfaced as a string
 * discriminator on the `McpError` class.
 */
export type McpErrorKind =
  | 'ToolNotFound'
  | 'ResourceNotFound'
  | 'InvalidArguments'
  | 'Transport'
  | 'Internal';

/**
 * MCP SDK error. Use the static factory methods (`toolNotFound`,
 * `resourceNotFound`, ...) to construct — the `kind` discriminator
 * mirrors the Rust enum variant.
 */
export class McpError extends Error {
  readonly kind: McpErrorKind;
  readonly detail: string;

  constructor(kind: McpErrorKind, detail: string) {
    super(`${kind}: ${detail}`);
    this.name = 'McpError';
    this.kind = kind;
    this.detail = detail;
    // Preserve a clean stack trace in V8.
    if (typeof (Error as { captureStackTrace?: unknown }).captureStackTrace === 'function') {
      (Error as unknown as { captureStackTrace: (target: object, ctor: Function) => void })
        .captureStackTrace(this, McpError);
    }
  }

  static toolNotFound(name: string): McpError {
    return new McpError('ToolNotFound', name);
  }

  static resourceNotFound(uri: string): McpError {
    return new McpError('ResourceNotFound', uri);
  }

  static invalidArguments(msg: string): McpError {
    return new McpError('InvalidArguments', msg);
  }

  static transport(msg: string): McpError {
    return new McpError('Transport', msg);
  }

  static internal(msg: string): McpError {
    return new McpError('Internal', msg);
  }
}

/** A resource exposed by an MCP server. */
export interface Resource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

/** Content of a resource read operation. Exactly one of `text` / `blob` is set in practice. */
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: Uint8Array;
}

/** Server capability descriptor. All flags default to `false`. */
export interface ServerCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
}

/** Server info returned during initialization. */
export interface ServerInfo {
  name: string;
  version: string;
  capabilities: ServerCapabilities;
}

/** Default capabilities (all disabled). Mirrors `ServerCapabilities::default()` in Rust. */
export const DEFAULT_CAPABILITIES: ServerCapabilities = {
  tools: false,
  resources: false,
  prompts: false,
};
