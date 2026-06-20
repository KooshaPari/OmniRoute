"""Tests for WP-30: Web: history view (past renders)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-30"), f"Unexpected: {result!r}"
    assert "implemented" in result
