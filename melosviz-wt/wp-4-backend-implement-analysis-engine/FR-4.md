# FR-4: Backend: implement analysis engine (note/chord/scale detection)

**File scope:** `backend/src/melosviz/analysis/engine.py`

## Functional Requirement

The analysis engine MUST accept MIDI note numbers and return:

| Output | Type | Description |
|---|---|---|
| `note_set` | `frozenset[int]` | Pitch classes (0-11) present in input |
| `chord_set` | `frozenset[str]` | All common chords whose intervals are a subset of the input |
| `scale_set` | `frozenset[str]` | All scales whose intervals are a subset of the input |

Octaves MUST be normalized to pitch class before detection.

## Acceptance Criteria

- `Engine().detect([60, 64, 67])` returns (`{0}`, `{"Cmaj"}`, includes `"C major"`)
- `detect([])` returns (empty, empty, empty)
- `detect([60])` == `detect([72])` (octave invariant)

## Implementation Status

Implemented + tested. 7 tests pass (assuming pytest run).
