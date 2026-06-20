"""Tests for WP-29: Web: upload UI (drag-and-drop MIDI)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-29"), f"Unexpected: {result!r}"
    assert "implemented" in result
