from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


class McpError(Exception):
    """Base class for all MCP SDK errors.

    All MCP-specific exceptions derive from this class so callers can
    catch the whole family with a single ``except McpError`` block.
    """


class ToolNotFoundError(McpError):
    """Raised when a requested tool is not registered on the server."""

    def __init__(self, tool_name: str = "") -> None:
        super().__init__(f"tool not found: {tool_name}")
        self.tool_name = tool_name


class ResourceNotFoundError(McpError):
    """Raised when a requested resource is not registered on the server."""

    def __init__(self, uri: str = "") -> None:
        super().__init__(f"resource not found: {uri}")
        self.uri = uri


class InvalidArgumentsError(McpError):
    """Raised when arguments to a tool or request are invalid."""

    def __init__(self, message: str = "") -> None:
        super().__init__(f"invalid arguments: {message}")
        self.message = message


class TransportError(McpError):
    """Raised when the transport encounters an I/O or framing error."""

    def __init__(self, message: str = "") -> None:
        super().__init__(f"transport error: {message}")
        self.message = message


class InternalError(McpError):
    """Raised for internal SDK errors (serialization, etc.)."""

    def __init__(self, message: str = "") -> None:
        super().__init__(f"internal error: {message}")
        self.message = message


@dataclass
class Resource:
    """A resource exposed by an MCP server."""

    uri: str
    name: str
    mime_type: Optional[str] = None
    description: Optional[str] = None


@dataclass
class ResourceContent:
    """Content of a resource read operation.

    Exactly one of ``text`` or ``blob`` is expected to be populated.
    """

    uri: str
    mime_type: Optional[str] = None
    text: Optional[str] = None
    blob: Optional[bytes] = None


@dataclass
class ServerCapabilities:
    """Server capability descriptor."""

    tools: bool = False
    resources: bool = False
    prompts: bool = False


@dataclass
class ServerInfo:
    """Server info returned during initialization."""

    name: str
    version: str
    capabilities: ServerCapabilities
