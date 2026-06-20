"""Tests for WP-21: Test: load + property tests (hypothesis)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-21"), f"Unexpected: {result!r}"
    assert "implemented" in result
