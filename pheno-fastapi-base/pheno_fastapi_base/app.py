"""pheno_fastapi_base.app — :func:`create_app` factory.

The factory is the single entry point for new pheno-* HTTP services.
It composes the four pieces that every service needs:

* :class:`StructlogAccessLogMiddleware` for JSON access logs.
* :func:`register_error_handlers` for the :class:`AppError` handler.
* The ``/healthz`` and ``/readyz`` probes.
* A ``lifespan`` startup hook that emits ``app.started``.

The factory takes ``title`` and ``version`` as required positional args
so the OpenAPI schema and the startup event always carry them — there is
no sensible default.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.requests import Request

from pheno_fastapi_base.errors import register_error_handlers
from pheno_fastapi_base.middleware import StructlogAccessLogMiddleware

__all__ = ["create_app", "configure_structlog"]


def configure_structlog(title: str, version: str) -> None:
    """Configure structlog to emit JSON lines.

    Idempotent — safe to call multiple times in a process (test suites
    call it once per app). Uses structlog's :func:`configure` so the
    stdlib logging bridge also picks up the JSON renderer for any
    third-party libraries that log via :mod:`logging`.

    ``cache_logger_on_first_use=False`` is intentional: with caching on,
    the first :func:`structlog.get_logger` call after configuration
    captures a BoundLogger and subsequent re-configures are no-ops for
    that logger. Disabling caching is a tiny perf cost and makes the
    package correctly testable from suites that need to swap the
    processor chain between cases.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )
    # Bind service-level fields that every log line should carry.
    structlog.contextvars.bind_contextvars(
        service="pheno-fastapi-base", title=title, version=version
    )


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Emit ``app.started`` on startup; nothing on shutdown by default.

    Services that need a graceful-shutdown event can subclass
    :class:`fastapi.FastAPI` and override ``lifespan``; this base lifespan
    only owns the canonical startup contract.
    """
    logger = structlog.get_logger("pheno_fastapi_base.app")
    # Bind so the event is greppable, then emit — the spec requires the
    # event to carry title and version as top-level keys.
    logger.info("app.started", title=app.title, version=app.version)
    try:
        yield
    finally:
        # Mirror the contract on shutdown for symmetry.
        logger.info("app.stopped", title=app.title, version=app.version)


def create_app(title: str, version: str) -> FastAPI:
    """Build a FastAPI app with the pheno-* canonical base wired up.

    Parameters
    ----------
    title:
        OpenAPI title. Also used in the ``app.started`` event and bound
        to structlog context.
    version:
        OpenAPI / service version. Also used in the ``app.started`` event
        and bound to structlog context.
    """
    configure_structlog(title=title, version=version)

    app = FastAPI(
        title=title,
        version=version,
        lifespan=_lifespan,
    )
    # Stash for downstream introspection / tests.
    app.state.title = title
    app.state.version = version

    # Middleware
    app.add_middleware(StructlogAccessLogMiddleware)

    # Error handlers
    register_error_handlers(app)

    # ------------------------------------------------------------------
    # Probes
    # ------------------------------------------------------------------
    @app.get("/healthz", include_in_schema=False, response_class=JSONResponse)
    async def healthz(_request: Request) -> dict[str, Any]:
        """Liveness probe.

        Always returns 200 with ``{"status": "ok"}`` as long as the
        process can serve HTTP. It deliberately does NOT check
        downstream dependencies (databases, message brokers, etc.) —
        that's what :func:`readyz` is for.
        """
        return {"status": "ok"}

    @app.get("/readyz", include_in_schema=False, response_class=JSONResponse)
    async def readyz(_request: Request) -> dict[str, Any]:
        """Readiness probe.

        Returns 200 with ``{"status": "ready"}``. By default this is
        identical to ``/healthz``; services that need to gate readiness
        on external dependencies should override this route on their own
        :class:`FastAPI` subclass (or replace the route via
        ``app.router.routes`` after ``create_app`` returns).
        """
        return {"status": "ready"}

    return app
