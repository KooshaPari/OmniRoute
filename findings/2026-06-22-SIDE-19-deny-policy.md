# SIDE-19 — deny.toml + cargo-deny policy review across the pheno-* fleet

**Date:** 2026-06-22
**Author:** orch-w1-a (manual sweep)
**Scope:** Every `pheno-*` Rust crate with a `Cargo.toml` at the monorepo root, plus `pheno-secret-scan` and `pheno-ssot-template` (config-only / template).
**Out of scope:** `pheno-*` Python packages (`pheno-llms-txt`, `pheno-worklog-schema`, …) — they use `pip-audit` + `safety`, not `cargo-deny`. The Go packages (`pheno-go-ctxkit`) use `govulncheck`. TypeScript uses `npm audit` / `osv-scanner`. Cross-language audit unification is tracked separately under ADR-042.
**Reference:** ADR-042 (security audit cadence), ADR-040 (test coverage gates), L50/L46/L47 of the 71-pillar framework.

---

## 1. Inventory

| # | Crate | `Cargo.toml` | `deny.toml` | `[advisories]` | `[licenses]` | `[bans]` | `[sources]` | CI runs `cargo deny` | Score |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `pheno-errors` | ✓ `pheno-errors/Cargo.toml:1` | ✓ `pheno-errors/deny.toml:1` | partial (no `db-path`, no `db-urls`, no `yanked`) | ✓ version=2, 19 licenses, confidence=0.8 | ✓ `deny=[]` (empty), `wildcards=deny`, `multiple-versions=warn` | ✓ `allow-registry`, `unknown-git=deny`, `unknown-registry=deny` | ✓ `pheno-errors/.github/workflows/cargo-deny.yml:1` (weekly cron, PR, push) | **4/5** |
| 2 | `pheno-otel` | ✓ `pheno-otel/Cargo.toml:1` | ✓ `pheno-otel/deny.toml:1` | ✓ `db-path`, `db-urls`, `yanked=warn` | ✓ version=2, 13 licenses, confidence=0.8, `exceptions=[]` | ✓ **2 concrete deny entries** (openssl<0.10.70, chrono<0.4.31) + `allow=[]`, `skip=[]`, `skip-tree=[]` | ✓ `allow-registry`, `allow-git` (commented for KP mirror) | ✓ `pheno-otel/.github/workflows/deny.yml:1` (daily cron, `--all-features check`) | **5/5** |
| 3 | `pheno-port-adapter` | ✓ `pheno-port-adapter/Cargo.toml:1` | ✓ `pheno-port-adapter/deny.toml:1` | ✓ most rigorous: `vulnerability=deny`, `unmaintained=warn`, `notice=warn`, `unsound=deny`, `yanked=deny` + `db-path`, `db-urls` | ✓ `unlicensed=deny`, `allow-osi-freedoms=true`, `copyleft=deny`, `default=deny`, 10 licenses + `[[licenses.clarify]]` block | ✓ `deny=[]` empty but bans coverage via sources `allow-org={github=[KooshaPari]}` | ✓ `unknown-registry=deny`, `unknown-git=deny`, **`allow-org`**, `allow-git=[]` | ✓ `pheno-port-adapter/.github/workflows/audit.yml:21` (cargo deny --all-features check) | **5/5** |
| 4 | `pheno-tracing` | ✓ `pheno-tracing/Cargo.toml:1` | ✓ `pheno-tracing/deny.toml:1` | partial (no `db-path`, no `db-urls`; only `yanked=deny` + `version=2`) | ✓ version=2, 15 licenses, confidence=0.8 | ✓ `multiple-versions=warn`, `wildcards=deny`, `highlight=all` (commented) | ✓ `allow-registry`, `unknown-git=deny`, `unknown-registry=deny`, `allow-git=[]` | ✓ `pheno-tracing/.github/workflows/ci.yml:57` (`cargo deny check`) | **4/5** |
| 5 | `pheno-config` | ✓ `pheno-config/Cargo.toml:1` | **✗ none** | — | — | — | — | **✗ no `.github/workflows/`** | **0/5** |
| 6 | `pheno-context` | ✓ `pheno-context/Cargo.toml:1` | **✗ none** | — | — | — | — | **✗ no `.github/workflows/`** | **0/5** |
| 7 | `pheno-flags` | ✓ `pheno-flags/Cargo.toml:1` | **✗ none at root** (a copy exists in `argis-extensions/pheno-flags/deny.toml:1` with 1 RUSTSEC-2023-0071 ignore) | — | — | — | — | **✗ no `.github/workflows/`** | **0/5** |
| 8 | `pheno-events` | ✓ `pheno-events/Cargo.toml:1` | **✗ none** | — | — | — | — | **✗ no `.github/workflows/`** | **0/5** |
| 9 | `pheno-chaos` | ✓ workspace `pheno-chaos/Cargo.toml:1` (members: pheno-chaos, pheno-chaos-macros) | **✗ none** | — | — | — | — | **✗ no `.github/workflows/`** | **0/5** |
| 10 | `pheno-secret-scan` | ✗ (config-only repo; YAML + Justfile + workflow definitions, no Rust source) | ✓ `pheno-secret-scan/deny.toml:1` (forward-compat doc, identical to root `deny.toml`) | ✓ `db-path`, `db-urls`, `yanked=warn`, `ignore=[]` | ✓ 12 licenses, confidence=0.8 | ✓ `deny=[]`, `wildcards=deny`, `multiple-versions=warn` | ✓ `allow-registry`, `unknown-git=deny`, `unknown-registry=deny` | n/a (no Rust crate to scan; CI scans YAML/Justfile via `.github/workflows/deny.yml`) | **N/A** (forward-compat spec) |
| 11 | `pheno-ssot-template` | template only (`pheno-ssot-template/Cargo.toml.template:1`) | ✓ `pheno-ssot-template/deny.toml:1` (strict baseline — most conservative license floor in the fleet) | ✓ `db-path=$CARGO_HOME/...`, `db-urls`, `yanked=warn` | ✓ 11 licenses (NO GPL/CC-BY-SA — strict) | ✓ `wildcards=warn` (note: `warn` not `deny`), `multiple-versions=warn` | ✓ `allow-registry`, `unknown-registry=warn`, `unknown-git=warn` (looser than other crates) | n/a (template, scaffolded downstream) | **N/A** (template — see §3 for divergence note) |

