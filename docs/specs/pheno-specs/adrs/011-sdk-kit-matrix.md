# ADR-011: Canonical SDK Kit Taxonomy and Cross-Language Tiering

**Status:** Proposed

**Date:** 2026-06-02

**Author:** Platform-Substrate Domain Steward

**Stakeholders:** Engineering, SDK Consumers, DevOps, Architecture

---

## Context

The Phenotype org ships SDKs in three languages, and an audit of the substrate
(2026-06-02) found their package decompositions had silently diverged. There is
no declared canonical "Kit" set, so each language SDK accreted its own structure:

| Language | Repo | Packages present |
|----------|------|------------------|
| Python | `phenotype-python-sdk` | auth, data, mcp, observability, resilience, testing (+ cli/qa tooling) |
| Go | `phenotype-go-sdk` | mcp (`mcpkit`), `devhex`, `platformkit` |
| Rust | `phenoUtils` | `pheno-crypto`, `pheno-fs`, `pheno-net`, `pheno-shell`, `pheno-testing` |

Only **mcp** and **testing** overlap across all three. `auth`, `data`,
`observability`, and `resilience` exist only in Python. Nothing is published to a
registry (no PyPI / crates.io releases, no Go module version tags), so consumers
cannot depend on a stable, named surface. Without a canonical taxonomy the
divergence will keep widening and "the Phenotype SDK" has no consistent meaning
across languages.

### Problem Statement

We need a single authoritative definition of (a) which languages are **peer
full-SDKs** expected to mirror one another, (b) the canonical **Kit set** those
peers must provide, and (c) the role of the remaining language libraries that
are *not* peer SDKs — so divergence becomes a tracked, closeable gap rather than
silent drift.

### Forces at Play

- **Cross-language parity:** Consumers expect `auth`/`resilience`/etc. to mean
  the same capability in Python and Go.
- **Honest tiering:** Rust's `phenoUtils` crates are low-level primitives
  (crypto, fs, net, shell), not application-SDK kits. Forcing them to mirror the
  SDK Kit set would be cargo-culting structure onto the wrong layer.
- **Incrementalism:** Go is missing four kits; we need them tracked as
  known-gap stubs, not blocking the taxonomy from being declared now.
- **Discoverability:** A consumer must be able to read one document and know the
  full surface and its maturity per language.

### Business Drivers

1. A coherent, marketable "Phenotype SDK" with the same shape per language.
2. Closeable backlog: every missing kit is an enumerated gap, not a surprise.
3. Reduced onboarding cost — one taxonomy, learned once.
4. A precondition for publishing versioned SDK releases.

### Technical Constraints

- Existing absorbed package layouts (`packages/<kit>/...`) must be preserved
  where possible; renames are costly for path-dependent consumers.
- Go module paths are public contracts; gap stubs must not squat a path that a
  real implementation will later need to differ from.
- The Rust primitives tier (`phenoUtils`) keeps its own naming
  (`pheno-<area>`); it is intentionally not renamed to match SDK kits.

## Decision

1. **Peer full-SDKs = Python + Go.** Both MUST provide the same canonical Kit
   set and are expected to reach feature parity.

2. **Canonical Kit set (peers) = `{ auth, data, mcp, observability, resilience,
   testing }`.** These are the only names that count as "Kits". Language-idiomatic
   spelling is allowed (`mcp-kit` in Python, `mcpkit` in Go) but the canonical
   identity is the bare kit name in this list.

3. **Rust (`phenoUtils`) is the primitives tier, NOT a peer SDK.** It supplies
   low-level building blocks (`pheno-crypto`, `pheno-fs`, `pheno-net`,
   `pheno-shell`, `pheno-testing`) that the SDKs and other tools may consume. It
   is *by design* not required to mirror the Kit set, and divergence here is not
   a bug.

