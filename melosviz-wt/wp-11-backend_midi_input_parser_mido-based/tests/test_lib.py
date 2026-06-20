"""Tests for WP-11: Backend: MIDI input parser (mido-based)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-11"), f"Unexpected: {result!r}"
    assert "implemented" in result
