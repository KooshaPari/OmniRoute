"""Tests for ``phenotype_mcp_sdk_py.transport``.

Mirrors the Rust unit tests in
``AgilePlus/crates/phenotype-mcp-sdk-rs/src/transport.rs`` lines 132-213.
"""

from __future__ import annotations

import io
import json

import pytest

from phenotype_mcp_sdk_py import (
    InvalidArgumentsError,
    McpServer,
    Resource,
    ResourceContent,
    ResourceNotFoundError,
    SseTransport,
    StdioTransport,
    Tool,
)
from phenotype_mcp_sdk_py.tool import Tool as ToolType  # for clarity in isinstance checks


class MockServer(McpServer):
    """Minimal server used to exercise the transport dispatch logic."""

    async def list_tools(self):
        return [
            Tool.new(
                "echo",
                "echo",
                {},
                lambda args: args,
            )
        ]

    async def call_tool(self, name, arguments):
        return "ok"

    async def list_resources(self):
        return [
            Resource(
                uri="res://docs",
                name="Documentation",
                mime_type="text/markdown",
                description="API docs",
            )
        ]

    async def read_resource(self, uri):
        raise ResourceNotFoundError("x")


class EmptyServer(McpServer):
    """Server with no tools and no resources — useful for negative tests."""

    async def list_tools(self):
        return []

    async def call_tool(self, name, arguments):
        return None

    async def list_resources(self):
        return []

    async def read_resource(self, uri):
        raise ResourceNotFoundError(uri)


async def test_stdio_transport_new() -> None:
    """The transport wraps the server and exposes it for direct calls."""
    transport = StdioTransport(MockServer())
    tools = await transport.server.list_tools()
    assert len(tools) == 1
    assert isinstance(tools[0], ToolType)


async def test_sse_transport_new() -> None:
    """``SseTransport.serve`` is a stub that returns ``None`` without raising."""
    transport = SseTransport(MockServer())
    result = await transport.serve("127.0.0.1:0")
    assert result is None


async def test_sse_transport_server_access() -> None:
    """``SseTransport`` exposes the inner server for direct calls."""
    transport = SseTransport(MockServer())
    tools = await transport.server.list_tools()
    assert len(tools) == 1
    assert tools[0].name == "echo"


def test_stdio_transport_debug() -> None:
    """``repr(transport)`` does not panic and includes the class name."""
    t = StdioTransport(MockServer())
    dbg = repr(t)
    assert "StdioTransport" in dbg


async def test_stdio_transport_handle_tools_list() -> None:
    """``tools/list`` returns a dict with a ``tools`` key."""
    transport = StdioTransport(MockServer())
    resp = await transport.handle_request({"method": "tools/list"})
    assert "tools" in resp
    assert isinstance(resp["tools"], list)
    assert resp["tools"][0]["name"] == "echo"
    assert "inputSchema" in resp["tools"][0]


async def test_stdio_transport_handle_unknown_method() -> None:
    """An unknown method raises :class:`InvalidArgumentsError`."""
    transport = StdioTransport(MockServer())
    with pytest.raises(InvalidArgumentsError) as exc_info:
        await transport.handle_request({"method": "bogus"})
    assert "unknown method" in str(exc_info.value)


async def test_stdio_transport_handle_tools_call() -> None:
    """``tools/call`` returns a dict with a ``result`` key."""
    transport = StdioTransport(MockServer())
    resp = await transport.handle_request(
        {"method": "tools/call", "params": {"name": "echo", "arguments": {}}}
    )
    assert "result" in resp
    assert resp["result"] == "ok"


async def test_stdio_transport_handle_resources_list() -> None:
    """``resources/list`` returns a dict with a ``resources`` key."""
    transport = StdioTransport(MockServer())
    resp = await transport.handle_request({"method": "resources/list"})
    assert "resources" in resp
    assert resp["resources"][0]["uri"] == "res://docs"


async def test_stdio_transport_handle_resources_read_missing_uri() -> None:
    """``resources/read`` without a ``uri`` parameter raises."""
    transport = StdioTransport(MockServer())
    with pytest.raises(InvalidArgumentsError) as exc_info:
        await transport.handle_request({"method": "resources/read", "params": {}})
    assert "uri" in str(exc_info.value)


async def test_stdio_transport_handle_tools_call_missing_name() -> None:
    """``tools/call`` without a ``name`` parameter raises."""
    transport = StdioTransport(EmptyServer())
    with pytest.raises(InvalidArgumentsError) as exc_info:
        await transport.handle_request({"method": "tools/call", "params": {}})
    assert "name" in str(exc_info.value)


async def test_run_loop_with_injected_streams() -> None:
    """End-to-end: feed lines in via an injected stream, read responses back."""
    transport = StdioTransport(MockServer())
    input_buf = io.BytesIO()
    output_buf = io.BytesIO()

    # Build a couple of newline-delimited requests.
    requests = [
        json.dumps({"method": "tools/list"}),
        json.dumps({"method": "tools/call", "params": {"name": "echo", "arguments": {"x": 1}}}),
        json.dumps({"method": "resources/list"}),
    ]
    input_buf.write(("\n".join(requests) + "\n").encode("utf-8"))
    input_buf.seek(0)

    # Drive the loop directly with the injected streams.
    await _drive_loop(transport, input_buf, output_buf)

    output_buf.seek(0)
    lines = [line for line in output_buf.read().decode("utf-8").split("\n") if line]
    assert len(lines) == 3
    parsed = [json.loads(line) for line in lines]
    assert "tools" in parsed[0]["result"]
    assert parsed[1]["result"] == {"result": "ok"}
    assert "resources" in parsed[2]["result"]


async def _drive_loop(transport: StdioTransport, input_buf: io.BytesIO, output_buf: io.BytesIO) -> None:
    """Drive a transport loop synchronously from two in-memory buffers.

    This is a helper used by the integration test above.  It reads a line
    at a time from ``input_buf``, dispatches via
    :meth:`StdioTransport.handle_request`, and writes the response to
    ``output_buf``.  EOF terminates the loop.
    """
    while True:
        raw = input_buf.readline()
        if not raw:
            return
        await transport._serve_line(raw, output_buf)
