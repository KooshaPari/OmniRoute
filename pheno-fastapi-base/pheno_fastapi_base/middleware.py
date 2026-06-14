"""pheno_fastapi_base.middleware — :class:`StructlogAccessLogMiddleware`.

A Starlette/FastAPI middleware that emits one JSON access-log line per
HTTP request via :mod:`structlog`. The line is bound to a per-request
logger so handlers can attach extra fields (``request_id``, ``user_id``,
etc.) with :func:`structlog.contextvars.bind_contextvars` and have them
appear on the access log line automatically.
"""

from __future__ import annotations

import time
from typing import Any, cast

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp
from structlog.contextvars import bound_contextvars
from structlog.stdlib import BoundLogger

try:  # structlog 24.x exposes get_logger; older versions used stdlib_get_logger
    from structlog import get_logger as _get_logger
except ImportError:  # pragma: no cover - very old structlog
    from structlog.stdlib import get_logger as _get_logger

__all__ = ["StructlogAccessLogMiddleware"]


def _get_access_logger() -> BoundLogger:
    """Return a structlog bound logger namespaced for access logs."""
    # structlog.get_logger() is typed as ``Any`` upstream; we know it's a BoundLogger.
    return cast(BoundLogger, _get_logger("pheno_fastapi_base.access"))


class StructlogAccessLogMiddleware(BaseHTTPMiddleware):
    """Emit a structlog JSON access log line per request.

    Each line carries at minimum::

        {
          "event": "app.access",
          "method": "GET",
          "path": "/v1/users/42",
          "status_code": 200,
          "duration_ms": 4.812,
          "client": "127.0.0.1:54321"   # omitted if the scope has no client
        }

    The middleware also pushes the ``method`` and ``path`` into structlog's
    contextvars for the duration of the request, so any
    ``logger.info("user did X")`` call made by a downstream handler picks
    them up automatically and the access log line still emits them at the
    top level for grep-ability.
    """

    def __init__(self, app: ASGIApp, *, logger_name: str = "pheno_fastapi_base.access") -> None:
        super().__init__(app)
        # Allow tests / advanced users to override the logger namespace.
        self._logger_name = logger_name
        self._logger = (
            _get_logger(logger_name)
            if logger_name != "pheno_fastapi_base.access"
            else _get_access_logger()
        )

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        start = time.perf_counter()
        client = request.client
        client_str = f"{client.host}:{client.port}" if client is not None else None

        # Bind per-request fields for the duration of the handler chain.
        with bound_contextvars(method=request.method, path=request.url.path):
            try:
                response = await call_next(request)
            except Exception:
                duration_ms = round((time.perf_counter() - start) * 1000.0, 3)
                self._logger.exception(
                    "app.access",
                    status_code=500,
                    duration_ms=duration_ms,
                    client=client_str,
                )
                raise

        duration_ms = round((time.perf_counter() - start) * 1000.0, 3)
        log_kwargs: dict[str, Any] = {
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        }
        if client_str is not None:
            log_kwargs["client"] = client_str
        self._logger.info("app.access", **log_kwargs)
        # BaseHTTPMiddleware.call_next returns a ``Response`` at runtime, but
        # is annotated as ``Any`` upstream; cast narrows the return type.
        return cast(Response, response)
