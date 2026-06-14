"""Shared pytest fixtures for ``pheno_fastapi_base`` tests."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
import structlog


class _CapturedEvents:
    """A tiny mutable container for captured structlog events.

    Plain ``list`` doesn't allow attribute assignment, so we wrap it in
    a class that exposes ``.events`` (the underlying list) and a
    ``.reapply()`` method that re-installs the capture processor chain
    on the structlog global config.
    """

    __slots__ = ("events",)

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    def reapply(self) -> None:
        """Re-install the capture processor chain (after a reconfigure)."""
        _install_capture(self.events)


def _install_capture(events: list[dict[str, Any]]) -> None:
    """(Re-)configure structlog so a copy of every event lands in ``events``.

    Idempotent — call it again any time some other code (e.g.
    :func:`pheno_fastapi_base.create_app`) has overwritten the
    processor chain and the capture needs to be put back in place.
    """
    def capture_processor(_logger: Any, _method: str, event_dict: dict[str, Any]) -> dict[str, Any]:
        # Copy so later processors can mutate the original freely.
        events.append(dict(event_dict))
        return event_dict

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            capture_processor,
            # Terminal renderer so the captured events are also visible
            # in pytest's -s output for debugging.
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )
    structlog.contextvars.clear_contextvars()


@pytest.fixture
def captured_events() -> Iterator[_CapturedEvents]:
    """Capture every structlog event emitted during a test.

    Yields a :class:`_CapturedEvents` container with:

    * ``captured_events.events`` — the underlying list of event dicts.
    * ``captured_events.reapply()`` — re-install the capture processor
      chain, useful after calling code that reconfigures structlog
      (notably :func:`pheno_fastapi_base.create_app`, which calls
      :func:`configure_structlog` and overwrites the chain)::

          app = create_app(title="x", version="0")
          captured_events.reapply()  # create_app clobbered our capture
          async with app.router.lifespan_context(app):
              pass

    The fixture resets structlog to its defaults on teardown so a later
    test that doesn't use this fixture sees a clean slate.
    """
    box = _CapturedEvents()
    _install_capture(box.events)
    try:
        yield box
    finally:
        structlog.contextvars.clear_contextvars()
        structlog.reset_defaults()


@pytest.fixture
def app_title() -> str:
    """Default app title used in tests."""
    return "pheno-fastapi-base-tests"


@pytest.fixture
def app_version() -> str:
    """Default app version used in tests."""
    return "0.0.0+test"
