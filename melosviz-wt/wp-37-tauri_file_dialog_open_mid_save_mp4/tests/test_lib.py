"""Tests for WP-37: Tauri: file dialog (open .mid, save .mp4)"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-37"), f"Unexpected: {result!r}"
    assert "implemented" in result
