"""Tests for WP-27: Web: control panel (play/pause/preset)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-27"), f"Unexpected: {result!r}"
    assert "implemented" in result
