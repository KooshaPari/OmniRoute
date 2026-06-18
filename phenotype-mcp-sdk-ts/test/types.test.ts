/**
 * Tests for the data-type layer: McpError, Resource, ResourceContent,
 * ServerCapabilities, ServerInfo.
 *
 * Mirrors `phenotype-mcp-sdk-rs` `lib.rs:87-177`:
 *   mcp_error_display, server_info_round_trip,
 *   resource_content_has_text_or_blob, resource_serde_round_trip,
 *   mcp_error_tool_not_found, mcp_error_resource_not_found,
 *   mcp_error_invalid_arguments, mcp_error_transport,
 *   mcp_error_internal, server_capabilities_default
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  McpError,
  Resource,
  ResourceContent,
  ServerCapabilities,
  ServerInfo,
  DEFAULT_CAPABILITIES,
} from '../src/index.js';

describe('McpError', () => {
  test('mcp_error_display includes the detail', () => {
    // Mirrors lib.rs:93-96 mcp_error_display
    const e = McpError.toolNotFound('foo');
    assert.ok(e.message.includes('foo'));
    assert.ok(e.message.includes('ToolNotFound'));
  });

  test('mcp_error_tool_not_found', () => {
    // Mirrors lib.rs:141-144
    const e = McpError.toolNotFound('missing');
    assert.equal(e.kind, 'ToolNotFound');
    assert.equal(e.detail, 'missing');
    assert.ok(e instanceof Error);
  });

  test('mcp_error_resource_not_found', () => {
    // Mirrors lib.rs:147-150
    const e = McpError.resourceNotFound('missing');
    assert.equal(e.kind, 'ResourceNotFound');
    assert.equal(e.detail, 'missing');
  });

  test('mcp_error_invalid_arguments', () => {
    // Mirrors lib.rs:153-156
    const e = McpError.invalidArguments('bad json');
    assert.equal(e.kind, 'InvalidArguments');
    assert.equal(e.detail, 'bad json');
  });

  test('mcp_error_transport', () => {
    // Mirrors lib.rs:159-162
    const e = McpError.transport('io broken');
    assert.equal(e.kind, 'Transport');
    assert.equal(e.detail, 'io broken');
  });

  test('mcp_error_internal', () => {
    // Mirrors lib.rs:165-168
    const e = McpError.internal('panic');
    assert.equal(e.kind, 'Internal');
    assert.equal(e.detail, 'panic');
  });
});

describe('ServerInfo / ServerCapabilities', () => {
  test('server_info_round_trip', () => {
    // Mirrors lib.rs:99-114
    const info: ServerInfo = {
      name: 'test-server',
      version: '0.1.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: true,
      },
    };
    const json = JSON.stringify(info);
    const back = JSON.parse(json) as ServerInfo;
    assert.equal(back.name, 'test-server');
    assert.equal(back.version, '0.1.0');
    assert.equal(back.capabilities.tools, true);
    assert.equal(back.capabilities.resources, false);
    assert.equal(back.capabilities.prompts, true);
  });

  test('server_capabilities_default', () => {
    // Mirrors lib.rs:171-176
    const cap: ServerCapabilities = DEFAULT_CAPABILITIES;
    assert.equal(cap.tools, false);
    assert.equal(cap.resources, false);
    assert.equal(cap.prompts, false);
  });
});

describe('Resource / ResourceContent', () => {
  test('resource_content_has_text_or_blob', () => {
    // Mirrors lib.rs:117-125
    const rc: ResourceContent = {
      uri: 'file:///tmp/test.txt',
      mimeType: 'text/plain',
      text: 'hello',
    };
    assert.equal(rc.text, 'hello');
    assert.equal(rc.blob, undefined);
  });

  test('resource_serde_round_trip', () => {
    // Mirrors lib.rs:128-138
    const r: Resource = {
      uri: 'res://docs',
      name: 'Documentation',
      mimeType: 'text/markdown',
      description: 'API docs',
    };
    const json = JSON.stringify(r);
    const back = JSON.parse(json) as Resource;
    assert.equal(back.uri, 'res://docs');
    assert.equal(back.name, 'Documentation');
    assert.equal(back.mimeType, 'text/markdown');
    assert.equal(back.description, 'API docs');
  });
});
