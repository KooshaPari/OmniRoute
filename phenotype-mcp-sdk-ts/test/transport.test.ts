/**
 * Tests for `StdioTransport` and `SseTransport`.
 *
 * Mirrors `phenotype-mcp-sdk-rs` `transport.rs:132-213`:
 *   stdio_transport_new, sse_transport_new, sse_transport_server_access,
 *   stdio_transport_debug, stdio_transport_handle_tools_list,
 *   stdio_transport_handle_unknown_method, stdio_transport_handle_tools_call
 *
 * Also covers the `resources/list` and `resources/read` request shapes
 * (transport.rs:85-97) for parity with the Rust handle_request switch.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import {
  StdioTransport,
  SseTransport,
  McpServerImpl,
  McpError,
  mcpTool,
  mcpResource,
  type McpServer,
} from '../src/index.js';

/** Mock server mirroring `MockServer` in transport.rs:139-160. */
class MockServer extends McpServerImpl {
  constructor() {
    super();
    this.addTool(
      mcpTool('echo', 'echo', z.object({}).passthrough(), (args: unknown) => args),
    );
    this.addResource(
      mcpResource('res://readme', 'Readme', 'text/markdown', 'Project readme'),
      { uri: 'res://readme', mimeType: 'text/markdown', text: '# Hello' },
    );
  }

  // Override to mirror the Rust mock: always returns "ok" for any
  // tool name unless the tool exists in the map (in which case the
  // default McpServerImpl path handles it).
  async callTool(name: string, args: unknown): Promise<unknown> {
    if (name === 'special') return 'mock-special';
    return super.callTool(name, args);
  }

  // Override to mirror the Rust mock: read_resource returns
  // ResourceNotFound for any uri unless it's the registered one.
  async readResource(uri: string) {
    if (uri === 'res://readme') {
      return { uri, mimeType: 'text/markdown', text: '# Hello' };
    }
    throw McpError.resourceNotFound(uri);
  }
}

describe('StdioTransport', () => {
  test('stdio_transport_new', () => {
    // Mirrors transport.rs:163-166
    const server = new MockServer();
    const transport = new StdioTransport(server);
    assert.equal(transport.getServer(), server);
  });

  test('stdio_transport_to_string', () => {
    // Mirrors transport.rs:183-187 stdio_transport_debug —
    // verifies that stringification doesn't panic and includes the
    // class name.
    const transport = new StdioTransport(new MockServer());
    const s = transport.toString();
    assert.ok(s.includes('StdioTransport'));
  });

  test('stdio_transport_handle_tools_list', async () => {
    // Mirrors transport.rs:190-195
    const transport = new StdioTransport(new MockServer());
    const resp = (await transport.handleRequest({ method: 'tools/list' })) as {
      tools: Array<{ name: string; description: string; inputSchema: unknown }>;
    };
    assert.ok(Array.isArray(resp.tools));
    assert.ok(resp.tools.length >= 1);
    const echo = resp.tools.find((t) => t.name === 'echo');
    assert.ok(echo);
    assert.equal(echo.description, 'echo');
    assert.ok(echo.inputSchema);
  });

  test('stdio_transport_handle_unknown_method', async () => {
    // Mirrors transport.rs:198-204
    const transport = new StdioTransport(new MockServer());
    await assert.rejects(
      async () => transport.handleRequest({ method: 'bogus' }),
      (err: unknown) =>
        err instanceof McpError &&
        err.kind === 'InvalidArguments' &&
        err.detail.includes('unknown method'),
    );
  });

  test('stdio_transport_handle_tools_call', async () => {
    // Mirrors transport.rs:207-212
    const transport = new StdioTransport(new MockServer());
    const resp = (await transport.handleRequest({
      method: 'tools/call',
      params: { name: 'echo', arguments: {} },
    })) as { result: unknown };
    assert.ok('result' in resp);
  });

  test('stdio_transport_handle_tools_call_missing_name', async () => {
    // TS-specific: validate that params.name is required.
    const transport = new StdioTransport(new MockServer());
    await assert.rejects(
      async () => transport.handleRequest({ method: 'tools/call', params: {} }),
      (err: unknown) =>
        err instanceof McpError && err.kind === 'InvalidArguments',
    );
  });

  test('stdio_transport_handle_resources_list', async () => {
    // Mirrors transport.rs:85-88
    const transport = new StdioTransport(new MockServer());
    const resp = (await transport.handleRequest({ method: 'resources/list' })) as {
      resources: Array<{ uri: string; name: string }>;
    };
    assert.ok(Array.isArray(resp.resources));
    assert.equal(resp.resources.length, 1);
    assert.equal(resp.resources[0].uri, 'res://readme');
  });

  test('stdio_transport_handle_resources_read', async () => {
    // Mirrors transport.rs:89-97
    const transport = new StdioTransport(new MockServer());
    const resp = (await transport.handleRequest({
      method: 'resources/read',
      params: { uri: 'res://readme' },
    })) as { content: { text: string } };
    assert.equal(resp.content.text, '# Hello');
  });

  test('stdio_transport_handle_resources_read_not_found', async () => {
    const transport = new StdioTransport(new MockServer());
    await assert.rejects(
      async () =>
        transport.handleRequest({
          method: 'resources/read',
          params: { uri: 'res://missing' },
        }),
      (err: unknown) =>
        err instanceof McpError && err.kind === 'ResourceNotFound',
    );
  });
});

describe('SseTransport', () => {
  test('sse_transport_new', async () => {
    // Mirrors transport.rs:169-172
    const server: McpServer = new MockServer();
    const transport = new SseTransport(server);
    // serve() is a stub and returns successfully.
    const result = await transport.serve('127.0.0.1:0');
    assert.equal(result, undefined);
  });

  test('sse_transport_server_access', async () => {
    // Mirrors transport.rs:175-180
    const server: McpServer = new MockServer();
    const transport = new SseTransport(server);
    const inner = transport.getServer();
    const tools = await inner.listTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, 'echo');
  });
});