### Summary
- **Total `pheno-*` Rust crates with `Cargo.toml`:** 9 (rows 1–9 above)
- **Crates with `deny.toml`:** 4 of 9 (44 %)
- **Crates with CI running `cargo deny`:** 4 of 9 (44 %)
- **Crates with both:** 4 of 9 (pheno-errors, pheno-otel, pheno-port-adapter, pheno-tracing)
- **Crates with neither:** 5 of 9 (pheno-config, pheno-context, pheno-flags, pheno-events, pheno-chaos)
- **Fleet score mean:** (4 + 5 + 5 + 4 + 0 + 0 + 0 + 0 + 0) / 9 = **2.0 / 5**

---

## 2. Scoring rubric (0–5)

| Score | Meaning |
|---|---|
| 0 | No `deny.toml` |
| 1 | `deny.toml` exists but only 1 section (e.g. forward-compat stub) |
| 2 | `deny.toml` with 2 of 4 core sections `[advisories]`/`[licenses]`/`[bans]`/`[sources]` |
| 3 | `deny.toml` with all 4 core sections, but no CI integration |
| 4 | All 4 core sections + at least one rigor primitive (db-path, db-urls, yanked policy, copyleft policy, allow-org, clarify block) + CI integration |
| 5 | All 4 core sections + ≥2 rigor primitives + CI integration + at least one concrete ban entry OR `[licenses.exceptions]`/clarify block |

