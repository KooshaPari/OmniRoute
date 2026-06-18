from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .tool import Tool
from .types import Resource, ResourceContent


class McpServer(ABC):
    """Core MCP server interface.

    Implementors provide a catalog of tools and resources, and handle
    invocation / read requests.  All methods are coroutines so they
    can perform asynchronous I/O.
    """

    @abstractmethod
    async def list_tools(self) -> list[Tool]:
        """List all tools exposed by this server."""
        raise NotImplementedError

    @abstractmethod
    async def call_tool(self, name: str, arguments: dict) -> Any:
        """Call a tool by name with a JSON-like payload.

        Implementations may raise :class:`McpError` (or one of its
        subclasses) to signal a failure.  Successful calls return the
        tool's result value, which the transport will wrap in a
        JSON-RPC response.
        """
        raise NotImplementedError

    @abstractmethod
    async def list_resources(self) -> list[Resource]:
        """List all resources exposed by this server."""
        raise NotImplementedError

    @abstractmethod
    async def read_resource(self, uri: str) -> ResourceContent:
        """Read a resource by its URI.

        Implementations should raise :class:`ResourceNotFoundError` if
        the URI is not registered.
        """
        raise NotImplementedError
