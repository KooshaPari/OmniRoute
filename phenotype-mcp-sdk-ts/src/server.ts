/**
 * Server interface and base implementation for the MCP SDK.
 *
 * Mirrors `phenotype-mcp-sdk-rs` `lib.rs:24-36` (`McpServer` trait).
 * The trait is object-safe in Rust, which corresponds to a structural
 * interface in TypeScript that any class can `implements`.
 *
 * `McpServerImpl` is a convenience base class that stores tools and
 * resources in `Map`s and provides `addTool` / `addResource` helpers.
 * It is `abstract` to mirror the Rust trait — concrete servers extend
 * it (or implement the interface directly).
 */

import { McpError, Resource, ResourceContent } from './types.js';
import { Tool } from './tool.js';

/** Core MCP server contract. */
export interface McpServer {
  /** List all tools exposed by this server. */
  listTools(): Promise<Tool[]>;
  /** Call a tool by name with the given arguments. Throws `McpError` on failure. */
  callTool(name: string, args: unknown): Promise<unknown>;
  /** List all resources exposed by this server. */
  listResources(): Promise<Resource[]>;
  /** Read a resource by its URI. Throws `McpError` on failure. */
  readResource(uri: string): Promise<ResourceContent>;
}

/**
 * Convenience base implementation. Stores tools and resources in
 * `Map`s keyed by name / URI and dispatches calls through them.
 *
 * Subclasses can override individual methods (e.g. to add auth or
 * logging) or extend via `addTool` / `addResource` only.
 */
export abstract class McpServerImpl implements McpServer {
  protected readonly tools: Map<string, Tool> = new Map();
  protected readonly resources: Map<string, Resource> = new Map();
  protected readonly resourceContents: Map<string, ResourceContent> = new Map();

  /** Register a tool under its `name`. Replaces any existing tool with the same name. */
  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /** Register a resource. If `content` is provided, it becomes the default read result. */
  addResource(resource: Resource, content?: ResourceContent): void {
    this.resources.set(resource.uri, resource);
    if (content !== undefined) {
      this.resourceContents.set(resource.uri, content);
    }
  }

  async listTools(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }

  async callTool(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw McpError.toolNotFound(name);
    }
    return await tool.call(args);
  }

  async listResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  async readResource(uri: string): Promise<ResourceContent> {
    const content = this.resourceContents.get(uri);
    if (!content) {
      throw McpError.resourceNotFound(uri);
    }
    return content;
  }
}
