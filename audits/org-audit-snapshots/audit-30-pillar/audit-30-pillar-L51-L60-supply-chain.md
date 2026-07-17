# L51..L60 — Supply Chain (the 10 supply-chain pillars)

**Tier:** 1 (continually extended)
**Owner:** Lane owner (Forge)
**Date:** 2026-06-23

## Scope

Supply-chain posture across the 13 lane repos — the chain of custody from
the original source code to a deployed artifact. The 10 pillars here
mirror the SLSA v1.0 framework and the OpenSSF supply-chain guidelines.

## Pillars (one per bullet)

| # | Pillar | 0=missing | 1=seeded | 2=partial | 3=complete |
|---|--------|-----------|----------|-----------|------------|
| L51 | **Pinned dependencies** (commit SHA / lockfile) | absent | lockfile | lockfile+verify | lockfile+verify+`cargo update --locked` |
| L52 | **Reproducible builds** (SOURCE_DATE_EPOCH, bit-identical) | absent | documented | one binary | every release+repro-check CI |
| L53 | **Build provenance** (SLSA L3) | absent | SLSA L1 | SLSA L2 | SLSA L3 + GitHub OIDC |
| L54 | **Hermetic builds** (no network during build) | absent | documented | enforced in CI | enforced everywhere |
| L55 | **Dependency confusion guard** (scoped/private registry) | absent | one rule | scoped names | scopes+private mirror+typosquatting check |
| L56 | **Container provenance** (image signing+attestation) | absent | one image | CI signs | CI signs+attests+verifies on deploy |
| L57 | **MCP server provenance** (phenoMCP pin) | absent | one server pinned | all servers pinned | pinned+attested+versioned |
| L58 | **License scan** (allow-list, copyleft detection) | absent | one tool | every-PR scan | every-PR+deny-on-violation |
| L59 | **Source code provenance** (commit signing per author) | absent | one author | all authors | all authors + branch policy |
| L60 | **Toolchain pinning** (rust-toolchain.toml / .python-version) | absent | one file | one file+CI check | full+verify-SHA256+reproducible |

## SOTA 2026 reference

- **SLSA v1.0** — Source, Build, Provenance, Common — the canonical
  framework. https://slsa.dev
- **Sigstore** — cosign+rekor+fulcio — keyless signing backed by OIDC.
- **in-toto + TUF** — supply-chain integrity with metadata + keys.
- **npm/yarn/pip/cargo lockfile verification** — baseline; many projects
  skip the verify step.
- **Renovate/Dependabot** — automatic dependency updates with optional
  automerge gates.

## Per-repo state (2026-06-23 snapshot)

| Repo | L51 | L52 | L53 | L54 | L55 | L56 | L57 | L58 | L59 | L60 | avg |
|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Benchora | 2 | 0 | 0 | 0 | 1 | 0 | n/a | 0 | 2 | 1 | 0.7 |
| portage | 2 | 0 | 0 | 0 | 1 | 0 | n/a | 0 | 2 | 1 | 0.7 |
| pheno-harness | 2 | 0 | 0 | 0 | 1 | 0 | n/a | 0 | 1 | 1 | 0.6 |
| phenodag | 2 | 0 | 0 | 0 | 1 | 0 | n/a | 0 | 1 | 0 | 0.4 |
| Tracera | 1 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 1 | 0 | 0.2 |
| heliosBench | 1 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 1 | 0 | 0.2 |
| nanovms | 1 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 1 | 0 | 0.2 |
| PhenoCompose | 1 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 1 | 0 | 0.2 |
| BytePort | 1 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 1 | 0 | 0.2 |
| AgilePlus | 2 | 0 | 0 | 0 | 1 | 0 | n/a | 0 | 2 | 0 | 0.5 |
| registry | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| audits | 1 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 2 | 0 | 0.3 |
| vibeproxy | 0 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 | 0 | 0.0 |

**Cross-repo finding:** the lane is at **~0.4/3 on supply-chain** (median
across 13 repos × 10 pillars). Lockfiles are present everywhere but
verify-on-CI is missing; build provenance is **0** across the lane.

**Tier-1 quick-fix list:**

1. Add `rust-toolchain.toml` to every Rust repo (L60) — 4 lines.
2. Add a `deny.toml` (cargo-deny) to every Cargo workspace (L58) — 30 lines.
3. Wire SLSA-build-generator into the top 3 release paths (L53).
4. Add `cosign sign` to the top 3 container builds (L56).

## Cross-references

- Audit L31..L40 (security) and L41..L50 (observability) — see sibling files.
- Audit L0..L30 (the existing 25 architecture/quality pillars) — see
  [`./audit-30-pillar-L0.md`](./audit-30-pillar-L0.md) (etc.).
- DAG v2 —
  [`../../../plans/2026-06-23-eval-bench-qa-dag-v2.md`](../../../plans/2026-06-23-eval-bench-qa-dag-v2.md) (DAG-T4).
