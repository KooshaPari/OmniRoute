# phenotype-mcp-sdk-ts

TypeScript MCP SDK — server interface, tool/resource abstractions, and
stdio/SSE transports. Mirrors the Rust
[`phenotype-mcp-sdk-rs`](https://github.com/KooshaPari/AgilePlus)
crate 1:1 (same file layout: `lib.rs` → `server.ts` / `types.ts`,
`tool.rs` → `tool.ts`, `transport.rs` → `transport.rs`,
`macros.rs` → `macros.ts`).

## Install

```bash
npm install
```

`zod` is the only runtime dependency (used for `Tool.inputSchema`
validation and JSON-Schema conversion).

## Quick start

```typescript
import { z } from 'zod';
import {
  McpServerImpl,
  StdioTransport,
  mcpTool,
  mcpResource,
} from 'phenotype-mcp-sdk-ts';

class MyServer extends McpServerImpl {
  constructor() {
    super();
    this.addTool(
      mcpTool(
        'echo',
        'Echo the input back',
        z.object({ msg: z.string() }),
        async (args) => ({ echoed: args.msg }),
      ),
    );
    this.addResource(
      mcpResource('res://readme', 'Readme', 'text/markdown', 'Project README'),
      { uri: 'res://readme', mimeType: 'text/markdown', text: '# Hello' },
    );
  }
}

const server = new MyServer();
const transport = new StdioTransport(server);
await transport.run();
```

The transport reads one JSON object per line from `stdin` and writes
one JSON object per line to `stdout`. Four methods are supported:

- `tools/list` — returns `{ tools: [{ name, description, inputSchema }] }`
- `tools/call` — returns `{ result: ... }`; args are validated against
  the tool's zod `inputSchema` (a `McpError` with kind `InvalidArguments`
  is thrown on failure)
- `resources/list` — returns `{ resources: [...] }`
- `resources/read` — returns `{ content: ... }`; throws
  `McpError.resourceNotFound` for unknown URIs

Errors are written back as `{ error: { kind, message } }` lines.

## API

### Interfaces and data types

- `McpServer` — interface with `listTools`, `callTool`, `listResources`,
  `readResource`
- `McpServerImpl` — abstract base class with `addTool` / `addResource`
  helpers; delegates all four methods through internal `Map`s
- `Resource` — `{ uri, name, mimeType?, description? }`
- `ResourceContent` — `{ uri, mimeType?, text?, blob? }`
- `ServerCapabilities` — `{ tools, resources, prompts }` (booleans)
- `ServerInfo` — `{ name, version, capabilities }`
- `DEFAULT_CAPABILITIES` — all flags `false`

### `McpError` (class)

A single class with a `kind` discriminator — no Rust-style enum:

```typescript
type McpErrorKind =
  | 'ToolNotFound'
  | 'ResourceNotFound'
  | 'InvalidArguments'
  | 'Transport'
  | 'Internal';
```

Construct via the static factory methods:

```typescript
McpError.toolNotFound(name);
McpError.resourceNotFound(uri);
McpError.invalidArguments(msg);
McpError.transport(msg);
McpError.internal(msg);
```

### `Tool` (class)

```typescript
const t = new Tool(
  'echo',
  'Echo the input',
  z.object({ msg: z.string() }),
  async (args) => args,
);

await t.call({ msg: 'hi' });         // invokes the handler
const t2 = t.cloneWithHandler(fn);   // same metadata, new handler
const j  = t.toJSON();               // { name, description, inputSchema }
```

### Transports

- `StdioTransport` — wraps a `McpServer`, exposes `run()`, `handleRequest()`
- `SseTransport` — stub for HTTP+SSE (matches the Rust placeholder)

### Factories

- `mcpTool(name, description, schema, handler)` — builds a `Tool`
- `mcpResource(uri, name, mimeType?, description?)` — builds a `Resource`

## Build & test

```bash
npm run build   # tsc → dist/
npm test        # node --test --import tsx test/*.test.ts
```

## Layout

```
phenotype-mcp-sdk-ts/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # barrel export
│   ├── types.ts        # Resource, ResourceContent, McpError, ServerInfo, ServerCapabilities
│   ├── server.ts       # McpServer interface, McpServerImpl base class
│   ├── tool.ts         # Tool class with zod validation
│   ├── transport.ts    # StdioTransport, SseTransport
│   └── macros.ts       # mcpTool, mcpResource factories
├── test/
│   ├── types.test.ts
│   ├── tool.test.ts
│   └── transport.test.ts
└── README.md
```

## License

MIT
