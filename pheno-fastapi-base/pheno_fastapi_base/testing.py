"""pheno_fastapi_base.testing — :class:`AsyncTestClient`.

A thin, opinionated wrapper over :class:`httpx.AsyncClient` that drives
the FastAPI app in-process via :class:`httpx.ASGITransport`. The wrapper
exists so tests across the pheno-* fleet can share a single import
(:class:`pheno_fastapi_base.testing.AsyncTestClient`) instead of each
service copy-pasting the same ``httpx.AsyncClient(transport=ASGITransport
(app=app), base_url="http://testserver")`` boilerplate.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Self
from uuid import uuid4

import httpx
from fastapi import FastAPI
from httpx import Cookies

__all__ = ["AsyncTestClient"]


_DEFAULT_BASE_URL = "http://testserver"


class AsyncTestClient(httpx.AsyncClient):
    """An :class:`httpx.AsyncClient` pre-wired to drive a FastAPI app in-process.

    Construct via the :meth:`with_app` classmethod — it sets up the
    :class:`httpx.ASGITransport` with the given app, picks a stable
    ``base_url`` (``http://testserver``) and stores the app on
    :attr:`app` for introspection in tests::

        async with AsyncTestClient.with_app(app) as client:
            r = await client.get("/healthz")
            assert r.status_code == 200

    Direct ``AsyncTestClient(app=...)`` construction is also supported for
    power users that want to override ``base_url``, ``headers``, etc., but
    :meth:`with_app` is the preferred path for new code.

    Notes
    -----
    The ASGI transport is in-process and does not bind to a TCP socket,
    so :attr:`base_url` is purely nominal — pick anything that parses as
    a URL.

    ``raise_app_exceptions=True`` is set on the ASGI transport so that
    handler exceptions propagate out of ``await client.get(...)`` (which
    matches the behavior of Starlette's sync ``TestClient``). To assert
    on a 500-style error from a handler, use ``pytest.raises(...)`` or
    expect the exception to bubble up.

    Note: this client does NOT drive ASGI lifespan events. The lifespan
    only fires on real HTTP servers (uvicorn, hypercorn) and on
    Starlette's sync ``TestClient``. To exercise lifespan behavior in
    async tests, drive ``app.router.lifespan_context`` directly (see
    ``tests/test_app.py::test_app_started_event_emitted`` for the
    pattern).
    """

    app: FastAPI
    """The FastAPI app the client is driving (set by :meth:`with_app`)."""

    _request_id_header: str
    """Header used for the optional per-client request id (X-Test-Request-Id)."""

    def __init__(
        self,
        app: FastAPI,
        *,
        base_url: str = _DEFAULT_BASE_URL,
        headers: dict[str, str] | None = None,
        cookies: Cookies | None = None,
        timeout: httpx.Timeout | float | None = None,
        **kwargs: Any,
    ) -> None:
        # ASGITransport is the supported way to drive an ASGI app from
        # httpx; the legacy ``app=app`` kwarg on AsyncClient itself was
        # removed in httpx 0.28.
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=True)
        super().__init__(
            transport=transport,
            base_url=base_url,
            headers=headers,
            cookies=cookies,
            timeout=timeout if timeout is not None else httpx.Timeout(10.0),
            **kwargs,
        )
        self.app = app
        self._request_id_header = "X-Test-Request-Id"

    @classmethod
    def with_app(
        cls,
        app: FastAPI,
        *,
        base_url: str = _DEFAULT_BASE_URL,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> Self:
        """Construct an :class:`AsyncTestClient` bound to ``app``.

        This is the recommended entry point — it returns a non-entered
        client, so callers can choose between ``async with`` and direct
        ``await client.aclose()`` lifecycle management.
        """
        return cls(app, base_url=base_url, headers=headers, **kwargs)

    # ------------------------------------------------------------------
    # Convenience helpers (small additions over the underlying httpx API)
    # ------------------------------------------------------------------
    def new_request_id(self) -> str:
        """Generate a fresh request id and bind it to a default header.

        Useful in tests that need to assert that downstream handlers
        propagate the header. Returns the new id; the header is also
        stored on the client so a subsequent ``client.get(...)`` will
        send it automatically.
        """
        req_id = str(uuid4())
        self.headers[self._request_id_header] = req_id
        return req_id

    @asynccontextmanager
    async def request_id(self, req_id: str | None = None) -> AsyncIterator[str]:
        """Context manager that sets a request id header for the duration.

        Restores the previous value (or removes the header if there was
        none) on exit, so nested tests don't leak headers into each other.
        """
        previous = self.headers.get(self._request_id_header)
        chosen = req_id or str(uuid4())
        self.headers[self._request_id_header] = chosen
        try:
            yield chosen
        finally:
            if previous is None:
                self.headers.pop(self._request_id_header, None)
            else:
                self.headers[self._request_id_header] = previous
