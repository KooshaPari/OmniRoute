# Httpora / QuadSGM cluster assessment

**Status:** Keep separate — no merge  
**Plan reference:** `phenotype-registry/ECOSYSTEM_MAP.md` (neither repo in 38-repo collapse table)  
**Date:** 2026-05-31

## Cluster members

| Repo | Domain | Stack | Maturity |
|------|--------|-------|----------|
| **Httpora** | HTTP client/server framework (“httpkit”) | Documented as Rust in `CLAUDE.md`; checkout is **Python Hatch scaffold** (no `src/` modules yet) | Scaffold — placeholder `pyproject.toml` metadata |
| **QuadSGM** | Quad Structured Governance Model — Python project template, quality gates, VitePress docs | Python 3.10+, uv, Task, Ruff, Mypy | Active governance reference implementation |

## Relationship

- **No code dependency** between Httpora and QuadSGM.
- **Conceptual overlap only:** both use Phenotype repo hygiene (FR docs, CI, VitePress/worklogs patterns). QuadSGM is the *template*; Httpora is a *future HTTP kit* that could be bootstrapped *from* QuadSGM patterns but should not be merged into it.
- **Ecosystem map:** Httpora grouped with tooling pushes (DevHex); QuadSGM is governance/template (private, large docs tree).

## Verdict

| Action | Rationale |
|--------|-----------|
| **Do not merge** Httpora ↔ QuadSGM | Different products (HTTP runtime vs governance scaffold); merge would conflate publish targets |
| **Do not merge** into HexaKit yet | Httpora Rust intent vs Python scaffold ambiguity — resolve stack choice before any absorb into `HexaKit` http crates |
| **Httpora:** keep standalone | Finish stack decision (Rust httpkit vs Python); implement modules; then register in registry |
| **QuadSGM:** keep standalone | Serves as org-wide Python template; consumers copy/adopt patterns |

## Optional follow-ups (separate PRs)

1. Align `Httpora/CLAUDE.md` with actual Python scaffold **or** add Rust workspace — remove httpkit/Rust claims until code exists.
2. Add registry index entries linking QuadSGM as “Python bootstrap template” and Httpora as “HTTP kit (TBD stack)”.
3. When Httpora gains implementation, depend on Phenotype shared crates via git/registry — not QuadSGM package merge.

## Build verification

**Httpora** (Python, local checkout):

```powershell
cd Httpora
python -m pip install -e ".[dev]"
pytest  # when tests exist
```

**QuadSGM:**

```powershell
cd QuadSGM
pip install -e ".[dev]"
task quality
```
