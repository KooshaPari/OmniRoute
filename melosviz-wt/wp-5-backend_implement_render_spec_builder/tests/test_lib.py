"""Tests for WP-5: Backend: implement render spec builder"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-5"), f"Unexpected: {result!r}"
    assert "implemented" in result
