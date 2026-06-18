/**
 * Tool abstraction for the MCP SDK.
 *
 * Mirrors `phenotype-mcp-sdk-rs` `tool.rs`:
 * - `Tool` struct (tool.rs:16-21) — name, description, inputSchema, handler
 * - `Tool::new` (tool.rs:25-40)
 * - `Tool::call` (tool.rs:43-45) — validates args against the zod schema,
 *   then invokes the handler
 * - `Tool::clone_with_handler` (tool.rs:48-58) — same metadata, new handler
 *
 * Differences from Rust:
 * - `inputSchema` is a `z.ZodTypeAny` (zod schema) rather than a
 *   pre-computed JSON Schema. `toJSONSchema()` converts it for
 *   transport serialization.
 * - The handler can be sync or async; `call` always returns a Promise.
 *   Handler errors propagate as-is (the transport wraps them in
 *   `McpError.internal`).
 */

import { z } from 'zod';
import { McpError } from './types.js';

/** Handler signature: receives validated args, returns the tool result (sync or async). */
export type ToolHandler = (args: any) => any | Promise<any>;

/** A JSON Schema fragment. */
export type JsonSchema = Record<string, unknown>;

/**
 * Convert a zod schema to a JSON Schema object. Uses `zod`'s
 * internal `_def` to handle the common types (object, string, number,
 * boolean, array, enum, optional, default, nullable). Unknown types
 * fall back to `{ "type": "object" }`.
 */
function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  // Best-effort: handle the common zod type names. Each branch uses
  // the internal `_def` shape which is stable across zod 3.x.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def: any = (schema as any)._def;
  if (!def || !def.typeName) {
    return { type: 'object' };
  }

  switch (def.typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodNull':
      return { type: 'null' };
    case 'ZodBigInt':
      return { type: 'integer' };
    case 'ZodDate':
      return { type: 'string', format: 'date-time' };
    case 'ZodLiteral': {
      const v = def.value;
      if (typeof v === 'string') return { type: 'string', enum: [v] };
      if (typeof v === 'number') return { type: 'number', enum: [v] };
      if (typeof v === 'boolean') return { type: 'boolean', enum: [v] };
      return { const: v };
    }
    case 'ZodEnum': {
      const values: ReadonlyArray<string | number> = def.values ?? [];
      const allString = values.every((v) => typeof v === 'string');
      return allString
        ? { type: 'string', enum: values as string[] }
        : { enum: values };
    }
    case 'ZodNativeEnum': {
      const values = Object.values(def.values ?? {});
      return { enum: values };
    }
    case 'ZodArray': {
      const inner: z.ZodTypeAny = def.type;
      return { type: 'array', items: zodToJsonSchema(inner) };
    }
    case 'ZodObject': {
      // `def.shape()` is a function in zod 3 — call it to get the live shape.
      const shapeFn = def.shape as unknown;
      const shape: Record<string, z.ZodTypeAny> =
        typeof shapeFn === 'function'
          ? (shapeFn as () => Record<string, z.ZodTypeAny>)()
          : (shapeFn as Record<string, z.ZodTypeAny>);
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const innerName = (value as any)?._def?.typeName;
        if (innerName !== 'ZodOptional' && innerName !== 'ZodDefault') {
          required.push(key);
        }
      }
      const out: JsonSchema = { type: 'object', properties };
      if (required.length > 0) {
        out.required = required;
      }
      return out;
    }
    case 'ZodOptional':
      return zodToJsonSchema(def.innerType as z.ZodTypeAny);
    case 'ZodNullable': {
      const inner = zodToJsonSchema(def.innerType as z.ZodTypeAny);
      return { ...inner, nullable: true };
    }
    case 'ZodDefault':
      return zodToJsonSchema(def.innerType as z.ZodTypeAny);
    case 'ZodUnion': {
      const options: z.ZodTypeAny[] = (def.options as z.ZodTypeAny[]) ?? [];
      return { anyOf: options.map((o) => zodToJsonSchema(o)) };
    }
    case 'ZodDiscriminatedUnion': {
      const options: z.ZodTypeAny[] =
        (def.options as (z.ZodTypeAny[] | Record<string, z.ZodTypeAny>)) instanceof Array
          ? ((def.options as z.ZodTypeAny[]))
          : (Object.values(def.options as Record<string, z.ZodTypeAny>));
      return { oneOf: options.map((o) => zodToJsonSchema(o)) };
    }
    case 'ZodRecord': {
      const valueType: z.ZodTypeAny = def.valueType;
      return {
        type: 'object',
        additionalProperties: zodToJsonSchema(valueType),
      };
    }
    case 'ZodTuple': {
      const items: z.ZodTypeAny[] = (def.items as z.ZodTypeAny[]) ?? [];
      return {
        type: 'array',
        items: items.map((i) => zodToJsonSchema(i)),
        minItems: items.length,
        maxItems: items.length,
      };
    }
    default:
      return { type: 'object' };
  }
}

/**
 * An MCP tool.
 *
 * Construct with `new Tool(name, description, inputSchema, handler)` or
 * the `mcpTool` factory. The handler is stored as a closure property
 * (not boxed as in Rust); pass it explicitly to `cloneWithHandler` to
 * swap it.
 */
export class Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodTypeAny;
  readonly handler: ToolHandler;

  constructor(
    name: string,
    description: string,
    inputSchema: z.ZodTypeAny,
    handler: ToolHandler,
  ) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.handler = handler;
  }

  /**
   * Invoke the tool handler. Validates `args` against `inputSchema`
   * and throws `McpError` (kind `InvalidArguments`) on failure.
   * Handler errors propagate as-is.
   */
  async call(args: unknown): Promise<unknown> {
    const parsed = this.inputSchema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
          return `${path}: ${issue.message}`;
        })
        .join('; ');
      throw McpError.invalidArguments(issues);
    }
    return await this.handler(parsed.data);
  }

  /**
   * Clone the tool metadata and swap in a new handler. The schema and
   * name/description are preserved.
   */
  cloneWithHandler(newHandler: ToolHandler): Tool {
    return new Tool(this.name, this.description, this.inputSchema, newHandler);
  }

  /** Convert the zod input schema to a JSON Schema object. */
  toJSONSchema(): JsonSchema {
    return zodToJsonSchema(this.inputSchema);
  }

  /**
   * Serialize the tool for the `tools/list` transport response.
   * Mirrors the JSON shape produced by the Rust transport at
   * `transport.rs:60-67`:
   *   `{ "name": ..., "description": ..., "inputSchema": ... }`
   */
  toJSON(): { name: string; description: string; inputSchema: JsonSchema } {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.toJSONSchema(),
    };
  }
}
