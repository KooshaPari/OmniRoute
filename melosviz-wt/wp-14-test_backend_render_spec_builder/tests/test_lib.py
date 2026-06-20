"""Tests for WP-14: Test: backend render spec builder"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-14"), f"Unexpected: {result!r}"
    assert "implemented" in result
