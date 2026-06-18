from __future__ import annotations

import asyncio
import json
import sys
from typing import Any, Awaitable, Callable, Optional

from .server import McpServer
from .types import (
    InternalError,
    InvalidArgumentsError,
    McpError,
    ResourceNotFoundError,
    TransportError,
)


class StdioTransport:
    """Stdio transport for MCP JSON-RPC messages.

    Reads one JSON object per line from stdin, dispatches to the
    server, and writes the response as a single JSON line to stdout.

    The default :meth:`run` uses :data:`sys.stdin.buffer` and
    :data:`sys.stdout.buffer`.  Tests can drive the dispatch logic
    directly via :meth:`handle_request` without touching real I/O.
    """

    def __init__(self, server: McpServer) -> None:
        self.server = server

    def __repr__(self) -> str:
        return f"StdioTransport(server={self.server!r})"

    async def run(self) -> None:
        """Run the transport loop on the current thread.

        Reads newline-delimited JSON from ``sys.stdin.buffer`` and
        writes JSON responses to ``sys.stdout.buffer`` until EOF.
        """
        loop = asyncio.get_running_loop()
        reader = sys.stdin.buffer
        writer = sys.stdout.buffer

        while True:
            line = await loop.run_in_executor(None, reader.readline)
            if not line:
                return
            await self._serve_line(line, writer)

    async def _serve_line(self, raw_line: bytes, writer: Any) -> None:
        """Process a single line and write the response to ``writer``."""
        loop = asyncio.get_running_loop()
        try:
            text = raw_line.decode("utf-8").strip()
            if not text:
                return
            request = json.loads(text)
            result = await self.handle_request(request)
            response: dict = {"result": result}
        except McpError as exc:
            response = {"error": {"message": str(exc)}}
        except json.JSONDecodeError as exc:
            response = {"error": {"message": f"invalid JSON: {exc}"}}

        payload = (json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8")
        await loop.run_in_executor(None, writer.write, payload)
        await loop.run_in_executor(None, writer.flush)

    async def handle_request(self, request: dict) -> Any:
        """Dispatch a parsed request and return the success value.

        Raises :class:`McpError` (or one of its subclasses) on failure
        — the I/O loop in :meth:`run` catches these and turns them
        into JSON-RPC error responses.
        """
        method = request.get("method")
        if not isinstance(method, str):
            raise InvalidArgumentsError("missing or non-string 'method'")

        if method == "tools/list":
            tools = await self.server.list_tools()
            return {
                "tools": [
                    {
                        "name": t.name,
                        "description": t.description,
                        "inputSchema": t.input_schema,
                    }
                    for t in tools
                ]
            }

        if method == "tools/call":
            params = request.get("params") or {}
            name = params.get("name")
            if not isinstance(name, str):
                raise InvalidArgumentsError("missing name")
            arguments = params.get("arguments") or {}
            if not isinstance(arguments, dict):
                raise InvalidArgumentsError("'arguments' must be an object")
            result = await self.server.call_tool(name, arguments)
            # If the server returned a coroutine (async handler that
            # was not awaited), resolve it here.
            if asyncio.iscoroutine(result):
                result = await result
            return {"result": result}

        if method == "resources/list":
            resources = await self.server.list_resources()
            # ``dataclasses.asdict`` would also work, but we keep the
            # serialization explicit so callers can reason about the
            # wire format.
            return {
                "resources": [
                    {
                        "uri": r.uri,
                        "name": r.name,
                        "mime_type": r.mime_type,
                        "description": r.description,
                    }
                    for r in resources
                ]
            }

        if method == "resources/read":
            params = request.get("params") or {}
            uri = params.get("uri")
            if not isinstance(uri, str):
                raise InvalidArgumentsError("missing uri")
            content = await self.server.read_resource(uri)
            return {
                "content": {
                    "uri": content.uri,
                    "mime_type": content.mime_type,
                    "text": content.text,
                    # Base64-encode bytes for JSON transport safety.
                    "blob": (
                        content.blob.decode("latin-1")
                        if isinstance(content.blob, (bytes, bytearray))
                        else content.blob
                    ),
                }
            }

        raise InvalidArgumentsError(f"unknown method: {method}")


class SseTransport:
    """SSE transport placeholder.

    Will bind to an HTTP endpoint and stream MCP messages over
    Server-Sent Events.  Currently a stub; the full implementation
    requires an HTTP server framework.
    """

    def __init__(self, server: McpServer) -> None:
        self.server = server

    def __repr__(self) -> str:
        return f"SseTransport(server={self.server!r})"

    async def serve(self, addr: str) -> None:
        """Placeholder for the SSE serve loop.  Always returns ``None``."""
        # TODO: implement HTTP/SSE streaming.
        return None
