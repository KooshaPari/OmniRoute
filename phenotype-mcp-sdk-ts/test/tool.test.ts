/**
 * Tests for the `Tool` class and the `mcpTool` / `mcpResource`
 * factory functions.
 *
 * Mirrors `phenotype-mcp-sdk-rs` `tool.rs:72-146`:
 *   tool_creation_and_call, tool_call_error_propagation,
 *   tool_clone_with_handler, tool_debug_does_not_panic,
 *   tool_schema_is_preserved, tool_handler_send_sync
 *
 * Plus factory tests mirroring `macros.rs:64-108`:
 *   mcp_tool_macro_builds_tool, mcp_tool_macro_error_case,
 *   mcp_tool_macro_schema_preserved, mcp_resource_macro_full,
 *   mcp_resource_macro_short
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { Tool, mcpTool, mcpResource, McpError } from '../src/index.js';

describe('Tool', () => {
  test('tool_creation_and_call', async () => {
    // Mirrors tool.rs:78-88
    const t = new Tool(
      'echo',
      'Echo the input back',
      z.object({ msg: z.string() }),
      (args: any) => args,
    );
    assert.equal(t.name, 'echo');
    assert.equal(t.description, 'Echo the input back');
    const result = await t.call({ msg: 'hello' });
    assert.deepEqual(result, { msg: 'hello' });
  });

  test('tool_call_error_propagation', async () => {
    // Mirrors tool.rs:91-101
    const t = new Tool(
      'fail',
      'Always fails',
      z.object({}),
      () => {
        throw new Error('oops');
      },
    );
    await assert.rejects(
      async () => t.call({}),
      (err: unknown) => err instanceof Error && err.message === 'oops',
    );
  });

  test('tool_call_invalid_arguments', async () => {
    // TS-specific: zod validation should throw McpError(InvalidArguments)
    const t = new Tool(
      'echo',
      'Echo',
      z.object({ msg: z.string() }),
      (args: any) => args,
    );
    await assert.rejects(
      async () => t.call({ msg: 123 }),
      (err: unknown) =>
        err instanceof McpError && err.kind === 'InvalidArguments',
    );
  });

  test('tool_clone_with_handler', async () => {
    // Mirrors tool.rs:104-124
    const t1 = new Tool(
      'add',
      'Add two numbers',
      z.object({ a: z.number(), b: z.number() }),
      (args: any) => args.a + args.b,
    );
    const t2 = t1.cloneWithHandler((args: any) => args.a - args.b);
    assert.equal(t1.name, t2.name);
    assert.equal(t1.description, t2.description);
    assert.equal(t1.inputSchema, t2.inputSchema);
    const result = await t2.call({ a: 5, b: 3 });
    assert.equal(result, 2);
  });

  test('tool_toJSON_does_not_panic', () => {
    // Mirrors tool.rs:127-132 tool_debug_does_not_panic.
    // The Rust test only checks that formatting doesn't panic; the TS
    // equivalent is that the toJSON() serializer returns a stable shape.
    const t = new Tool('x', 'y', z.object({}), () => null);
    const json = t.toJSON();
    assert.equal(json.name, 'x');
    assert.equal(json.description, 'y');
    assert.ok(json.inputSchema);
    assert.equal((json.inputSchema as { type: string }).type, 'object');
  });

  test('tool_schema_is_preserved', async () => {
    // Mirrors tool.rs:135-139
    const schema = z.object({ name: z.string() });
    const t = new Tool('greet', 'Say hi', schema, () => 'hi');
    assert.equal(t.inputSchema, schema);
    const result = await t.call({ name: 'world' });
    assert.equal(result, 'hi');
  });

  test('tool_handler_can_be_async', async () => {
    // TS-specific: handlers can be async (Rust handlers are sync).
    const t = new Tool(
      'async-add',
      'Async add',
      z.object({ a: z.number(), b: z.number() }),
      async (args: any) => args.a + args.b,
    );
    const result = await t.call({ a: 2, b: 3 });
    assert.equal(result, 5);
  });
});

describe('mcpTool factory', () => {
  test('mcp_tool_macro_builds_tool', async () => {
    // Mirrors macros.rs:65-75
    const t = mcpTool(
      'add',
      'Add two numbers',
      z.object({ a: z.number(), b: z.number() }),
      (args: any) => args.a + args.b,
    );
    assert.equal(t.name, 'add');
    assert.equal(t.description, 'Add two numbers');
    const result = await t.call({ a: 2, b: 3 });
    assert.equal(result, 5);
  });

  test('mcp_tool_macro_error_case', async () => {
    // Mirrors macros.rs:96-102
    const t = mcpTool('fail', 'Always fails', z.object({}), () => {
      throw new Error('error');
    });
    await assert.rejects(
      async () => t.call({}),
      (err: unknown) => err instanceof Error && err.message === 'error',
    );
  });

  test('mcp_tool_macro_schema_preserved', () => {
    // Mirrors macros.rs:105-108
    const schema = z.object({});
    const t = mcpTool('greet', 'Say hello', schema, (args: any) => args);
    assert.equal(t.inputSchema, schema);
  });
});

describe('mcpResource factory', () => {
  test('mcp_resource_macro_full', () => {
    // Mirrors macros.rs:78-84
    const r = mcpResource('res://docs', 'Documentation', 'text/markdown', 'API docs');
    assert.equal(r.uri, 'res://docs');
    assert.equal(r.name, 'Documentation');
    assert.equal(r.mimeType, 'text/markdown');
    assert.equal(r.description, 'API docs');
  });

  test('mcp_resource_macro_short', () => {
    // Mirrors macros.rs:87-93
    const r = mcpResource('res://readme', 'Readme');
    assert.equal(r.uri, 'res://readme');
    assert.equal(r.name, 'Readme');
    assert.equal(r.mimeType, undefined);
    assert.equal(r.description, undefined);
  });
});
