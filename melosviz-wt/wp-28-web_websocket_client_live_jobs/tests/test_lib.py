"""Tests for WP-28: Web: WebSocket client (live jobs)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-28"), f"Unexpected: {result!r}"
    assert "implemented" in result