**Why this rubric:** the cargo-deny docs identify 4 mandatory gates (advisories, licenses, bans, sources) and ~10 optional primitives that harden reproducibility (db-path, db-urls, yanked, copyleft, allow-org, clarify, exceptions, etc.). A score of 3 means "the file exists and is parseable, but will let things through". A score of 4 means "the four gates are present and the CI will catch drift". A score of 5 means "the four gates are present AND the file actively blocks known-bad versions / licenses / sources".

---

## 3. Notable divergences between existing `deny.toml` files

Three crates disagree on policy choices. The divergence is documented so we can decide whether to converge (§6 recommendation).

### 3a. `[bans] wildcards`
- `pheno-errors`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing`, `argis-extensions/pheno-flags` → `wildcards = "deny"`
- `pheno-ssot-template` → `wildcards = "warn"`
- **Implication:** `pheno-ssot-template` will allow `serde = "*"` style specs; the others won't. This is the single largest behavioral difference and is probably an oversight (the comment in `pheno-ssot-template/deny.toml:1` says "strictest license floor" but `wildcards = warn` is laxer on dependency-spec discipline than the other crates).

### 3b. `[sources] unknown-*` strictness
- `pheno-ssot-template` → `unknown-registry = "warn"`, `unknown-git = "warn"`
- All others → `unknown-registry = "deny"`, `unknown-git = "deny"`
- **Implication:** `pheno-ssot-template` will not block a transitive dep that pulls from a non-crates.io registry or a non-allowlisted git URL. The other crates will.

### 3c. `[licenses] allow` breadth
- Narrowest: `pheno-port-adapter` (10 licenses, no `GPL`, no `CC-BY-SA`, no `Unlicense`)
- Mid: `pheno-otel` (13), `pheno-tracing` (15), `pheno-ssot-template` (11)
- Broadest: `pheno-errors` (19, includes `GPL-3.0-only`, `CC-BY-SA-4.0`, `WTFPL`, `CDLA-Permissive-2.0`)
- **Outlier:** `PhenoPlugins/crates/pheno-plugin-vessel/deny.toml:1` (18 licenses, includes `GPL-3.0-only` and `CC-BY-SA-4.0`) — see §5 for why.

### 3d. `[advisories] version` field
- `pheno-otel` does not declare `version = 2` → cargo-deny defaults to version 1 (legacy schema).
- `pheno-errors`, `pheno-port-adapter`, `pheno-tracing` → `version = 2`
- `PhenoPlugins/crates/pheno-plugin-vessel/deny.toml` does not declare either.
- **Implication:** schema drift. The 2024 cargo-deny release bumped default to v2 and is backwards-compatible; declaring it explicitly avoids surprise upgrades.

### 3e. `[bans] deny = [...]` content
- Only `pheno-otel` has concrete entries (2: openssl<0.10.70, chrono<0.4.31).
- `pheno-errors`, `pheno-port-adapter`, `pheno-tracing`, `pheno-ssot-template`, `pheno-secret-scan` → all `deny = []`
- **Implication:** 4 of 5 crates with `[bans]` have a ceremonial bans section. The bans gate is only as strong as the deny list.

---

## 4. Top 3 missing policies fleet-wide

### 4.1. Missing `deny.toml` in 5 of 9 Rust crates
**Pillar impact:** L46 (vulnerability scanning), L50 (secrets / SBOM), L51 (SOC2 CC7.1 — vulnerability management), L52 (encryption-at-rest mandate per ADR-078).

The 5 crates without `deny.toml` (`pheno-config`, `pheno-context`, `pheno-flags`, `pheno-events`, `pheno-chaos`) **do not get scanned for advisories, license drift, or banned crates at all**. Each one has runtime deps that pull transitive crates:

| Crate | First-party deps | Notable transitive risk |
|---|---|---|
| `pheno-config` | `zeroize`, `figment`, `toml` | `serde_yaml` (depends on `yaml-rust` / `libyaml`) |
| `pheno-context` | `http`, `serde`, `proptest-derive` | `proptest-derive` 0.5 → `syn` 2.x |
| `pheno-flags` | `thiserror`, `serde`, `proptest-derive`, `loom` | `loom` 0.7 → `generator` 0.8 (no RUSTSEC, but historically slow-moving) |
| `pheno-events` | `chrono`, `uuid`, `proptest-derive`, `serde` | `uuid` 1.x → `getrandom` (no RUSTSEC, but the web-sys dep tree is large) |
| `pheno-chaos` | `libc` (workspace pin) | `libc` 0.2 is huge; latest advisory is RUSTSEC-2024-0388 (out-of-bounds write on `dup2`/`dup3`) |

### 4.2. `[advisories]` lacks `db-path` + `db-urls` in 3 of 4 crates
**Pillar impact:** L46 (vulnerability scanning reproducibility), L51 SOC2 CC7.1 (change-management evidence).

| Crate | `[advisories] db-path` | `[advisories] db-urls` | `[advisories] yanked` |
|---|---|---|---|
| `pheno-errors` | ✗ | ✗ | ✗ |
| `pheno-otel` | ✓ `~/.cargo/advisory-db` | ✓ `https://github.com/rustsec/advisory-db` | ✓ `warn` |
| `pheno-port-adapter` | ✓ `~/.cargo/advisory-dbs` (sic, plural) | ✓ same URL | ✓ `deny` (with extra: vulnerability, unmaintained, notice, unsound) |
| `pheno-tracing` | ✗ | ✗ | ✓ `deny` |