4. **`devhex` / `platformkit` in the Go SDK are tooling, not canonical Kits.**
   They remain, but are documented as dev-environment tooling outside the Kit
   taxonomy (candidates for relocation to a tooling home in a later ADR).

5. **Known gaps are tracked stubs.** Go's missing kits — `auth`, `data`,
   `observability`, `resilience` — are recorded as known-gap stubs to backfill.
   Each stub is a placeholder package documenting the intended surface; it does
   not claim a finished implementation.

6. **Divergence policy.** Python↔Go Kit divergence is a **bug to converge**.
   Rust-being-different is **by design and documented**.

### Implementation Details

- This ADR is the source of truth for the Kit taxonomy; the per-repo READMEs
  link here rather than redefining the set.
- Go SDK backfill lands as lean placeholder modules (mirroring `devhex`'s lean
  `go.mod` style, not the heavyweight absorbed-package layout) under
  `packages/<kit>/`, each with a README stating "known-gap stub — canonical
  surface per ADR-011, implementation pending".
- Publishing (versioned releases per language) is deferred to a follow-up ADR
  but is explicitly gated on parity reaching an agreed threshold.

### Success Criteria

- Both peer SDKs expose all six canonical kits (real or tracked stub).
- Each SDK README's package table maps 1:1 to the canonical Kit set + an
  explicit "tooling / out-of-taxonomy" section.
- `phenoUtils` README states it is the primitives tier, not a peer SDK.

## Consequences

### Positive Outcomes

- One authoritative Kit taxonomy; divergence becomes measurable and closeable.
- Consumers get a predictable, language-consistent SDK surface.
- Honest tiering avoids forcing primitives to imitate application SDKs.

### Negative Outcomes / Trade-offs

- Four new stub packages in the Go SDK add surface that is not yet implemented;
  must be clearly labeled to avoid implying readiness.
- Some existing Go tooling (`devhex`, `platformkit`) is now formally "outside"
  the Kit taxonomy, which may invite future relocation churn.

### Risk Mitigation

- Stubs carry explicit "not implemented" READMEs and no public version tag, so
  no consumer can mistake them for stable.
- Go module paths for stubs are chosen to match the eventual real surface to
  avoid a later breaking rename.

### Long-term Implications

- Sets up a follow-up ADR for **versioned SDK publishing** once parity lands.
- Establishes the precedent that cross-language parity is a governed property,
  tracked against this canonical list.

## Alternatives Considered

### Option A: Status Quo (no canonical taxonomy)
Let each SDK keep its own structure. Rejected: divergence keeps widening, "the
SDK" has no consistent meaning, and gaps stay invisible.

### Option B: Force all three languages (incl. Rust) to mirror the Kit set
Rejected: `phenoUtils` crates are primitives, not application kits; mirroring
would cargo-cult structure onto the wrong layer and misrepresent intent.

### Option C: Make Go the canonical shape and trim Python to match
Rejected: Python is the more complete SDK; trimming it would destroy working
surface to chase symmetry downward.

### Option D: Defer until publishing is designed
Rejected: publishing is *gated on* having a canonical taxonomy; deferring this
blocks the prerequisite.

## References

### Internal Documentation
- `phenotype-python-sdk` — `pyproject.toml` `[tool.uv.workspace]` members
- `phenotype-go-sdk` — `go.work`, root `README.md` package table
- `phenoUtils` — `crates/` (primitives tier)

### Related ADRs
- [ADR-001](001-hexagonal-architecture.md): Hexagonal Architecture — Kits expose ports; adapters per language
- [ADR-002](002-rust-primary-language.md): Rust as Primary Language — contextualizes why Rust/phenoUtils is the primitives tier, not a peer SDK

### Decision Log
- 2026-06-02: Proposed following the substrate-coherence audit; Python+Go as
  peer SDKs with canonical kit set `{auth, data, mcp, observability,
  resilience, testing}`, Rust as primitives tier.

## Changelog

- 2026-06-02 — Initial proposal (ADR-011).
