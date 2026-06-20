"""Tests for WP-34: Tauri: implement main.rs IPC handlers"""

from src.lib import main


def test_main_returns_implemented_marker():
    result = main()
    assert result.startswith("WP-34"), f"Unexpected: {result!r}"
    assert "implemented" in result
