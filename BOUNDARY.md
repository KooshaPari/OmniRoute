# Boundary Lock: omniroute-rust — ARCHIVE_ONLY failsafe

**Status:** ARCHIVED — absorption into HexaKit `crates/omniroute/` blocked by
structural mismatch with the planned single-crate copy.

**Decision date:** 2026-07-17
**Source repo:** `KooshaPari/omniroute-rust` (HEAD `471a095`, branch `main`)
**Planned target:** `HexaKit (crates/omniroute/)`
**Actual outcome:** Repository archived via `gh repo archive`; no code copied
into HexaKit. Registry row `repo-omniroute-rust` updated with this rationale.

---

## Why the failsafe triggered

The task description characterized `omniroute-rust` as **"OmniRoute client/binding
crate"** and prescribed a single-crate copy:

```bash
mkdir -p HexaKit/crates/omniroute && cp -r omniroute-rust/src \
    omniroute-rust/tests omniroute-rust/Cargo.toml omniroute-rust/README.md \
    HexaKit/crates/omniroute/
```

The audit of the source repo showed this premise was incorrect on every count:

| Task assumption                                  | Reality on disk                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `omniroute-rust/src/` exists                     | **No such directory.** Source code lives in `crates/omni-*/src/`.                                |
| `omniroute-rust/tests/` exists                   | **No such directory.** Integration tests live in `crates/omni-core/tests/`.                      |
| `omniroute-rust/Cargo.toml` is a package manifest | It is a `[workspace]` root declaring 13 member crates; no `[package]` block.                    |
| A top-level `lib.rs` exists                      | **No top-level `lib.rs`.** Each member crate has its own `src/lib.rs`.                           |
| "client/binding crate"                           | The README explicitly states this is "Enterprise Rust rewrite of the OmniRoute LLM gateway".      |
| Add `crates/omniroute` to HexaKit workspace `members` | Cargo rejects nested workspaces as members; the source has its own `[workspace]` block.        |

The literal copy command exits 1 (`cp: ...src: No such file or directory`).
The verification step `cargo check -p omniroute` from HexaKit cannot resolve
any package named `omniroute` (the nested workspace exposes `omni-core`,
`omni-sdk`, etc., not `omniroute`). Per the task's explicit failsafe clause —
**"ARCHIVE_ONLY + boundary doc if HexaKit doesn't exist or build fails"** —
the absorption is aborted and this boundary doc is the durable record.

## What's actually in the source repo

```
omniroute-rust/
├── Cargo.toml                      # [workspace] root, 13 members
├── Cargo.lock                      # 104 KB lockfile
├── README.md                       # "Enterprise Rust rewrite of OmniRoute"
├── crates/
│   ├── omni-core/                  # errors, config, executor trait, ids, model, provider
│   ├── omni-protocol/              # OpenAI / Claude / Gemini / Codex / A2A / MCP wire types
│   ├── omni-translator/            # format detection + conversion registry
│   ├── omni-storage/               # sqlx SQLite + migrations
│   ├── omni-router/                # executor registry + routing + circuit breaker
│   ├── omni-compression/           # RTK + Caveman + Aggressive + Adaptive engines
│   ├── omni-server/                # axum HTTP server, OpenAI-compat, SSE, /metrics
│   ├── omni-mcp/                   # MCP server + tools
│   ├── omni-a2a/                   # A2A v0.3 protocol
│   ├── omni-telemetry/             # tracing + metrics + audit + OTel
│   ├── omni-cli/                   # clap CLI (`omniroute` binary)
│   ├── omni-sdk/                   # Rust client SDK (closest to "binding crate")
│   └── omni-crypto/                # crypto helpers
├── Dockerfile, justfile, rust-toolchain.toml
└── audit_scorecard.json, substrate-audit-dag-plan.md
```

The 13 members form a tightly-coupled DAG. `omni-sdk` (the closest analogue
to the task's "binding crate") depends on `omni-core` + `omni-protocol` via
`path = "../omni-*"`. Decomposing the workspace into a single absorbable
unit would require an explicit decomposition plan and is out of scope for
this single-session task — the registry row already flagged this with
`[DEFERRED-W2: too large or structurally wrong for single-session absorption;
needs dedicated audit phase]`.

## HexaKit state at decision time

- HexaKit workspace exists, branch `wip/2026-07-16-0025-auto`, dirty
  `.github/PULL_REQUEST_TEMPLATE.md` (unrelated to this task).
- `HexaKit/crates/` already contains 40+ members/excludes (no `omniroute/`).
- HexaKit's `[workspace]` uses `resolver = "2"` and an `exclude` list of
  absorbed stubs. Adding a nested workspace as a `members` entry is
  incompatible with Cargo's workspace model; the correct integration would
  be a multi-week decomposition project, not a single `cp -r`.

## What was NOT done (per failsafe)

- ❌ No copy into `HexaKit/crates/omniroute/`.
- ❌ No edit to `HexaKit/Cargo.toml` workspace `members` or `exclude`.
- ❌ No commit or push to HexaKit.
- ❌ No `cargo check -p omniroute` from HexaKit (impossible — no such package).

## What WAS done

- ✅ This boundary doc committed to `omniroute-rust` before archive.
- ✅ `gh repo archive KooshaPari/omniroute-rust -y` executed.
- ✅ Audit artifact written at
   `phenotype-registry/audits/absorption-justifications/omniroute-rust-failsafe-2026-07-17.md`.
- ✅ Registry row `repo-omniroute-rust` updated (disposition `ABSORB` retained
   for forward compatibility; `note` appended with this rationale;
   `audit_artifact` repointed to the failsafe doc).

## Path forward

If a future operator wants to actually absorb the OmniRoute Rust substrate,
the minimum viable plan is:

1. Open a dedicated decomposition audit. The DAG-rooted 13-crate workspace
   needs an explicit absorption graph — which sub-crates go where
   (`omni-router` → `phenotype-router`, `omni-compression` → a new
   `phenotype-compression`, `omni-sdk` → `phenotype-omniroute-client`, etc.).
2. Add the chosen sub-crates one at a time as `HexaKit` workspace `members`,
   using HexaKit's `[workspace.dependencies]` (which already covers most of
   the dep set: `tokio`, `axum`, `reqwest`, `serde`, `tracing`, `clap`,
   `dashmap`, etc.). The HexaKit workspace dep table is a strict superset
   for some crates and will need supplementation for `sqlx`, `rmcp`,
   `tiktoken-rs`, `utoipa`, `governor`, `moka`, `jsonwebtoken`,
   `aes-gcm`, `argon2`, etc.
3. Re-establish wire-compat tests against the TS fork at
   `OmniRoute-L5-122` per the original `omniroute-rust/README.md`.
4. Coordinate with the `OmniRoute` monorepo's `repo-omniroute-rs` row —
   that one is already `fsm: absorbed` into `OmniRoute (crates/omniroute-rs/)`
   on 2026-07-17. Two OmniRoute Rust substrates cannot coexist; one must
   be designated canonical.

## Provenance

- Audit performed by Forge session, 2026-07-17.
- Source repo HEAD at decision time: `471a095 chore: establish independent omniroute-rust baseline`.
- HexaKit HEAD at decision time: branch `wip/2026-07-16-0025-auto`.
- Registry HEAD at decision time: branch `registry-main`, version `1.6.18`.