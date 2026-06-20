"""Tests for WP-20: Test: backend API integration (test_app.py)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-20"), f"Unexpected: {result!r}"
    assert "implemented" in result
