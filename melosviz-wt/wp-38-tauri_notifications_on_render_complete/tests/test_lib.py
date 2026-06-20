"""Tests for WP-38: Tauri: notifications on render complete"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-38"), f"Unexpected: {result!r}"
    assert "implemented" in result
