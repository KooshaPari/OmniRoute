# PhenoSpecs — SPEC.md

> **Spec status:** `implemented` — this document reflects the current codebase.
> **Last audited:** 2026-06-18 against tree `e583b81`.
> **Substrate tier:** documentation-only spine (no runtime; not a `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` / federated service per ADR-023 Rule 3).

---

## 1. What (1 paragraph)

`PhenoSpecs` is a **specification registry and template spine** for the Phenotype ecosystem. It stores design specs, MADR-format ADRs, and a `registry.yaml` spec↔implementation traceability index, and it is consumed by spec authors, AI agents, and onboarding contributors to discover the canonical shape of a spec and to find which spec governs which repo.

## 2. Why (1 paragraph)

The fleet is polyglot (Rust, Python, Go, TypeScript) and poly-repo (50+ sibling repos), and without a central spec spine every repo re-invents the spec format — `SPEC.md` here, `SPECIFICATION.md` there, plain `README` in a third, none machine-discoverable. Existing alternatives (MADR alone, ADRs alone, plain READMEs) fall short because they are not cross-referenced to a single traceability index. **Win condition:** any repo in the fleet can be located by spec ID via `registry.yaml`, and any new spec follows the 7-section `templates/SPEC.md.template` shape.

## 3. How (architecture, 1-3 sentences + ASCII diagram)

`PhenoSpecs` is a flat, docs-only repo with five top-level concerns: (a) **spec templates** under `specs/<domain>/`, (b) **ADRs** under `adrs/00NN-slug.md` (MADR format), (c) **long-form docs** under `docs/`, (d) **research notes** under `research/`, and (e) a **traceability index** in `registry.yaml` (YAML 1.2, schema v2.0.0) that maps spec IDs to the repos that own them. There is no code, no build, no runtime; validation is markdown lint + `registry.yaml` schema check (manual today, `pheno-ci-templates/quality-bar.yml` when onboarded).

```
            ┌──────────────────────────────────────┐
            │           PhenoSpecs (docs)           │
            └──────────────────────────────────────┘
              │           │            │          │
        ┌─────▼───┐ ┌─────▼─────┐ ┌────▼────┐ ┌───▼────────┐
        │ specs/  │ │  adrs/    │ │  docs/  │ │ research/  │
        │ (4 dom) │ │ (10 MADR) │ │ (intent │ │ (notes)    │
        │         │ │           │ │  + L7)  │ │            │
        └─────────┘ └───────────┘ └─────────┘ └────────────┘
                          │
                  ┌───────▼────────┐
                  │ registry.yaml  │  (traceability
                  │   (v2.0.0)     │   spec<->repo)
                  └────────────────┘
```

## 4. Interface (API surface, ≤ 10 lines)

This repo has no programmatic API. The "interface" is the on-disk contract:

```text
registry.yaml        — spec↔repo traceability index (YAML 1.2, schema v2.0.0)
SPEC.md / PRD.md     — top-level spec + product requirements (Markdown)
adrs/00NN-*.md       — ADRs in MADR format (Markdown)
specs/<domain>/*.md  — domain spec templates (Markdown)
catalog-info.yaml    — Backstage-style catalog metadata (YAML)
VERSION              — SemVer (read by release-cut workflow)
```

## 5. Status (current state, ≤ 5 bullet rows)

| Component | Status | Notes |
|---|---|---|
| `registry.yaml` (v2.0.0) | `shipped` | Last updated 2026-06-08; mirrors `phenotype-registry/ECOSYSTEM_MAP.md` role taxonomy |
| `adrs/` (010 ADRs) | `shipped` | MADR format; covers hex arch, Rust primary, spec-driven dev, unified registry, multi-format docs, traceability, evaluation, realtime sync, audit hash chain, storage dual-engine |
| `specs/<domain>/` (4 domains) | `shipped` | `crypto/`, `platform/`, `sdks/`, `storage/` |
| `docs/intent/` (L7 snapshots) | `shipped` | L7-001 intent + boundary snapshot (per `repos/AGENTS.md` Decision D, this is the spine-of-spine data) |
| CI / tests | `partial` | No automated lint or schema check; manual review only; `pheno-ci-templates/quality-bar.yml` not yet adopted |
| Observability | `n/a` | Docs-only repo; no runtime to instrument |

## 6. Out of scope (explicit deferrals)

- **New spec content under `specs/` / `adrs/` / `research/`** — deferred indefinitely. Per `repos/AGENTS.md` Decision D, this is a lightly used spine; new spec work lives in the local monorepo's `findings/` + `docs/adr/`. Migration to re-activate would require a fresh ADR reversing Decision D.
- **Runtime code** (`src/`, `Cargo.toml` workspace, `pyproject.toml`, `go.mod`) — deferred indefinitely. This is a docs-only repo by design; introducing code would break the meta-bundle contract.
- **Automated `registry.yaml` schema lint** — deferred until `pheno-ci-templates/quality-bar.yml` adds a markdown + YAML schema workflow that the fleet can adopt. Until then, manual review.
- **Adopting a static site generator (e.g. mkdocs)** — deferred. Plain GitHub-rendered markdown is sufficient for current consumption.
- **Migrating legacy 2586-line `SPEC.md` content into `docs/legacy-spec.md`** — deferred. The legacy spec is preserved in git history via the prior 2586-line version; the new 1-page `SPEC.md` is canonical going forward.

## 7. References

- `AGENTS.md` — agent guardrails, conventions, layout
- `README.md` — quickstart, navigation
- `CHANGELOG.md` — release notes (Keep-a-Changelog 1.1.0)
- `worklog.md` — running worklog (Worklog v2.1 schema per ADR-025; `device:` field)
- `LICENSE` / `LICENSE-APACHE` / `LICENSE-MIT` — triple license
- `registry.yaml` — spec↔repo traceability index (canonical)
- `catalog-info.yaml` — Backstage catalog metadata
- `adrs/` — MADR-format ADRs
- `repos/AGENTS.md` Decision D — lightly used spine policy (this repo is in scope)
- `repos/templates/SPEC.md.template` — the template this `SPEC.md` follows
- `repos/AGENTS.md` ADR-023 — substrate tier policy (this repo is *not* a substrate; docs-only)
