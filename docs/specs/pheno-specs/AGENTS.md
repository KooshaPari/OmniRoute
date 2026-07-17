# AGENTS.md — PhenoSpecs

> **Repo kind:** spec template spine (governance-only meta-bundle).
> **Runtime?** No. This repo is documentation + registry data; it is not built, run, or shipped as a service.
> **Last audited:** 2026-06-18 against `main` @ `e583b81`.

---

## What this repo is

`PhenoSpecs` is a **spec template spine** — a canonical, language-agnostic registry of design specs, ADRs, and traceability data for the Phenotype ecosystem. It is the upstream of record for spec *templates* (the *shape* of a spec) and a cross-reference of spec *instances* (which spec lives in which repo). Per the local monorepo `repos/AGENTS.md` § *Scope decisions* / Decision D, this is a **lightly used spine** — referenced for patterns and cross-references, not actively maintained for new content. The active spine going forward is the local monorepo's `findings/` + `docs/adr/` + `plans/` directories.

This is **not** a runtime, SDK, library, or service. It is a single-purpose template and registry repo.

## Layout (verified from `main`)

| Path | Purpose |
|---|---|
| `SPEC.md` | Top-level spec of this repo (1 page, 7 sections per `templates/SPEC.md.template`) |
| `PRD.md` | Lightweight product requirements doc |
| `ADR.md` | Top-level ADR index (links `adrs/0001-…` through `adrs/0010-…`) |
| `PLAN.md` | Roadmap + active initiatives |
| `CHARTER.md` | Mission, tenets, scope |
| `RESEARCH.md` | Research notes index |
| `adrs/` | MADR-format ADRs (010 ADRs checked in) |
| `specs/` | Domain feature spec templates (`crypto/`, `platform/`, `sdks/`, `storage/`) |
| `docs/` | Long-form docs (intent snapshots, journey traceability) |
| `research/` | Research notes |
| `archive/` | Retired specs (immutable; do not edit) |
| `registry.yaml` | Spec ↔ implementation traceability index (v2.0.0) |
| `catalog-info.yaml` | Backstage-style catalog metadata |
| `worklog.md` | Running worklog (Worklog v2.1 schema per ADR-025) |
| `LICENSE`, `LICENSE-APACHE`, `LICENSE-MIT` | Triple license |

## Validation

No build, no test runner. Validation is **markdown + registry consistency only**:

```bash
# Browse spec templates
ls specs/

# Check the traceability index
head -50 registry.yaml
```

Spec-link tooling (`spec-links`, `spec-new`) referenced in the README lives in sibling Phenotype repos — install separately; it is not part of this repo.

## Conventions

- **Commits:** Conventional Commits (`docs:` is the dominant type for spec changes; `chore:` for hygiene / meta-bundle).
- **Branches:** `<type>/<topic>` (e.g. `docs/auth-spec-v2`, `chore/specs-meta-2026-06-19`).
- **PRs:** to `main` only. `archive/` is immutable.
- **Spec changes** MUST update `registry.yaml` to keep the central traceability index accurate.
- **Versioning:** see `VERSION`. SemVer 2.0.0.
- **License:** triple-license (MIT / Apache-2.0). All new files use SPDX headers.

## Agent guardrails

- **Do not** edit files under `archive/`.
- **Do not** introduce runtime code (no `src/`, no `Cargo.toml` workspace, no `pyproject.toml`, no `go.mod`).
- **Do not** add new content under `specs/` / `adrs/` / `research/` — this is a **lightly used spine** per Decision D. New work goes in the local monorepo's `findings/` + `docs/adr/`.
- **Do** keep `registry.yaml` and `catalog-info.yaml` in sync with any spec moves (retire → `archive/`, add → `specs/`, etc.).
- **Do** keep the 5-element release-ready meta-bundle intact: `AGENTS.md` + `SPEC.md` + `CHANGELOG.md` + `WORKLOG.md` (`worklog.md`) + `LICENSE-MIT`.

## Related

- `repos/AGENTS.md` § *Scope decisions* / Decision D — PhenoSpecs is a lightly used spine; active spine is the local monorepo.
- `repos/templates/SPEC.md.template` — the spec template this repo's `SPEC.md` follows.
- `repos/templates/CHANGELOG.md.template` — the changelog template.
- `repos/templates/WORKLOG.md.template` — the worklog template.
