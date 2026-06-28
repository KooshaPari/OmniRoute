# WP-4: Backend: implement analysis engine (note/chord/scale detection)

**Sequence:** 2
**State:** done (recovered from doing)
**Agent:** orch-w15-direct
**Date:** 2026-06-20
**Acceptance:** `engine.detect()` returns note_set, chord_set, scale_set for MIDI input.

## Module Layout

```
src/melosviz/analysis/
    __init__.py
    engine.py       # Engine.detect() + top-level detect()
tests/
    test_engine.py
```

## API

```python
from melosviz.analysis.engine import detect

notes, chords, scales = detect([60, 64, 67])  # C major triad
# notes  = frozenset({0})          (pitch class)
# chords = frozenset({"Cmaj"})
# scales = frozenset({"C major"})
```

## Supported

- **Chords:** maj, min, dim, aug, 7, maj7, min7 (across all 12 roots)
- **Scales:** major, natural minor, harmonic minor, dorian, mixolydian
- **Pitch-class normalization:** octaves collapse (60 ≡ 72)
