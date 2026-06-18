# phenotype-mcp-sdk-py

Python MCP SDK — a 1:1 mirror of the Rust
[`phenotype-mcp-sdk-rs`](https://github.com/KooshaPari/AgilePlus/tree/main/crates/phenotype-mcp-sdk-rs)
surface.  The package provides a small, pluggable MCP server runtime
with a tool/resource abstraction and two transports (stdio and a
SSE placeholder).

## Installation

```bash
pip install -e ".[dev]"
```

## Usage

```python
import asyncio
from phenotype_mcp_sdk_py import (
    McpServer,
    StdioTransport,
    Tool,
    mcp_tool,
    mcp_resource,
    Resource,
)


class MyServer(McpServer):
    async def list_tools(self):
        return [
            mcp_tool(
                "echo",
                "Echo the input back",
                {"type": "object", "properties": {"msg": {"type": "string"}}},
                lambda args: args,
            )
        ]

    async def call_tool(self, name, arguments):
        for t in await self.list_tools():
            if t.name == name:
                return t.call(arguments)
        return None

    async def list_resources(self):
        return [
            mcp_resource(
                "res://readme",
                "Readme",
                mime="text/markdown",
                desc="Project readme",
            )
        ]

    async def read_resource(self, uri):
        return None  # implement as needed


async def main():
    server = MyServer()
    transport = StdioTransport(server)
    await transport.run()  # blocks, reading from stdin / writing to stdout


if __name__ == "__main__":
    asyncio.run(main())
```

## API surface

| Symbol | Description |
|---|---|
| `McpServer` | Async ABC for MCP servers. |
| `Tool` | Named operation with a JSON schema and a handler. |
| `Resource` / `ResourceContent` | Resource descriptors. |
| `ServerCapabilities` / `ServerInfo` | Server metadata. |
| `McpError` (+ 5 subclasses) | Error hierarchy. |
| `StdioTransport` | Reads newline-delimited JSON from stdin, writes to stdout. |
| `SseTransport` | Placeholder for an HTTP/SSE transport. |
| `mcp_tool` / `mcp_resource` | Factory functions (Python equivalent of the Rust `mcp_tool!` / `mcp_resource!` macros). |

## Testing

```bash
pytest -v
```

## License

MIT
