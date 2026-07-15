"""Acceptance-test stubs for the Preset Library (FR-1–FR-5).

Each test maps to one Functional Requirement from docs/specs/SPEC.md.
All tests are marked @pytest.mark.skip as pending — they encode the
asymptote / acceptance oracle that implementation must satisfy.

Run with:  pytest -v docs/specs/acceptance/test_presets_acceptance.py
"""

from __future__ import annotations

from typing import List

import pytest

from melosviz.presets import BUILTIN_PRESETS, list_presets, load_preset
from melosviz.presets.cinematic import CINEMATIC_PALETTE, apply


# ---------------------------------------------------------------------------
# FR-1: List available presets
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-1 acceptance oracle — not yet implemented")
class TestFR1ListPresets:
    """FR-1: list_presets() returns sorted list of built-in names."""

    def test_returns_list_of_strings(self) -> None:
        result = list_presets()
        assert isinstance(result, list)
        for name in result:
            assert isinstance(name, str)

    def test_includes_all_builtin_names(self) -> None:
        result = list_presets()
        expected = {"ambient", "cinematic", "classical", "edm", "jazz", "world"}
        assert expected.issubset(set(result))

    def test_returns_sorted(self) -> None:
        result = list_presets()
        assert result == sorted(result)


# ---------------------------------------------------------------------------
# FR-2: Load a named preset
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-2 acceptance oracle — not yet implemented")
class TestFR2LoadPreset:
    """FR-2: load_preset(name) returns the module; unknown raises KeyError."""

    def test_load_known_preset(self) -> None:
        mod = load_preset("cinematic")
        assert hasattr(mod, "apply")
        assert callable(mod.apply)

    def test_load_unknown_preset_raises_key_error(self) -> None:
        with pytest.raises(KeyError) as excinfo:
            load_preset("unknown")
        assert "unknown" in str(excinfo.value).lower()
        # Message must list available presets
        assert "cinematic" in str(excinfo.value)

    def test_load_preset_normalises_case(self) -> None:
        mod = load_preset("CINEMATIC")
        assert hasattr(mod, "apply")


# ---------------------------------------------------------------------------
# FR-3: Apply preset to RenderSpec
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-3 acceptance oracle — not yet implemented")
class TestFR3ApplyPreset:
    """FR-3: preset.apply(spec) mutates spec in place with style."""

    def test_apply_sets_preset_metadata(self) -> None:
        from melosviz.analysis.models import RenderSpec

        spec = apply(RenderSpec())
        assert spec.metadata.get("preset") == "cinematic"

    def test_apply_sets_palette(self) -> None:
        from melosviz.analysis.models import RenderSpec

        spec = apply(RenderSpec())
        assert len(spec.palette) == 6
        assert spec.palette == CINEMATIC_PALETTE

    def test_apply_sets_layers(self) -> None:
        from melosviz.analysis.models import RenderSpec

        spec = apply(RenderSpec())
        assert isinstance(spec.layers, list)
        assert len(spec.layers) >= 1

    def test_apply_sets_keyframes(self) -> None:
        from melosviz.analysis.models import RenderSpec

        spec = apply(RenderSpec())
        assert isinstance(spec.keyframes, list)
        assert len(spec.keyframes) >= 1

    def test_apply_appends_timeline_sections(self) -> None:
        from melosviz.analysis.models import RenderSpec

        spec = apply(RenderSpec())
        sections = [
            e for e in spec.timeline if e.get("type") == "section"
        ]
        assert len(sections) >= 3


# ---------------------------------------------------------------------------
# FR-4: Legacy ThemePresetRegistry re-export
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-4 acceptance oracle — not yet implemented")
class TestFR4ThemePresetRegistry:
    """FR-4: ThemePresetRegistry re-exported for backward compat."""

    def test_theme_preset_registry_is_importable(self) -> None:
        from melosviz.presets import ThemePresetRegistry  # noqa: F811

        assert ThemePresetRegistry is not None

    def test_theme_preset_registry_is_callable(self) -> None:
        from melosviz.presets import ThemePresetRegistry

        # It is expected to be a class, thus callable
        assert callable(ThemePresetRegistry)


# ---------------------------------------------------------------------------
# FR-5: Public API surface in __all__
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-5 acceptance oracle — not yet implemented")
class TestFR5PublicApiSurface:
    """FR-5: __all__ exports the intended public names."""

    def test_all_contains_expected_names(self) -> None:
        from melosviz import presets

        expected = {"BUILTIN_PRESETS", "ThemePresetRegistry", "list_presets", "load_preset"}
        assert expected.issubset(set(presets.__all__))
