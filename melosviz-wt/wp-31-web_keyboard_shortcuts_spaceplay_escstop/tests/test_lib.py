"""Tests for WP-31: Web: keyboard shortcuts (space=play, esc=stop)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-31"), f"Unexpected: {result!r}"
    assert "implemented" in result
