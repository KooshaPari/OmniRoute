from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Union

# A tool handler may be either a plain callable that returns a value
# synchronously, or a coroutine function that returns an awaitable.
HandlerResult = Union[Any, "Any"]  # type alias kept for readability
Handler = Callable[[dict], Any]


@dataclass
class Tool:
    """An MCP tool.

    A tool is a named operation with a JSON schema and a handler.  The
    handler receives the arguments dict and returns the result.  Handlers
    may be synchronous or async (``async def``); if async, the transport
    will await the result.
    """

    name: str
    description: str
    input_schema: dict
    handler: Callable[[dict], Any]

    @classmethod
    def new(
        cls,
        name: str,
        description: str,
        input_schema: dict,
        handler: Callable[[dict], Any],
    ) -> "Tool":
        """Create a new :class:`Tool`.

        Provided as a classmethod for API parity with the Rust SDK.
        """
        return cls(
            name=name,
            description=description,
            input_schema=input_schema,
            handler=handler,
        )

    def call(self, args: dict) -> Any:
        """Invoke the tool handler.

        If the handler is async, the returned coroutine is *not* awaited
        here — the transport is responsible for awaiting it.  Sync
        handlers return their value directly.
        """
        return self.handler(args)

    def clone_with_handler(self, handler: Callable[[dict], Any]) -> "Tool":
        """Clone the tool metadata and swap in a new handler.

        The original tool is left untouched; this mirrors the Rust
        ``Tool::clone_with_handler`` semantics, where the handler
        cannot be copied (closures may capture state) but the rest of
        the metadata can.
        """
        return Tool(
            name=self.name,
            description=self.description,
            input_schema=self.input_schema,
            handler=handler,
        )
