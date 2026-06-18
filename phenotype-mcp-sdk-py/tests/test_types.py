"""Tests for ``phenotype_mcp_sdk_py.types``.

Mirrors the Rust unit tests in
``AgilePlus/crates/phenotype-mcp-sdk-rs/src/lib.rs`` lines 87-177.
"""

from __future__ import annotations

from dataclasses import asdict

import pytest

from phenotype_mcp_sdk_py import (
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


def test_mcp_error_display() -> None:
    """``ToolNotFoundError`` should include the tool name in its message."""
    e = ToolNotFoundError("foo")
    assert "foo" in str(e)
    assert e.tool_name == "foo"


def test_server_info_round_trip() -> None:
    """``ServerInfo`` can be serialized to a dict and reconstructed."""
    info = ServerInfo(
        name="test-server",
        version="0.1.0",
        capabilities=ServerCapabilities(tools=True, resources=False, prompts=True),
    )
    serialized = asdict(info)
    assert serialized["name"] == "test-server"
    assert serialized["version"] == "0.1.0"
    assert serialized["capabilities"]["tools"] is True
    assert serialized["capabilities"]["resources"] is False
    assert serialized["capabilities"]["prompts"] is True

    # Reconstruct and confirm equality of the relevant fields.
    cap_dict = serialized["capabilities"]
    cap2 = ServerCapabilities(**cap_dict)
    info2 = ServerInfo(name=serialized["name"], version=serialized["version"], capabilities=cap2)
    assert info2.name == "test-server"
    assert info2.capabilities.tools is True
    assert info2.capabilities.resources is False


def test_resource_content_has_text_or_blob() -> None:
    """A text-only ``ResourceContent`` round-trips the ``text`` field."""
    rc = ResourceContent(
        uri="file:///tmp/test.txt",
        mime_type="text/plain",
        text="hello",
        blob=None,
    )
    assert rc.text == "hello"
    assert rc.blob is None


def test_resource_dict_round_trip() -> None:
    """A ``Resource`` can be reconstructed from its dict form."""
    r = Resource(
        uri="res://docs",
        name="Documentation",
        mime_type="text/markdown",
        description="API docs",
    )
    d = asdict(r)
    assert d["uri"] == "res://docs"
    r2 = Resource(**d)
    assert r2.uri == "res://docs"
    assert r2.name == "Documentation"
    assert r2.mime_type == "text/markdown"
    assert r2.description == "API docs"


def test_mcp_error_tool_not_found() -> None:
    e = ToolNotFoundError("missing")
    assert isinstance(e, McpError)
    assert isinstance(e, Exception)


def test_mcp_error_resource_not_found() -> None:
    e = ResourceNotFoundError("missing")
    assert isinstance(e, McpError)


def test_mcp_error_invalid_arguments() -> None:
    e = InvalidArgumentsError("bad json")
    assert isinstance(e, McpError)
    assert "bad json" in str(e)


def test_mcp_error_transport() -> None:
    e = TransportError("io broken")
    assert isinstance(e, McpError)
    assert "io broken" in str(e)


def test_mcp_error_internal() -> None:
    e = InternalError("panic")
    assert isinstance(e, McpError)
    assert "panic" in str(e)


def test_server_capabilities_default() -> None:
    cap = ServerCapabilities()
    assert cap.tools is False
    assert cap.resources is False
    assert cap.prompts is False


def test_all_error_subclasses_inherit_from_mcp_error() -> None:
    """All five error subclasses must derive from ``McpError`` and ``Exception``."""
    for cls in (
        ToolNotFoundError,
        ResourceNotFoundError,
        InvalidArgumentsError,
        TransportError,
        InternalError,
    ):
        assert issubclass(cls, McpError)
        assert issubclass(cls, Exception)


def test_mcp_error_can_be_caught_polymorphically() -> None:
    """A single ``except McpError`` should catch every subclass."""
    with pytest.raises(McpError):
        raise ToolNotFoundError("x")
    with pytest.raises(McpError):
        raise ResourceNotFoundError("x")
    with pytest.raises(McpError):
        raise InvalidArgumentsError("x")
    with pytest.raises(McpError):
        raise TransportError("x")
    with pytest.raises(McpError):
        raise InternalError("x")
