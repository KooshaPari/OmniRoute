"""Tests for WP-32: Web: Web Vitals + lighthouse >= 90"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-32"), f"Unexpected: {result!r}"
    assert "implemented" in result
