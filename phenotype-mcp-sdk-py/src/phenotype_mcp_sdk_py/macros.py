from __future__ import annotations

from typing import Any, Callable, Optional

from .tool import Tool
from .types import Resource


def mcp_tool(
    name: str,
    description: str,
    schema: dict,
    handler: Callable[[dict], Any],
) -> Tool:
    """Build a :class:`Tool` with a JSON schema and a handler.

    This is the Python equivalent of the Rust ``mcp_tool!`` macro.  The
    ``schema`` may be a plain ``dict`` (already deserialized JSON) and
    is stored verbatim on the tool.
    """
    return Tool.new(
        name=name,
        description=description,
        input_schema=schema,
        handler=handler,
    )


def mcp_resource(
    uri: str,
    name: str,
    mime: Optional[str] = None,
    desc: Optional[str] = None,
) -> Resource:
    """Build a :class:`Resource` with optional mime type and description.

    The Rust ``mcp_resource!`` macro has a short form (``uri, name``)
    and a long form (``uri, name, mime, desc``).  Python expresses the
    same shape with default arguments.
    """
    return Resource(uri=uri, name=name, mime_type=mime, description=desc)
