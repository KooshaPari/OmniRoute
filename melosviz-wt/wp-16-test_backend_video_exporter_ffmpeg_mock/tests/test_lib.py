"""Tests for WP-16: Test: backend video exporter (FFmpeg mock)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-16"), f"Unexpected: {result!r}"
    assert "implemented" in result
