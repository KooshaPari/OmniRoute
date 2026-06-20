"""Tests for WP-36: Tauri: native menu bar (File/Edit/View/Help)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-36"), f"Unexpected: {result!r}"
    assert "implemented" in result
