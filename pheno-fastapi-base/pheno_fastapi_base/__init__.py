"""pheno_fastapi_base — canonical FastAPI base for the pheno-* service fleet.

This package provides the small, opinionated set of building blocks that every
pheno-* HTTP service is expected to share:

* :func:`pheno_fastapi_base.create_app` — a FastAPI factory that wires up
  ``/healthz`` and ``/readyz`` probes, a structlog-based JSON access-log
  middleware, a startup hook that emits ``app.started``, and the
  :class:`AppError` exception handler.
* :class:`pheno_fastapi_base.errors.AppError` — a single, framework-agnostic
  exception type with a stable string ``code`` (e.g. ``"NotFound"``) that
  the registered handler maps to an HTTP status via
  :data:`pheno_fastapi_base.errors.code_to_status`.
* :class:`pheno_fastapi_base.testing.AsyncTestClient` — a thin wrapper over
  :class:`httpx.AsyncClient` that drives the FastAPI app in-process via
  :class:`httpx.ASGITransport`, so tests do not need a live uvicorn.

The package is intentionally *minimal*: it deliberately does not depend on
``pheno-errors`` (Rust), ``pheno-tracing`` (Rust), or any other
pheno-* artifact, so it can be installed and used in any Python service —
including new services that have no other Phenotype dependencies yet.
"""

from __future__ import annotations

from pheno_fastapi_base.app import create_app
from pheno_fastapi_base.errors import (
    AppError,
    code_to_status,
    register_error_handlers,
)
from pheno_fastapi_base.middleware import StructlogAccessLogMiddleware
from pheno_fastapi_base.testing import AsyncTestClient

__all__ = [
    "AppError",
    "AsyncTestClient",
    "StructlogAccessLogMiddleware",
    "code_to_status",
    "create_app",
    "register_error_handlers",
]

__version__ = "0.1.0"
