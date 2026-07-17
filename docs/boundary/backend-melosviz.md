# Boundary: melosviz (absorbed)

**Source repo**: `KooshaPari/backend` (MelosViz scoring engine)
**Absorbed into**: `KooshaPari/phenotype-python-sdk` as `packages/melosviz/`
**Absorption commit**: `bbeedd5` on `wip/2026-07-16-0030-auto`
**Disposition**: ABSORBED (fsm=absorbed, archived=true)

## Identity

- Package name: `melosviz`
- Canonical home: `packages/melosviz/`
- Source repo: archived on GitHub 2026-07-17

## Surface

`melosviz` is a Python scoring engine that takes an artifact (audio
or otherwise) and produces a `RenderSpec` plus optional FFmpeg
video output. The public surface is:

```python
from melosviz.analysis import RenderSpec, AudioAnalyzer
from melosviz.conductor import Conductor, Router
from melosviz.presets import get_preset, list_presets
from melosviz.render import VideoExporter
```

A CLI is also exposed:

```bash
melosviz analyze <input>
melosviz render <input> --preset cinematic --out video.mp4
```

## Boundary contract

- All inter-package callers MUST import via
  `from melosviz.X import Y` (relative imports within melosviz
  are fine; external imports are absolute).
- The `RenderSpec` pydantic model is the canonical schema; all
  render/preset/conductor APIs accept and return `RenderSpec`.
- FFmpeg is invoked via subprocess (not a Python binding); the
  caller must have `ffmpeg` on `$PATH`.
- `melosviz` MUST NOT import from `pheno*` Rust crates or any
  non-Python package — the SDK is the Python boundary.

## Verification

- Tests: 107/107 pass (`pytest packages/melosviz/tests/`)
- Import sanity: `from melosviz import analysis` succeeds

## History

- 2026-07-17: absorbed into `phenotype-python-sdk` packages/melosviz/
  from `KooshaPari/backend` source repo
