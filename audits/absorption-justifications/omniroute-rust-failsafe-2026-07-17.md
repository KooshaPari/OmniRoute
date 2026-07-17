# omniroute-rust — ARCHIVE_ONLY failsafe (2026-07-17)

## Decision

`KooshaPari/omniroute-rust` is **archived** without code being absorbed into
`HexaKit/crates/omniroute/`. The task's failsafe clause
("ARCHIVE_ONLY + boundary doc if HexaKit doesn't exist or build fails")
applies because the literal task steps cannot succeed.

## What was attempted

Single-session absorption of `omniroute-rust` into HexaKit as
`crates/omniroute/`, per the registry row `repo-omniroute-rust` (disposition
ABSORB, target `HexaKit (crates/omniroute/)`).

The prescribed steps were:

1. Read `omniroute-rust/Cargo.toml` and top-level `lib.rs`.
2. Confirm HexaKit workspace + uniqueness check.
3. `cp -r omniroute-rust/src omniroute-rust/tests omniroute-rust/Cargo.toml omniroute-rust/README.md HexaKit/crates/omniroute/`.
4. Add `"crates/omniroute"` to HexaKit workspace `members`.
5. `cargo check -p omniroute` from HexaKit.
6. Commit + push HexaKit.
7. `gh repo archive KooshaPari/omniroute-rust -y`.
8. Update registry row.

## Where it failed

- **Step 1 (audit).** The repo's `Cargo.toml` is a `[workspace]` root
  declaring 13 member crates (`omni-core`, `omni-protocol`, `omni-storage`,
  `omni-translator`, `omni-router`, `omni-compression`, `omni-server`,
  `omni-mcp`, `omni-a2a`, `omni-telemetry`, `omni-cli`, `omni-sdk`,
  `omni-crypto`). There is **no top-level `src/`, `tests/`, or `lib.rs`**.
  The README confirms: "Enterprise Rust rewrite of the OmniRoute LLM
  gateway." This is a full backend substrate, not the "client/binding
  crate" the task description claimed.
- **Step 3 (copy).** `cp -r omniroute-rust/src ...` exits 1 with
  `cp: ...: No such file or directory`. `omniroute-rust/tests/` likewise
  does not exist.
- **Step 4 (register).** Adding `"crates/omniroute"` to HexaKit's workspace
  `members` is incompatible with Cargo's workspace model: a member entry
  pointing at a directory that itself contains a `[workspace]` block is
  rejected by Cargo. The only correct integration pattern would be to
  add each `omni-*` member crate individually to HexaKit's `members` (or
  exclude the nested workspace and treat it as a self-contained subtree),
  which is a multi-week decomposition project — explicitly out of scope.
- **Step 5 (verify).** `cargo check -p omniroute` from HexaKit cannot
  resolve any package named `omniroute`; the nested workspace exposes
  `omni-core`, `omni-sdk`, etc.

## HexaKit state

- Exists at `/Users/kooshapari/CodeProjects/Phenotype/repos/HexaKit/`.
- Branch `wip/2026-07-16-0025-auto`. Dirty `.github/PULL_REQUEST_TEMPLATE.md`
  (unrelated).
- Workspace uses `resolver = "2"`, has `exclude` for ~30 absorbed stubs,
  and `members` for the actively-developed native crates. No
  `crates/omniroute/` pre-existing — uniqueness check passed.

## What was done

- ✅ Boundary doc written at `omniroute-rust/BOUNDARY.md`, committed and
   pushed to `KooshaPari/omniroute-rust` (commit `348101a`) before archive.
- ✅ `gh repo archive KooshaPari/omniroute-rust -y` executed.
   Verified `isArchived: true` on `KooshaPari/omniroute-rust`.
- ✅ Registry row `repo-omniroute-rust` updated: `disposition` and `target`
   retained per task instruction; `note` appended with this rationale;
   `audit_artifact` repointed to this doc.

## What was NOT done (per failsafe)

- ❌ No copy into `HexaKit/crates/omniroute/`.
- ❌ No edit to `HexaKit/Cargo.toml`.
- ❌ No commit or push to HexaKit.
- ❌ No `cargo check -p omniroute` from HexaKit.

## Related registry rows

- `repo-omniroute-rs` — disposition ABSORB, target `OmniRoute (crates/omniroute-rs/)`,
  fsm `absorbed`. This is a **separate, smaller** substrate that was
  successfully absorbed into the OmniRoute monorepo on 2026-07-17. Two
  OmniRoute Rust substrates cannot long coexist; future work must
  designate one as canonical (likely `OmniRoute (crates/omniroute-rs/)`
  given its `fsm: absorbed` state).
- `gw-omniroute` — disposition `DYNAMIC-KEEP`, target `phenotype-gateway`.
  Independent gateway substrate.

## Path forward

See `omniroute-rust/BOUNDARY.md` "Path forward" section for the minimum
viable decomposition plan. In short:

1. Dedicated decomposition audit to map each `omni-*` sub-crate to a
   HexaKit-native crate (e.g. `omni-router` → `phenotype-router`,
   `omni-compression` → new `phenotype-compression`).
2. Add chosen sub-crates as HexaKit workspace `members` one at a time,
   supplementing HexaKit's `[workspace.dependencies]` for the deps it
   doesn't yet cover (`sqlx`, `rmcp`, `tiktoken-rs`, `utoipa`,
   `governor`, `moka`, `jsonwebtoken`, `aes-gcm`, `argon2`).
3. Reconcile with the existing `repo-omniroute-rs` row to avoid two
   parallel substrates.

## Provenance

- Forge session, 2026-07-17.
- Source repo HEAD at audit: `471a095 chore: establish independent omniroute-rust baseline`.
- Final committed HEAD: `348101a docs(boundary): record ARCHIVE_ONLY failsafe ...`.
- Archive command exit: 0. `isArchived: true` confirmed via
  `gh repo view KooshaPari/omniroute-rust --json isArchived`.
- HexaKit HEAD at decision: branch `wip/2026-07-16-0025-auto`.
- Registry HEAD at decision: branch `registry-main`, version `1.6.18`.