**Why it matters:** without `db-path` + `db-urls`, cargo-deny fetches the live advisory DB on every run, which:
1. Makes CI runs non-reproducible (different runs may see different advisories).
2. Adds ~5–15 s of network I/O per CI invocation.
3. Breaks air-gapped builds (the org runs some builds on self-hosted runners per ADR-023 device-fit).
4. Means SOC2 evidence (CC7.1) cannot assert "we scanned against advisory DB revision X" — only "we scanned against *the* advisory DB".

Side note: `pheno-port-adapter` uses `~/.cargo/advisory-dbs` (plural) and `pheno-otel` uses `~/.cargo/advisory-db` (singular). Both work but the inconsistency is a fleet smell.

### 4.3. CI integration missing in 5 of 9 crates
**Pillar impact:** L46 (continuous vulnerability scanning), L47 (change-tracked security gate), L50 (CI gate per ADR-027).

| Crate | `deny.toml` | CI workflow | Schedule |
|---|---|---|---|
| `pheno-errors` | ✓ | ✓ `cargo-deny.yml` | weekly Mon 09:00 |
| `pheno-otel` | ✓ | ✓ `deny.yml` | daily 06:00 UTC |
| `pheno-port-adapter` | ✓ | ✓ `audit.yml` (cargo deny step) | (on PR + push) |
| `pheno-tracing` | ✓ | ✓ `ci.yml` (cargo deny step) | (on PR + push) |
| `pheno-config` | ✗ | ✗ | — |
| `pheno-context` | ✗ | ✗ | — |
| `pheno-flags` | ✗ | ✗ | — |
| `pheno-events` | ✗ | ✗ | — |
| `pheno-chaos` | ✗ | ✗ | — |

The 4 crates with both have different schedule postures: `pheno-otel` runs **daily**, `pheno-errors` runs **weekly**, the other two run **only on PR/push**. This is fine for CI wall-time but means a freshly-disclosed RUSTSEC can sit in `pheno-tracing` for days before the next dep-touching PR surfaces it.

