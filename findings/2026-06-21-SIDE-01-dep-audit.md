# SIDE-01: Cross-Repo Dep Audit (2026-06-21)

**Scope:** Grep all repos for outdated deps across 6 target crates: `pheno-otel`, `pheno-port-adapter`, `pheno-errors`, `pheno-context`, `pheno-config`, `pheno-cli-base`. Output current version + latest stable on crates.io per crate. Read-only. Method: ripgrep on `**/Cargo.toml` + `cargo search --limit 1` + crates.io REST API (cross-verified).

---

## TL;DR

| Crate               | Source-declared version | Latest on crates.io | Fleet consumers (path-dep) | `publish =` |
|---------------------|-------------------------|---------------------|----------------------------|-------------|
| `pheno-otel`        | 0.1.0                   | **N/A — not published** | 15                       | `true` (declared, never published) |
| `pheno-port-adapter`| 0.1.0                   | **N/A — not published** | 0 (substrate; source-only) | default `true`, never published |
| `pheno-errors`      | 0.1.0                   | **N/A — not published** | 3                        | default `true`, never published |
| `pheno-context`     | 0.1.0                   | **N/A — not published** | 0 (FocalPoint workspace member only) | `false` |
| `pheno-config`      | 0.1.0                   | **N/A — not published** | 2                        | `false` |
| `pheno-cli-base`    | 0.1.0                   | **N/A — not published** | 3                        | `false` |

**Headline finding:** All 6 crates are path-only monorepo deps. **Zero are published to crates.io.** No SemVer pinning exists anywhere in the fleet — every consumer uses `path = "..."` or `workspace = true`. Therefore the "outdated dep" condition is structurally inapplicable; the audit dimension that was specified is empty.

---

## Method

### Grep for fleet consumers

Pattern: `^pheno-<name>\s*=\s*` over `**/Cargo.toml` (head_limit 300). Output captured in §"Per-crate details" below. Mirrors of source `Cargo.toml` (the `[package]` table that *declares* the crate, not consumes it) were filtered out via secondary search for `name = "pheno-<name>"`.

### Version-on-crates.io

Primary: `cargo search --limit 1 pheno-<name>`. Sanity-check baseline (same command) returned real data for unrelated crates:

- `serde` → 1.0.228 ✓
- `tokio` → 1.52.3 ✓
- `opentelemetry` → 0.32.0 ✓

For all 6 pheno-* crates, `cargo search` returned **zero bytes / exit 0** (suspicious), so I cross-verified with the crates.io REST API using a custom User-Agent (the default `curl` UA is rate-limited):

```
curl -H "User-Agent: dep-audit-cli/1.0" https://crates.io/api/v1/crates/<name>
```

Result for all 6:
```json
{"errors":[{"detail":"crate `<name>` does not exist"}]}
```

→ **Confirmed: none of the 6 are published.**

### Source-declared version

Read each crate's primary `Cargo.toml` `[package]` table. All 6 declare `version = "0.1.0"`. Mirrors (e.g. `argis-extensions/pheno-otel/Cargo.toml`, `focalpoint-wt-v12-16-17/pheno-context/Cargo.toml`) also declare `0.1.0` — no drift between source and mirrors.

---

## Per-crate details

### 1. `pheno-otel` — v0.1.0

