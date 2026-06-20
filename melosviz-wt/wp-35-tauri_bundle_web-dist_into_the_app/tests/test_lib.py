"""Tests for WP-35: Tauri: bundle web/dist into the app"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-35"), f"Unexpected: {result!r}"
    assert "implemented" in result
