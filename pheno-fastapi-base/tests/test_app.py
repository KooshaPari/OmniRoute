"""Smoke + behavior tests for :mod:`pheno_fastapi_base`.

These cover the five contract items the L3-#51 brief requires:

* ``test_healthz_returns_200`` — ``GET /healthz`` returns 200 + ``{"status": "ok"}``.
* ``test_readyz_returns_200`` — ``GET /readyz`` returns 200 + ``{"status": "ready"}``.
* ``test_app_started_event_emitted`` — the lifespan emits an
  ``app.started`` event carrying ``title`` and ``version``.
* ``test_app_error_handler_returns_404_for_not_found`` — ``AppError("NotFound", ...)``
  is translated to HTTP 404 with a well-formed ``{"error": {...}}`` body.
* ``test_app_error_handler_returns_422_for_validation`` — ``AppError("Validation", ...)``
  is translated to HTTP 422 with a well-formed ``{"error": {...}}`` body.

All async tests run on the asyncio loop provided by ``pytest-asyncio``
(configured via ``asyncio_mode = "auto"`` in ``pyproject.toml``).
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from fastapi import FastAPI
from pheno_fastapi_base import (
    AppError,
    AsyncTestClient,
    code_to_status,
    create_app,
)

if TYPE_CHECKING:
    from tests.conftest import _CapturedEvents


# ---------------------------------------------------------------------------
# 1. /healthz
# ---------------------------------------------------------------------------
async def test_healthz_returns_200(app_title: str, app_version: str) -> None:
    """``GET /healthz`` returns 200 with ``{"status": "ok"}``."""
    app = create_app(title=app_title, version=app_version)
    async with AsyncTestClient.with_app(app) as client:
        response = await client.get("/healthz")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ok"}


# ---------------------------------------------------------------------------
# 2. /readyz
# ---------------------------------------------------------------------------
async def test_readyz_returns_200(app_title: str, app_version: str) -> None:
    """``GET /readyz`` returns 200 with ``{"status": "ready"}``."""
    app = create_app(title=app_title, version=app_version)
    async with AsyncTestClient.with_app(app) as client:
        response = await client.get("/readyz")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ready"}


# ---------------------------------------------------------------------------
# 3. app.started event
# ---------------------------------------------------------------------------
async def test_app_started_event_emitted(
    captured_events: _CapturedEvents,
    app_title: str,
    app_version: str,
) -> None:
    """The lifespan emits an ``app.started`` event carrying ``title`` and ``version``.

    We drive the lifespan directly via ``app.router.lifespan_context``
    rather than through the ASGI transport, because ``httpx.ASGITransport``
    does not propagate ASGI lifespan events.
    """
    app = create_app(title=app_title, version=app_version)

    # ``create_app`` calls :func:`configure_structlog`, which calls
    # :func:`structlog.configure` and replaces the processor chain
    # (including our capture). Re-install the capture so we can observe
    # the lifespan's ``app.started`` event.
    captured_events.reapply()

    # Enter the lifespan context — the startup branch runs on `__aenter__`,
    # the shutdown branch on `__aexit__`. We only care about startup here.
    async with app.router.lifespan_context(app):
        pass

    started = [e for e in captured_events.events if e.get("event") == "app.started"]
    assert started, (
        f"expected at least one 'app.started' event; got events: {captured_events.events!r}"
    )
    # The first matching event is the one emitted during the lifespan startup.
    payload = started[0]
    assert payload["title"] == app_title
    assert payload["version"] == app_version

    # And as an extra assertion, the JSON-shaped string version of the event
    # (what structlog's JSONRenderer would produce) is also well-formed.
    rendered = json.dumps({k: v for k, v in payload.items() if k in {"event", "title", "version"}})
    parsed = json.loads(rendered)
    assert parsed == {"event": "app.started", "title": app_title, "version": app_version}


# ---------------------------------------------------------------------------
# 4. AppError -> 404 (NotFound)
# ---------------------------------------------------------------------------
async def test_app_error_handler_returns_404_for_not_found(
    app_title: str,
    app_version: str,
) -> None:
    """An ``AppError(code="NotFound")`` is translated to HTTP 404.

    The response body is exactly::

        {"error": {"code": "NotFound", "message": "...", "details": {...}}}
    """
    app: FastAPI = create_app(title=app_title, version=app_version)

    @app.get("/__test/not-found")
    async def _raise_not_found() -> None:
        raise AppError(
            "NotFound",
            "User 42 not found",
            details={"entity": "User", "id": "42"},
        )

    async with AsyncTestClient.with_app(app) as client:
        response = await client.get("/__test/not-found")

    assert response.status_code == 404
    # Sanity: the map itself still says NotFound -> 404.
    assert code_to_status["NotFound"] == 404
    body = response.json()
    assert body == {
        "error": {
            "code": "NotFound",
            "message": "User 42 not found",
            "details": {"entity": "User", "id": "42"},
        }
    }


# ---------------------------------------------------------------------------
# 5. AppError -> 422 (Validation)
# ---------------------------------------------------------------------------
async def test_app_error_handler_returns_422_for_validation(
    app_title: str,
    app_version: str,
) -> None:
    """An ``AppError(code="Validation")`` is translated to HTTP 422.

    The response body is exactly::

        {"error": {"code": "Validation", "message": "...", "details": {...}}}
    """
    app: FastAPI = create_app(title=app_title, version=app_version)

    @app.post("/__test/validate")
    async def _raise_validation(payload: dict[str, object]) -> None:
        raise AppError(
            "Validation",
            "Field 'email' must be a valid address",
            details={"field": "email", "value": "not-an-email"},
        )

    async with AsyncTestClient.with_app(app) as client:
        response = await client.post("/__test/validate", json={"email": "not-an-email"})

    assert response.status_code == 422
    # Sanity: the map itself still says Validation -> 422.
    assert code_to_status["Validation"] == 422
    body = response.json()
    assert body["error"]["code"] == "Validation"
    assert body["error"]["message"] == "Field 'email' must be a valid address"
    assert body["error"]["details"] == {"field": "email", "value": "not-an-email"}


# ---------------------------------------------------------------------------
# Extra sanity: code_to_status is reviewable in one place.
# ---------------------------------------------------------------------------
def test_code_to_status_contains_required_keys() -> None:
    """``code_to_status`` covers the L3 brief's required minimum."""
    assert code_to_status == {
        "NotFound": 404,
        "Validation": 422,
        "Conflict": 409,
        "Storage": 500,
        "Domain": 500,
    }