- **Source:** `pheno-otel/Cargo.toml:2-3` (primary), `argis-extensions/pheno-otel/Cargo.toml:2-3` (mirror).
- **crates.io:** does not exist (REST API verified).
- **`publish = true`** declared in source but no published release.
- **Consumers (15 path-dep refs):**
  1. `pheno-errors/Cargo.toml:17`
  2. `pheno-port-adapter/Cargo.toml:30`
  3. `FocalPoint/pheno-config/Cargo.toml:34`
  4. `FocalPoint/pheno-context/Cargo.toml:24`
  5. `FocalPoint/pheno-cli-base/Cargo.toml:31`
  6. `HexaKit/crates/phenotype-retry/Cargo.toml:15` (`workspace = true`)
  7. `PhenoObservability/Cargo.toml:53`
  8. `PhenoObservability/crates/tracely-sentinel/Cargo.toml:16` (`workspace = true`)
  9. `argis-extensions/pheno-flags/Cargo.toml:25`
  10. `argis-extensions/pheno-port-adapter/Cargo.toml:16`
  11. `argis-extensions/pheno-errors/Cargo.toml:16`
  12. `pheno-tracing/Cargo.toml:31`
  13. `phenotype-tooling/docs/absorbed-from-pheno-errors/Cargo.toml:17`
  14. `phenotype-tooling/docs/absorbed-from-PhenoEvents/Cargo.toml:20`
  15. `phenotype-tooling/docs/absorbed-from-pheno-port-adapter/Cargo.toml:16`

  None pin a `version =` clause. Canonical substrate per ADR-037; consumed correctly across the fleet.

### 2. `pheno-port-adapter` — v0.1.0

- **Source:** `pheno-port-adapter/Cargo.toml:2-3` (primary); mirrors at `FocalPoint/pheno-port-adapter/Cargo.toml:2-3`, `argis-extensions/pheno-port-adapter/Cargo.toml:2-3`, `focalpoint-wt-v12-16-17/pheno-port-adapter/Cargo.toml:2-3`.
- **crates.io:** does not exist.
- **`publish`** not explicitly set → Cargo defaults to `true` (allow), but no published release.
- **Fleet consumers:** **0** `path =` / `workspace = true` declarations. The crate exists only as standalone source. Substrate per ADR-038 (Hexagonal port-adapter L4 policy); usage appears to be direct-source inclusion in consuming workspaces (e.g. `argis-extensions/pheno-port-adapter` is itself the consumer of the substrate as a sibling workspace member).

### 3. `pheno-errors` — v0.1.0

- **Source:** `pheno-errors/Cargo.toml:2-3` (primary); mirror `argis-extensions/pheno-errors/Cargo.toml:2-3`.
- **crates.io:** does not exist.
- **`publish`** not explicitly set → default `true`, no published release.
- **Consumers (3):**
  1. `BytePort/crates/integration/Cargo.toml:13`
  2. `PlayCua/crates/integration/Cargo.toml:12`
  3. `PlayCua/native/Cargo.toml:89` (`workspace = true`)

### 4. `pheno-context` — v0.1.0

- **Source:** `FocalPoint/pheno-context/Cargo.toml:2-3` (primary); mirror `focalpoint-wt-v12-16-17/pheno-context/Cargo.toml:2-3`.
- **crates.io:** does not exist.
- **`publish = false`** (explicit) → not intended for crates.io.
- **Fleet consumers:** 0 path-dep declarations. Only reference is as a workspace member: `FocalPoint/Cargo.toml:72` lists `"pheno-context"` in `workspace.members`. Internal-only by design.

### 5. `pheno-config` — v0.1.0

- **Source:** `FocalPoint/pheno-config/Cargo.toml:2-3` (primary); mirror `Configra-conft-settly-check/crates/pheno-config/Cargo.toml` (per ADR-031, Configra is the canonical config repo name).
- **crates.io:** does not exist.
- **`publish = false`** (explicit) → not intended for crates.io.
- **Consumers (2):**
  1. `BytePort/crates/integration/Cargo.toml:15`
  2. `PlayCua/crates/integration/Cargo.toml:16` (path points to `Configra/crates/pheno-config` — the canonical home)

### 6. `pheno-cli-base` — v0.1.0

- **Source:** `FocalPoint/pheno-cli-base/Cargo.toml:2-3` (sole canonical).
- **crates.io:** does not exist.
- **`publish = false`** (explicit) → not intended for crates.io.
- **Consumers (3):**
  1. `Tokn/Cargo.toml:27`
  2. `Tokn-wt-feat-clap-ext-adopt-rebased-2026-06-14/Cargo.toml:28`
  3. `PlayCua/crates/cli-wrapper/Cargo.toml:9`

