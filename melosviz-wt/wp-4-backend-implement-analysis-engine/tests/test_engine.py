"""Tests for Backend: implement analysis engine (note/chord/scale detection) (WP-4)."""
from __future__ import annotations

import pytest
from melosviz.analysis.engine import Engine, detect, PITCH_NAMES


def test_detect_c_major_triad():
    """C major triad (60, 64, 67) → C, Cmaj."""
    notes, chords, scales = detect([60, 64, 67])
    assert 0 in notes  # C
    assert "Cmaj" in chords
    assert any("C major" in s for s in scales)


def test_detect_empty():
    """Empty input → empty sets."""
    notes, chords, scales = detect([])
    assert len(notes) == 0
    assert len(chords) == 0
    assert len(scales) == 0


def test_detect_a_minor():
    """A minor (A, C, E) → Amin chord."""
    notes, chords, scales = detect([69, 72, 76])  # A, C, E
    assert "Amin" in chords
    assert any("A minor" in s for s in scales)


def test_detect_dominant_7():
    """G7 chord (G, B, D, F)."""
    notes, chords, scales = detect([67, 71, 74, 77])
    assert "G7" in chords


def test_engine_named():
    """Engine can have custom name."""
    e = Engine(name="custom")
    assert e.name == "custom"
    notes, _, _ = e.detect([60])
    assert 0 in notes


def test_pitch_class_normalization():
    """Octaves normalize to pitch class."""
    notes_a, _, _ = detect([60])  # C4
    notes_b, _, _ = detect([72])  # C5
    assert notes_a == notes_b


def test_diatonic_scale_detection():
    """C major scale (0,2,4,5,7,9,11) → C major scale."""
    notes, chords, scales = detect([0, 2, 4, 5, 7, 9, 11])
    assert "C major" in scales
