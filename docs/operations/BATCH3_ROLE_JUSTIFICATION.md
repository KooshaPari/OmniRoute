# Batch 3 — role justification (2026-06-17)

> User directive: justify **BytePort**, **heliosBench**, and peers before archive/delete.
> **portage does not supersede heliosBench** — different domains.

## KEEP (active role or canonical owner)

| Repo | Role | Verdict | Unblock |
|------|------|---------|---------|
| **BytePort** | `phenotype-tooling` byteport CLI / landing | **KEEP** | Absorb to `tooling/byteport`; 53 org refs; thegent gate clear |
| **heliosBench** | Helios CLI benchmark harness (Python) | **KEEP** | Absorb to `tooling/helios-bench`; repoint helios-router + helios-cli |
| **helios-router** | Router consumer of bench | **KEEP** | Repoint manifests → phenotype-tooling bench path |
| **helios-cli** | CLI consumer of bench | **KEEP** | Same |
| **pheno** | Legacy infra monorepo (21 crates) | **KEEP** | Pyron verified-internal; archive last in HexaKit wave |
| **PhenoAgent** | Agent runtime (→ Agentora) | **KEEP** | PhenoDevOps + Pyron repoint to Agentora `pheno-agent` |
| **phenoShared** | **Canonical** cross-cutting Rust SSOT | **AFFIRM owner** | Do **not** archive — infra boundary per BOUNDARY_OWNERS |
| **FocalPoint** | xDD / focal (→ HexaKit) | **KEEP** | Manual absorption (867MB vendor); HexaKit exclude |

## portage vs heliosBench

| | **portage** | **heliosBench** |
|---|-------------|-----------------|
| Domain | Gentoo Portage / package-manager research fork | CLI tool benchmarking (Terminal-Bench style) |
| Plan | Archive upstream-maintained fork | Merge → `phenotype-tooling` |
| Supersedes? | **No** — unrelated to bench harness | N/A |

## ARCHIVE now (gate satisfied)

| Repo | Canonical owner | Evidence |
|------|-----------------|----------|
| **nanovms** | `phenotype-tooling/crates/nanovms` | Subtree present in tooling |
| **phenoDesign** | phenodocs | 0 external deps (`@kooshapari/design`) |
| **phenoXddLib** | phenoXddLib boundary / future rust-sdk | ✅ safe per execution shortlist |
| **portage** | upstream-maintained | Research fork; no DOMAIN_ROLES entry |
| **PlatformKit** | phenotype-go-sdk + nanovms devenv | Already archived |

## ARCHIVE after tooling absorption PR

| Repo | Target path |
|------|-------------|
| heliosApp | phenotype-tooling (TS dashboard) |
| PolicyStack | phenotype-tooling |
| BytePort | phenotype-tooling/byteport |
| heliosBench | phenotype-tooling/helios-bench |

## References

- `RATIONALIZATION_EXECUTION.md` § BLOCKED-BY-DEPS
- `registry/chokepoints.json`
- `docs/operations/batch3-audit-2026-06-17.md`