---

## Findings

1. **No version drift possible.** With path-only deps and no SemVer pinning, "current version" = "source-declared version" = 0.1.0 for all 6. Updating a source `Cargo.toml` propagates instantly. There is no registry-side lag to chase.

2. **No crates.io publication.** 3 crates have `publish = true` (or default `true`): `pheno-otel`, `pheno-port-adapter`, `pheno-errors`. None are actually published. 3 are explicitly `publish = false`: `pheno-context`, `pheno-config`, `pheno-cli-base`. The crates.io audit dimension is empty by design.

3. **No "outdated dep" condition exists.** The audit's stated goal (list crates where current < latest) returns 0 actionable items, because there is no `latest` to compare against. This is consistent with the project's monorepo substrate design (ADR-013 / ADR-022 / ADR-023): reusable capabilities are vendored as sibling crates, not consumed from a registry.

4. **Reproducibility gap (out of scope but worth noting).** Path-only deps break air-gapped builds and create submodule-drift risk. If reproducibility matters, switch to `git = "https://github.com/KooshaPari/<repo>", tag = "v0.1.0"` for the 3 publishable crates. This is a separate hardening track, not an "outdated dep" issue.

5. **Mirror-source drift (also out of scope).** `pheno-otel`, `pheno-port-adapter`, `pheno-errors`, `pheno-context` each exist at multiple paths. Mirrors declare identical versions (0.1.0) and identical core metadata, but a deeper diff (e.g. `[dependencies]` divergence, README drift) was not part of this audit. Recommend a follow-up mirror-vs-canonical diff if drift becomes a concern.

6. **Substrate canonicalization status:**
   - `pheno-otel` ✓ canonical per ADR-037; consumed by 15 crates correctly.
   - `pheno-port-adapter` ✓ canonical per ADR-038; consumed as sibling source in workspaces.
   - `pheno-errors` ✓ canonical (AppError substrate); consumed by 3 crates correctly.
   - `pheno-context` ✓ FocalPoint workspace member; not published.
   - `pheno-config` ✓ canonical per ADR-022 (Rust core); Configra is canonical repo per ADR-031; consumed by 2 crates.
   - `pheno-cli-base` ✓ FocalPoint workspace member; consumed by 3 crates.

---

## Recommendation

Treat the absence of a crates.io delta as a confirmation that the monorepo's path-dep design is working as intended for an internal fleet. No `cargo update` / `cargo bump` action is required. If the team wants a "published substrate" track for downstream external consumers, that's a separate plan (publish `pheno-otel`, `pheno-port-adapter`, `pheno-errors` to crates.io with semver + CHANGELOG hygiene per ADR-040).

---

## Appendix: raw evidence

```
$ cargo search --limit 1 pheno-otel       # 0 bytes stdout, exit 0
$ cargo search --limit 1 pheno-port-adapter  # 0 bytes stdout, exit 0
$ cargo search --limit 1 pheno-errors     # 0 bytes stdout, exit 0
$ cargo search --limit 1 pheno-context    # 0 bytes stdout, exit 0
$ cargo search --limit 1 pheno-config     # 0 bytes stdout, exit 0
$ cargo search --limit 1 pheno-cli-base   # 0 bytes stdout, exit 0

$ curl -H "User-Agent: dep-audit-cli/1.0" https://crates.io/api/v1/crates/pheno-otel
{"errors":[{"detail":"crate `pheno-otel` does not exist"}]}
# (identical response for the other 5)

# Sanity baseline (positive controls):
$ cargo search --limit 1 serde            # → serde = "1.0.228"
$ cargo search --limit 1 tokio            # → tokio = "1.52.3"
$ cargo search --limit 1 opentelemetry    # → opentelemetry = "0.32.0"
```
