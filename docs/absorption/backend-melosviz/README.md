# Absorption: backend → phenotype-python-sdk/packages/melosviz

**Source**: `KooshaPari/backend` (MelosViz scoring engine, 48KB)
**Target**: `KooshaPari/phenotype-python-sdk` as `packages/melosviz/`
**Wave**: 2026-07-17-queue-refresh-2
**Branch**: `wip/2026-07-16-0030-auto` (commit `bbeedd5`)
**Disposition row**: `repo-backend-melosviz`
**Date**: 2026-07-17

## Source identity

`KooshaPari/backend` is the MelosViz scoring engine: a Python package
that takes audio (or any artifact) and produces a renderable score
spec plus an FFmpeg-backed video exporter. It bundles analysis
models, a conductor/router, preset definitions, a CLI, and a
video exporter. The package identity `melosviz` is preserved.

## Content transferred

```
src/melosviz/
├── __init__.py
├── analysis/
│   ├── __init__.py
│   ├── audio.py
│   └── models.py                (RenderSpec pydantic model)
├── cli/
│   ├── __init__.py
│   └── main.py                  (CLI entry point)
├── conductor/
│   ├── __init__.py
│   ├── orchestrator.py
│   ├── router.py
│   ├── overrides.py
│   └── adapters.py
├── presets/
│   ├── __init__.py
│   ├── cinematic.py
│   └── registry.py              (preset definitions)
└── render/
    ├── __init__.py
    └── video_exporter.py        (FFmpeg video exporter)

tests/
├── test_cli.py                  (23 tests)
├── test_conductor.py            (31 tests)
├── test_render_spec_v2.py       (6 tests)
└── test_video_exporter.py       (47 tests)

pyproject.toml                   (pydantic>=2.7; FFmpeg kept optional)
README.md
.gitignore
```

Total: 4,475 LOC of source, 107 unit tests.

## Why phenotype-python-sdk

`phenotype-python-sdk` is the canonical Phenotype Python monorepo
with multiple sub-packages (DataKit, db-kit, PolicyStack, etc.).
`melosviz` is a Python package with pydantic models, a CLI, and
optional integration with FFmpeg — the same shape as the existing
SDK packages. Adopting it under `packages/melosviz/` gives it
proper monorepo packaging (pyproject, tests in-tree, workspace
discovery) and access to shared tooling.

## Verification

```
cd packages/melosviz
python3 -m pip install -e . --break-system-packages
python3 -m pytest tests/ -v
```

Result:

```
======================== test session starts ========================
collected 107 items

tests/test_cli.py .....................                          [ 21%]
tests/test_conductor.py ...............................          [ 50%]
tests/test_render_spec_v2.py ......                              [ 55%]
tests/test_video_exporter.py .................................   [100%]

======================== 107 passed in 2.72s ========================
```

All 107 tests pass clean.

## Adaptations during absorption

- **Package layout**: `backend/src/melosviz/...` → SDK convention
  `packages/melosviz/src/melosviz/...`. Source files otherwise
  unchanged.
- **Naming**: Source `backend/` → SDK canonical name `melosviz`
  (matches the package identity in `pyproject.toml`).
- **Deps**: kept pydantic as the only hard dep; FFmpeg-related
  Python libs intentionally left out of pyproject (callers
  shell out to ffmpeg binary). This keeps CI lean.

## Files

- Source: https://github.com/KooshaPari/backend (archived 2026-07-17)
- Target commit: `bbeedd5` on `phenotype-python-sdk#wip/2026-07-16-0030-auto`
- Registry: `phenotype-registry/disposition-index.json` row `repo-backend-melosviz`
  (fsm=absorbed, archived=true)
- Boundary spec: `docs/boundary/backend-melosviz.md`
