"""Tests for ``phenotype_mcp_sdk_py.tool``.

Mirrors the Rust unit tests in
``AgilePlus/crates/phenotype-mcp-sdk-rs/src/tool.rs`` lines 72-146.
"""

from __future__ import annotations

import asyncio

from phenotype_mcp_sdk_py import Tool


def test_tool_creation_and_call() -> None:
    """``Tool.new`` + ``call`` round-trips the handler return value."""
    t = Tool.new(
        "echo",
        "Echo the input back",
        {"type": "object", "properties": {}},
        lambda args: args,
    )
    assert t.name == "echo"
    result = t.call({"msg": "hello"})
    assert result == {"msg": "hello"}


def test_tool_call_error_propagation() -> None:
    """Exceptions raised inside the handler propagate to the caller."""
    def handler(_args):
        raise RuntimeError("oops")

    t = Tool.new("fail", "Always fails", {}, handler)

    raised = False
    try:
        t.call({})
    except RuntimeError as e:
        assert str(e) == "oops"
        raised = True
    assert raised, "expected RuntimeError to propagate from handler"


def test_tool_clone_with_handler() -> None:
    """``clone_with_handler`` swaps the handler but preserves metadata."""
    t1 = Tool.new(
        "add",
        "Add two numbers",
        {"type": "object"},
        lambda args: args.get("a", 0) + args.get("b", 0),
    )
    t2 = t1.clone_with_handler(
        lambda args: args.get("a", 0) - args.get("b", 0),
    )
    assert t1.name == t2.name
    assert t1.description == t2.description
    assert t1.input_schema == t2.input_schema
    result = t2.call({"a": 5, "b": 3})
    assert result == 2
    # The original handler is untouched.
    assert t1.call({"a": 5, "b": 3}) == 8


def test_tool_debug_does_not_panic() -> None:
    """``repr(tool)`` produces a non-empty string containing the tool name."""
    t = Tool.new("x", "y", {}, lambda _args: None)
    dbg = repr(t)
    assert "Tool" in dbg
    assert "x" in dbg


def test_tool_schema_is_preserved() -> None:
    """The ``input_schema`` dict is stored by reference and is fully preserved."""
    schema = {"type": "object", "properties": {"name": {"type": "string"}}}
    t = Tool.new("greet", "Say hi", schema, lambda _args: "hi")
    assert t.input_schema == schema
    assert "name" in t.input_schema["properties"]


def test_tool_is_constructible() -> None:
    """A :class:`Tool` instance is usable — Python has no Rust-style Send/Sync
    bound, but constructing and discarding the object must succeed.  This
    mirrors the spirit of ``tool_handler_send_sync`` in the Rust tests."""

    t = Tool.new("noop", "no-op", {}, lambda _args: None)
    assert t is not None
    assert t.handler({"a": 1}) is None


def test_async_handler_returns_coroutine() -> None:
    """An async handler produces a coroutine; awaiting it returns the value."""
    async def handler(args):
        return args.get("n", 0) * 2

    t = Tool.new("double", "Double n", {"type": "object"}, handler)
    coro = t.call({"n": 21})
    # The transport is responsible for awaiting; the tool itself returns the
    # coroutine to the caller.
    assert asyncio.iscoroutine(coro)
    assert asyncio.run(coro) == 42