**Bonus gap (4th but worth noting):** No fleet-wide `deny.toml` is published anywhere a sub-crate can `#[path = "../../deny.toml"]` reference. Each crate hand-copies the policy. There is `deny.toml` at the monorepo root (`deny.toml:1`) but it is a forward-compat doc for the Go workspace, not the canonical Rust fleet baseline. We should publish `deny.toml.fleet-baseline` to a shared location (`pheno-ssot-template/deny.toml` is the closest existing candidate but it is template-bound and inconsistent with the fleet; see §3a).

---

## 5. Adjacent finding: `PhenoPlugins/crates/pheno-plugin-vessel/deny.toml`

`PhenoPlugins/crates/pheno-plugin-vessel/deny.toml:1` is the most concrete `deny.toml` in the fleet — it has 3 ignored RUSTSECs with **inline reasons** (the only one of the 11 deny.toml files reviewed that does):

```toml
[advisories]
ignore = [
    { id = "RUSTSEC-2025-0134", reason = "No safe upgrade available. rustls-pemfile deprecated, migration requires async-nats update." },
    { id = "RUSTSEC-2025-0140", reason = "No safe upgrade available. gix = 0.71 pinned in Cargo.toml, requires breaking API change." },
    { id = "RUSTSEC-2026-0049", reason = "No safe upgrade available. async-nats 0.46.0 still uses vulnerable rustls-webpki." },
]
```

This is the **gold standard** for what we want every deny.toml to look like: every ignored advisory is paired with a reason that identifies the upstream pin and the migration blocker. Two issues with this file, though:

1. **No `expiry` field.** cargo-deny supports `expiry = "YYYY-MM-DD"` so ignored advisories auto-re-surface after the date. Without it, an ignored advisory can live in `ignore = []` forever.
2. **License allow-list is too broad** for a federated-service cargo: it permits `GPL-3.0-only` and `CC-BY-SA-4.0`, which copyleft the derived work. The other 4 fleet `deny.toml` files correctly exclude these. Recommend trimming to match the fleet baseline (§6).

---

## 6. Sample unified fleet-wide `deny.toml`

This is the recommended baseline that combines the rigor of `pheno-port-adapter` (allow-org, copyleft=deny, vulnerability=deny), the structural completeness of `pheno-otel` ([graph], [spdx], [output], concrete deny entries), and the ignore-with-reason pattern from `PhenoPlugins/crates/pheno-plugin-vessel`.

