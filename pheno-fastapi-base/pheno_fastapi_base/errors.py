"""pheno_fastapi_base.errors — :class:`AppError`, status map, and FastAPI handler.

The :class:`AppError` type is the single, framework-agnostic exception that
pheno-* services raise from their domain layer when they want the HTTP
layer to translate the failure into a structured JSON error response. It
intentionally carries only a stable string ``code`` and a human-readable
``message`` — no HTTP types — so domain code never needs to import from
``fastapi`` or ``starlette``.

The mapping from ``code`` to HTTP status is centralized in
:data:`code_to_status` so the wire vocabulary is reviewable in one place.
"""

from __future__ import annotations

from typing import Any, Final

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

__all__ = [
    "AppError",
    "DEFAULT_STATUS",
    "code_to_status",
    "app_error_handler",
    "register_error_handlers",
]


# ---------------------------------------------------------------------------
# Status map
# ---------------------------------------------------------------------------
#: Canonical ``code -> HTTP status`` mapping used by :func:`app_error_handler`.
#:
#: Codes outside this map fall back to :data:`DEFAULT_STATUS` (500). The map
#: is intentionally small and reviewable; add a new key here only when a new
#: wire-level error category is introduced at the fleet level, not when a
#: single service needs a one-off status.
code_to_status: Final[dict[str, int]] = {
    "NotFound": 404,
    "Validation": 422,
    "Conflict": 409,
    "Storage": 500,
    "Domain": 500,
}

#: Status returned by :func:`app_error_handler` when ``exc.code`` is not in
#: :data:`code_to_status`. The error body is still well-formed JSON.
DEFAULT_STATUS: Final[int] = 500


# ---------------------------------------------------------------------------
# AppError
# ---------------------------------------------------------------------------
class AppError(Exception):
    """Domain-level error with a stable wire ``code`` and a human ``message``.

    Parameters
    ----------
    code:
        Stable, upper-camel-case string identifying the error category.
        Should match a key in :data:`code_to_status` so the handler can
        pick the right HTTP status. Unknown codes fall back to 500.
    message:
        Human-readable message safe to expose to the API caller. Do not
        include secrets, stack traces, or internal paths here.
    details:
        Optional structured context (e.g. ``{"entity": "User", "id": "42"}``).
        The handler will echo it under ``error.details`` in the response
        body when present.
    status:
        Optional explicit status override. When set, it wins over
        :data:`code_to_status`. Useful for services that need to surface
        a one-off 503 from a "Domain" code without modifying the global
        map.
    """

    def __init__(
        self,
        code: str,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        status: int | None = None,
    ) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.details: dict[str, Any] = dict(details) if details else {}
        self.status: int | None = status

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return f"AppError(code={self.code!r}, message={self.message!r})"


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------
async def app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Translate an :class:`AppError` into a structured JSON response.

    The response body always has the shape::

        {
          "error": {
            "code": "NotFound",
            "message": "User 42 not found",
            "details": { ... }   # omitted when empty
          }
        }

    The HTTP status is resolved in this order:

    1. ``exc.status`` if it is set (explicit override).
    2. ``code_to_status[exc.code]`` if the code is a known category.
    3. :data:`DEFAULT_STATUS` (500) otherwise.
    """
    if not isinstance(exc, AppError):
        # Defensive: if the handler is somehow called with a non-AppError,
        # surface a 500 with a stable code rather than re-raising.
        return JSONResponse(
            status_code=DEFAULT_STATUS,
            content={
                "error": {
                    "code": "Domain",
                    "message": "Internal server error",
                }
            },
        )

    status = exc.status
    if status is None:
        status = code_to_status.get(exc.code, DEFAULT_STATUS)

    body: dict[str, Any] = {
        "code": exc.code,
        "message": exc.message,
    }
    if exc.details:
        body["details"] = exc.details

    return JSONResponse(status_code=status, content={"error": body})


# ---------------------------------------------------------------------------
# Registration helper
# ---------------------------------------------------------------------------
def register_error_handlers(app: FastAPI) -> None:
    """Register :func:`app_error_handler` for :class:`AppError` on ``app``."""
    app.add_exception_handler(AppError, app_error_handler)
