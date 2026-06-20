"""Backend: implement analysis engine (note/chord/scale detection) (WP-4).

Acceptance: engine.detect() returns note_set, chord_set, scale_set for MIDI input.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Iterable, Sequence


@dataclass(frozen=True)
class Engine:
    """Audio/MIDI analysis engine.

    detect(midi_notes) -> (note_set, chord_set, scale_set)
    """

    name: str = "default"

    def detect(
        self, midi_notes: Iterable[int]
    ) -> tuple[frozenset[int], frozenset[str], frozenset[str]]:
        notes = frozenset(int(n) % 12 for n in midi_notes)
        chords = _chords_from_notes(notes)
        scales = _scales_from_notes(notes)
        return notes, frozenset(chords), frozenset(scales)


def detect(
    midi_notes: Iterable[int],
) -> tuple[frozenset[int], frozenset[str], frozenset[str]]:
    """Convenience top-level call."""
    return Engine().detect(midi_notes)


# --- pitch-class → name maps (scaffold; full theory in WP-90/91) ---
PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Major scale intervals (semitones from root)
MAJOR_SCALE = {0, 2, 4, 5, 7, 9, 11}
NATURAL_MINOR_SCALE = {0, 2, 3, 5, 7, 8, 10}
HARMONIC_MINOR_SCALE = {0, 2, 3, 5, 7, 8, 11}
DORIAN_SCALE = {0, 2, 3, 5, 7, 9, 10}
MIXOLYDIAN_SCALE = {0, 2, 4, 5, 7, 9, 10}

# Common chord intervals (semitones from root)
MAJOR_CHORD = {0, 4, 7}
MINOR_CHORD = {0, 3, 7}
DIM_CHORD = {0, 3, 6}
AUG_CHORD = {0, 4, 8}
DOM7_CHORD = {0, 4, 7, 10}
MAJ7_CHORD = {0, 4, 7, 11}
MIN7_CHORD = {0, 3, 7, 10}


def _rotate_to_root(notes: frozenset[int], root: int) -> frozenset[int]:
    return frozenset((n - root) % 12 for n in notes)


def _chords_from_notes(notes: frozenset[int]) -> list[str]:
    """Detect any common chord containing all notes as superset (within an octave)."""
    found: list[str] = []
    chord_map = [
        ("maj", MAJOR_CHORD),
        ("min", MINOR_CHORD),
        ("dim", DIM_CHORD),
        ("aug", AUG_CHORD),
        ("7", DOM7_CHORD),
        ("maj7", MAJ7_CHORD),
        ("min7", MIN7_CHORD),
    ]
    for root in range(12):
        rotated = _rotate_to_root(notes, root)
        for suffix, intervals in chord_map:
            if rotated.issuperset(intervals):
                found.append(f"{PITCH_NAMES[root]}{suffix}")
    return found


def _scales_from_notes(notes: frozenset[int]) -> list[str]:
    """Detect any scale containing all notes as superset."""
    found: list[str] = []
    scale_map = [
        ("major", MAJOR_SCALE),
        ("minor", NATURAL_MINOR_SCALE),
        ("harmonic_minor", HARMONIC_MINOR_SCALE),
        ("dorian", DORIAN_SCALE),
        ("mixolydian", MIXOLYDIAN_SCALE),
    ]
    for root in range(12):
        rotated = _rotate_to_root(notes, root)
        for suffix, intervals in scale_map:
            if rotated.issuperset(intervals):
                found.append(f"{PITCH_NAMES[root]} {suffix}")
    return found


__all__ = [
    "Engine",
    "detect",
    "PITCH_NAMES",
    "MAJOR_SCALE",
    "NATURAL_MINOR_SCALE",
    "MAJOR_CHORD",
    "MINOR_CHORD",
]