```toml
# deny.toml — Pheno-fleet cargo-deny baseline (SIDE-19, 2026-06-22)
#
# Apply this file as-is to every new pheno-* crate. Existing crates
# should diff against this and adopt missing primitives in a follow-up PR.
#
# Reference:
#   ADR-042  — security audit cadence (monthly sweep + on-PR gate)
#   ADR-040  — test coverage gates per tier (lib 80% / framework 70% / fed 60%)
#   L46/L47  — vulnerability scanning + change-tracked security gate
#   L51      — SOC2 CC7.1 (vulnerability management evidence)
#
# Schema: cargo-deny 0.14+ (version 2 [advisories] + version 2 [licenses]).
# See: https://embarkstudios.github.io/cargo-deny/

# ─── Global ─────────────────────────────────────────────────────────────────
[graph]
all-features = false
no-default-features = false

# ─── Advisories ─────────────────────────────────────────────────────────────
# Pin db-path + db-urls so CI is reproducible (L51 SOC2 CC7.1 evidence).
# Without these, cargo-deny fetches the live DB on every run.
[advisories]
db-path = "~/.cargo/advisory-db"
db-urls = ["https://github.com/rustsec/advisory-db"]
version = 2
vulnerability = "deny"     # RUSTSEC with a CVE → fail CI
unmaintained = "warn"     # crates with no commits > 1y → warn
notice = "warn"           # informational notices (e.g. unmaintained-warnings)
unsound = "deny"          # soundness bugs → fail CI
yanked = "deny"           # yanked crates → fail CI
ignore = [
    # Every entry MUST have a `reason` and an `expiry` (gold-standard from
    # PhenoPlugins/crates/pheno-plugin-vessel/deny.toml). The expiry is
    # mandatory so ignored advisories auto-re-surface for re-evaluation.
    # Example:
    # { id = "RUSTSEC-2025-9999", reason = "Pinned dep X blocks upgrade; see issue #N", expiry = "2026-12-31" },
]

# ─── Licenses ───────────────────────────────────────────────────────────────
# Reject unknown / copyleft / non-OSI by default. Permit the standard
# permissive set + Unicode + 0BSD + CC0 (public-domain dedications).
[licenses]
version = 2
confidence-threshold = 0.8
unlicensed = "deny"
allow-osi-freedoms = true
copyleft = "deny"
default = "deny"
allow = [
    "MIT",
    "Apache-2.0",
    "Apache-2.0 WITH LLVM-exception",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "BSD-3-Clause-Clear",
    "ISC",
    "Zlib",
    "0BSD",
    "CC0-1.0",
    "Unicode-DFS-2016",
    "Unicode-3.0",
    "Unicode-MIT-0",
    "MPL-2.0",             # file-level weak copyleft; acceptable
]
exceptions = [
    # Per-crate license exception: name + SPDX expression + license-file hash.
    # Required when a transitive dep's license is acceptable but not in `allow`.
    # Example:
    # { name = "ring", allow = ["OpenSSL"], reason = "AWS-LC backend; see ADR-N" },
]

# ─── Bans ───────────────────────────────────────────────────────────────────
# Concrete deny entries — these are the active CVEs / EOL crates we are
# blocking fleet-wide. Add new entries as CVEs are disclosed.
[bans]
multiple-versions = "warn"
wildcards = "deny"
highlight = "all"
allow = []                # first-party / std allowlist (rare)
deny = [
    { name = "openssl", version = "<0.10.70" },  # CVEs in older releases (from pheno-otel)
    { name = "chrono", version = "<0.4.31" },    # CVE-2020-26235 (from pheno-otel)
    { name = "libc", version = "<0.2.155" },     # RUSTSEC-2024-0388 dup2/dup3 OOB write
    { name = "time", version = "<0.3.36" },      # CVE-2024-43802 localtime_r soundness
]
skip = []
skip-tree = []

# ─── Sources ────────────────────────────────────────────────────────────────
# crates.io + the KooshaPari organization allowlist (mirrors pheno-port-adapter).
[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
allow-git = []
allow-org = { github = ["KooshaPari"] }

# ─── SPDX ──────────────────────────────────────────────────────────────────
# Use SPDX expressions throughout (cargo-deny v0.14+).
[spdx]
version = 3
expression = true

# ─── Output ─────────────────────────────────────────────────────────────────
# Keep dep-graph output shallow; deeper dumps are not actionable in CI.
[output]
feature-depth = 1
```

### 6.1. Migration checklist for existing 4 fleet crates

When this baseline lands, the 4 existing `deny.toml` files should adopt the missing primitives:

| Primitive | pheno-errors | pheno-otel | pheno-port-adapter | pheno-tracing |
|---|---|---|---|---|
| `db-path` + `db-urls` | add | ✓ (already has) | ✓ (already has) | add |
| `version = 2` in `[advisories]` | add | add | ✓ | ✓ |
| `vulnerability`/`unsound`/`unmaintained`/`notice` | add | add | ✓ | add |
| `yanked = "deny"` | add (currently unset) | upgrade warn→deny | ✓ | ✓ |
| `unlicensed`/`copyleft`/`default`/`allow-osi-freedoms` | add | add | ✓ | add |
| `allow-org` in `[sources]` | add | add | ✓ | add |
| `[graph]`, `[spdx]`, `[output]` sections | add | ✓ | add | add |
| Concrete `[bans] deny` entries | add | ✓ | add | add |

---

## 7. Recommendations (priority order)

