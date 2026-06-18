"""phenotype-mcp-sdk-py — Python MCP SDK.

Mirrors the Rust ``phenotype-mcp-sdk-rs`` surface 1:1, providing:

* :class:`McpServer` — async abstract base class for MCP servers.
* :class:`Tool` — named operation with a JSON schema and a handler.
* :class:`Resource` / :class:`ResourceContent` — resource descriptors.
* :class:`ServerCapabilities` / :class:`ServerInfo` — server metadata.
* :class:`McpError` and its five subclasses for error reporting.
* :class:`StdioTransport` / :class:`SseTransport` for I/O.
* :func:`mcp_tool` / :func:`mcp_resource` factory functions.

See ``README.md`` for a usage example.
"""

from __future__ import annotations

from .macros import mcp_resource, mcp_tool
from .server import McpServer
from .tool import Tool
from .transport import SseTransport, StdioTransport
from .types import (
    InternalError,
    InvalidArgumentsError,
    McpError,
    Resource,
    ResourceContent,
    ResourceNotFoundError,
    ServerCapabilities,
    ServerInfo,
    ToolNotFoundError,
    TransportError,
)

__all__ = [
    # Errors
    "McpError",
    "ToolNotFoundError",
    "ResourceNotFoundError",
    "InvalidArgumentsError",
    "TransportError",
    "InternalError",
    # Data types
    "Resource",
    "ResourceContent",
    "ServerCapabilities",
    "ServerInfo",
    # Server / tool abstractions
    "McpServer",
    "Tool",
    # Transports
    "StdioTransport",
    "SseTransport",
    # Factories
    "mcp_tool",
    "mcp_resource",
]

__version__ = "0.1.0"
