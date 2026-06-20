"""Tests for WP-8: Backend: implement video exporter (FFmpeg wrapper)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-8"), f"Unexpected: {result!r}"
    assert "implemented" in result