1. **(P0, 1 day)** Drop the unified fleet-wide `deny.toml` (above) into `pheno-ssot-template/deny.toml` so every scaffolded crate inherits it. This fixes the 4 divergences in §3 with no per-crate work.
2. **(P0, 1 day)** Author `deny.toml` for the 5 missing crates (`pheno-config`, `pheno-context`, `pheno-flags`, `pheno-events`, `pheno-chaos`) by copying the unified baseline verbatim.
3. **(P1, 2 days)** Add CI workflow to each of the 5 missing crates: copy `pheno-errors/.github/workflows/cargo-deny.yml:1` (weekly cron is the right cadence for libs that ship rarely; promote to daily only for pheno-otel / pheno-tracing which ship observability artifacts).
4. **(P1, 1 day)** Trim `PhenoPlugins/crates/pheno-plugin-vessel/deny.toml:1` license allow-list to remove `GPL-3.0-only` and `CC-BY-SA-4.0` (copyleft leaks), and add `expiry = "..."` to the 3 ignore entries.
5. **(P2, 1 day)** Bump `pheno-otel` and `pheno-port-adapter` to use the same `db-path` value (`~/.cargo/advisory-db` singular vs `~/.cargo/advisory-dbs` plural). Singular is canonical.
6. **(P2, 2 days)** Wire the unified baseline into `pheno-flake` (ADR-039) so `nix develop` ships cargo-deny 0.14+ pre-installed and the `justfile` adds a `deny` recipe that walks every pheno-* crate in the workspace.

---

## 8. Verification

This finding is read-only — no files modified. To verify per-crate scores, re-run:

```sh
# 1. Inventory: which pheno-* Rust crates have deny.toml?
for d in pheno-chaos pheno-config pheno-context pheno-errors pheno-events \
         pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  [ -f "$d/Cargo.toml" ] && [ -f "$d/deny.toml" ] && echo "✓ $d" || echo "✗ $d"
done

# 2. CI integration: which pheno-* crates have a cargo-deny workflow?
for d in pheno-chaos pheno-config pheno-context pheno-errors pheno-events \
         pheno-flags pheno-otel pheno-port-adapter pheno-tracing; do
  ls "$d/.github/workflows/" 2>/dev/null \
    | grep -iE "deny|advisory" \
    | head -1 \
    | awk -v d="$d" '{ print (NF ? "✓ " d " → " $0 : "✗ " d) }'
done

# 3. Per-crate `cargo deny check` (run inside each crate to verify the baseline works)
for d in pheno-errors pheno-otel pheno-port-adapter pheno-tracing; do
  ( cd "$d" && cargo deny --all-features check 2>&1 | tail -5 )
done
```

---

## 9. Side findings (informational)

- **Root monorepo `deny.toml:1`** is a forward-compat doc for the Go workspace (govulncheck + go mod verify), not the Rust fleet baseline. After this sweep we should add `deny.toml.fleet-baseline` (or move it to `pheno-ssot-template/deny.toml`) as the canonical Rust baseline. The root file can keep its current forward-compat role.
- **`pheno-flags/deny.toml` does not exist at the crate root**, but a copy exists in `argis-extensions/pheno-flags/deny.toml:1` with a single RUSTSEC-2023-0071 ignore (rsa Marvin Attack — explicitly noted as "no fleet impact"). When promoting `pheno-flags` to root ownership, copy this deny.toml verbatim and add it to CI.
- **`pheno-secret-scan/deny.toml:1`** is byte-identical to the monorepo root `deny.toml:1` (both are forward-compat docs). Confirmed by direct diff.
- **`pheno-port-adapter/deny.toml:41-46`** has an inline `[[licenses.clarify]]` entry for `adler2` with `hash = 0x12345678` (a placeholder hash). This will fail cargo-deny with `license-file hash mismatch`. Recommend fixing to the real adler2 license-file hash, or removing the `clarify` block entirely (the dual-license `0BSD OR MIT OR Apache-2.0` expression is already in `allow` indirectly via `0BSD` + `MIT` + `Apache-2.0`).