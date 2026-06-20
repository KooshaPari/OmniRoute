"""Tests for WP-7: Backend: implement WebGL exporter"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-7"), f"Unexpected: {result!r}"
    assert "implemented" in result
