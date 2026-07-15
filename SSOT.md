# SSOT — Single Source of Truth

This document records the canonical authority for cross-cutting facts.
When a fact conflicts across docs, the source listed here wins.

## Scope

| Domain | Authoritative source |
|---|---|
| Agent-effort governance | `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md` |
| Worklog schema | `pheno-worklog-schema` v2.1 — 11-column `device:` enum |
| Config (Rust) | `KooshaPari/Configra` |
| Config (Python) | `pheno-config/` |
| Repo registry + disposition | `phenotype-registry/registry/disposition-index.json` |
| ADR index (2026-06-15) | `docs/adr/2026-06-15/INDEX.md` |
| 71-pillar refresh cadence | `docs/adr/2026-06-18/ADR-041-71-pillar-refresh-cadence.md` (weekly Mon 09:00 PDT) |
| v17 cycle-7 plan | `plans/2026-06-21-v17-71-pillar-cycle-7-p0.md` |
| v17 cycle-7 probe | `findings/2026-06-21-v17-cycle-7-probe.md` |
| v18 cycle-8 plan | `plans/2026-06-21-v18-71-pillar-cycle-8-p0.md` |
| v18 cycle-8 probe | `findings/2026-06-21-v18-cycle-8-probe.md` |
| Worktree orchestration | per ADR-018 PRCP — substrate work in `/private/tmp/<track>-<crate>-<date>`; this monorepo is the coordination hub only |
| **Forgecode memory stack (v21)** | `docs/adr/2026-06-23/ADR-096-forgecode-improvement.md` (locks supermemory + smfs + letta subconscious + cognee + mem0 fallback, routed by `MemoryScope`) |
| **`thegent-memory` v2 polyglot facade** | `thegent/docs/specs/memory/v2.md` (PR 2 SPEC, merged in `KooshaPari/thegent#1144`) |
| **`pheno-cdylib-bridge` C-ABI** | `thegent/docs/specs/cdylib-bridge/v1.md` (8 C symbols, `crate-type = ["cdylib"]`) |
| **Forgecode integration** | `KooshaPari/forgecode:feat/forge-pheno-memory-2026-06-23` → PR `tailcallhq/forgecode#3559` |
| **Forge plugin bundle** | `KooshaPari/pheno-forge-plugins` v0.1.0 (6 plugins + systemd target + scripts) |
| **Forge CLI smoke** | `KooshaPari/pheno-forge-smoke` v0.1.0 (loads bridge via libloading; 8/8 checks pass) |

## Precedence order

1. Executable config (workflows, `justfile`, `Cargo.toml`)
2. `*.md` governance files in this SSOT table
3. The L5 governance ADRs (ADR-023 and successors) override any substrate
   decision where the conflict is "should the agent be working on this" —
   effort-decision is L5; substrate decisions are L3/L4.
4. Anything else.

## Forgecode memory stack conventions (v21, locked per ADR-096)

### `MemoryScope` → adapter routing

| Scope | Adapter | Default endpoint |
|---|---|---|
| `Episodic` | supermemory (smfs filesystem) | `http://127.0.0.1:3030` |
| `Identity` | letta (subconscious blocks) | `http://127.0.0.1:8283` |
| `ProjectKnowledge` | cognee (knowledge graph) | stdio `cognee-mcp` |
| `Fallback` | mem0 | `http://127.0.0.1:8000` |

### Plugin lifecycle

- **Plugin pattern** (not skills) — shipped under `~/.forge/plugins/<name>/`, installed via `forge plugin install`
- **Per-machine systemd** — `pheno-forge-sidecars.target` brings up all 6 services at boot
- **macOS launchd fallback** — `pheno-forge-plugins/scripts/launch-sidecars.sh` for non-systemd environments

### C-ABI bridge symbol naming (pheno-cdylib-bridge)

| Symbol | Purpose |
|---|---|
| `pheno_bridge_version()` | Returns bridge version as `*const c_char` |
| `pheno_last_error()` | Returns last error message as `*const c_char` |
| `pheno_string_free(s)` | Frees a string returned by the bridge |
| `pheno_memory_new(provider)` | Constructs a memory provider; `*mut c_void` handle |
| `pheno_memory_store(h, scope, key, value)` | Stores a value; `i32` rc |
| `pheno_memory_recall(h, scope, query, &out)` | Recalls records; `i32` rc, `*mut c_char` out |
| `pheno_memory_forget(h, scope, key)` | Forgets a key; `i32` rc |
| `pheno_memory_free(h)` | Frees a memory provider handle |

Provider labels accepted by `pheno_memory_new`: `sm`, `letta`, `cognee`, `mem0`, `composite`.
Scope labels accepted on `store`/`recall`/`forget`: `episodic`, `identity`, `project_knowledge`, `fallback`.

### Coverage gate

Per ADR-040: **80% lib coverage** for `thegent-memory` v2 and `pheno-cdylib-bridge`. CI gate enforced via `pheno-ci-templates`.

Refs: ADR-096, ADR-097, ADR-098, ADR-099; specs at `thegent/docs/specs/memory/v2.md` and `thegent/docs/specs/cdylib-bridge/v1.md`.

## Updating this file

- Keep the table narrow and unambiguous.
- Cite the canonical file by path; do not duplicate content.
- Update via a governance commit referencing the change.

---

## Forgecode memory stack — Wave 2 conventions (added 2026-06-24, ADR-100)

### Alternative adapters (ADR-098, opt-in)

The 4 primary adapters (supermemory, letta, cognee, mem0) cover the locked scope routing. 3 alternative adapters exist as opt-in swaps via `CompositeAdapter::with_alternatives()`:

| Adapter | Niche | Default endpoint | Replaces primary |
|---|---|---|---|
| `GraphitiAdapter` | `ProjectKnowledge` | `http://127.0.0.1:8001` | cognee (bitemporal KG) |
| `HippoAdapter` | `Identity` | `http://127.0.0.1:8002` | letta (RAG + online learning) |
| `ZepAdapter` | `Episodic` | `http://127.0.0.1:8003` | supermemory (turn classification) |

mem0 fallback remains fixed (always `http://127.0.0.1:8000`) — it is the only path that does not have an alternative.

### CompositeAdapter builder API (ADR-098, ADR-096)

```rust
use thegent_memory::v2::{CompositeAdapter, MemoryProvider};

// Default routing (Wave 1)
let composite = CompositeAdapter::new(
    Box::new(SupermemoryAdapter::default_endpoint()),
    Box::new(LettaAdapter::default_endpoint()),
    Box::new(CogneeAdapter::default_endpoint(),
    Box::new(Mem0Adapter::default_endpoint()),
);

// With 1 swap (Identity -> hippo instead of letta)
let composite = CompositeAdapter::new(...)
    .swap_to_hippo(HippoAdapter::default_endpoint());

// With 2 swaps
let composite = CompositeAdapter::new(...)
    .swap_to_hippo(HippoAdapter::default_endpoint())
    .swap_to_graphiti(GraphitiAdapter::default_endpoint());
```

### Eval harness API (ADR-097, `forge_pheno_evals`)

```rust
use forge_pheno_evals::{EvalRunner, EpisodicRoundtrip, LatencyBudget, FixtureEntry};

// Mock-backed runner for unit tests (zero network)
let runner = EvalRunner::mock();

// Or backed by a real CompositeAdapter
let runner = EvalRunner::new(composite);

// Tasks built into the crate:
let task = EpisodicRoundtrip::new(vec![
    FixtureEntry { key: "a".into(), value: "alpha".into() },
    FixtureEntry { key: "b".into(), value: "beta".into() },
]);
let score = runner.run(&task).await?;  // EvalScore { score, passed, latency_ms, threshold }

let task = LatencyBudget { key: "k".into(), value: "v".into(), budget_ms: 100 };
let score = runner.run(&task).await?;  // binary hit/miss at the latency threshold
```

EvalScore fields: `task`, `scope`, `score: f32`, `stage_latency_ms`, `query_latency_ms`, `total_latency_ms`, `passed: bool`, `threshold: f32`. Threshold defaults to `0.7`; override via `EvalRunner::with_threshold(t)`.

### Sidecar stub API (ADR-100, `pheno-sidecar-stub`)

A single binary that mocks the HTTP surface of all 4 real memory engines so `pheno-forge-smoke --mode=sidecar` can run end-to-end without the real sidecars installed.

```bash
cd pheno-forge-smoke/sidecars
cargo build --release
./target/release/pheno-sidecar-stub --sidecar sm     --port 3030 &
./target/release/pheno-sidecar-stub --sidecar letta  --port 8283 &
./target/release/pheno-sidecar-stub --sidecar mem0   --port 8000 &
./target/release/pheno-sidecar-stub --sidecar cognee --port 9101 &
PHENO_BRIDGE_PATH=.../libpheno_bridge.dylib \
  ./target/release/pheno-forge-smoke --mode=sidecar
```

Routes implemented (must match the `thegent-memory` v2 adapter call shapes — drift is caught by the smoke):

| Sidecar | Method | Path | Body shape |
|---|---|---|---|
| supermemory | POST | `/v1/store` | `{container_tag, key, content}` |
| supermemory | POST | `/v1/search` | `{q, container_tag, limit}` |
| supermemory | DELETE | `/v1/store/:scope/:key` | empty |
| letta | POST | `/v1/agents/:id/archival-memory` | `{role, content}` |
| letta | POST | `/v1/agents/:id/archival-memory/search` | `{query, limit}` |
| letta | DELETE | `/v1/agents/:id/archival-memory/:key` | empty |
| mem0 | POST | `/v1/memories/` | `{user_id, messages, infer, metadata}` |
| mem0 | POST | `/v1/memories/search/` | `{user_id, query, limit}` |
| mem0 | DELETE | `/v1/memories/:id/` | empty |
| cognee | POST | `/memory/add` | `{data, dataset_name}` |
| cognee | POST | `/memory/search` | `{query, dataset_name}` |
| cognee | POST | `/memory/forget` | `{dataset_name, node_id}` |
| all | GET | `/health` | `{ok: true, store_size: N}` |

### Coverage gate (per ADR-040)

**80% lib coverage** is enforced for:

- `thegent-memory` v2 (currently 34 lib unit tests passing)
- `pheno-cdylib-bridge` (currently 4 Rust + 1 C smoke passing)
- `forge_pheno_memory` workspace crate (3 unit)
- `forge_pheno_evals` workspace crate (5 unit)
- `pheno-forge-smoke` (10 end-to-end across 2 modes)

CI gate: `pheno-ci-templates` template `crates-rust-80-coverage@v1`.

Refs: ADR-096, ADR-097, ADR-098, ADR-099, ADR-100; specs at `thegent/docs/specs/memory/v2.md`, `thegent/docs/specs/cdylib-bridge/v1.md`, `forgecode/crates/forge_pheno_evals/src/lib.rs`.

---

## Forgecode shell/terminal conventions — Wave 3 (added 2026-06-27, ADR-101/102)

### Shell detection API (forge_pheno_shell)

```rust
use forge_pheno_shell::{
    ShellKind, ShellFlavor, ShellEnv, ShellDetection,
    CompletionScript, ShellInstallPlan, InstallMode, InstallResult,
};

// Detect current shell from env + argv0
let env = ShellEnv::from_os();
let detection = ShellEnv::detect(&env, std::env::args().next());

// Generate completion script
let script = detection.completion_script().unwrap();
println!("{}", script.content());  // ZSH/Bash/Fish/PowerShell

// Generate install plan
let plan = detection.install_plan(InstallMode::User);
let result = plan.execute().unwrap();
```

Supported shells: ZSH, Bash, Fish, PowerShell (Windows), PowerShell Core (cross-platform), Nushell, Elvish, Tcsh, Cmd (Windows), WSL, Xonsh. Detection sources: FORGE_SHELL env var, argv0, PATH, $SHELL env, /proc/self/comm (Linux), GetConsoleProcessList (Windows).

### Windows Terminal API (forge_pheno_winterminal)

```rust
use forge_pheno_winterminal::{
    Profile, Scheme, Palette, Keybinding, TerminalConfig,
    WindTermError, install_profile, install_scheme, detect_winterminal,
};

// Detect Windows Terminal installation + version
let config = detect_winterminal().unwrap();

// Install a color scheme
let scheme = Scheme::new("Phenotype Dark", Palette::dark_theme());
scheme.install().unwrap();

// Install a profile with the scheme
let profile = Profile::new("ForgeCode Shell")
    .command("forge")
    .scheme(scheme.name())
    .font_size(14);
profile.install().unwrap();
```

profiles.json discovery: %LOCALAPPDATA%/Packages/Microsoft.WindowsTerminal_*/LocalState/settings.json, also %USERPROFILE%/.config/winterminal/settings.json. Palette supports 16-color ANSI + extended 256-color + truecolor formats.

### Ghostty IPC extension surface (PR 11, wave-3 surface)

```rust
// New operations added to ipc_request.rs/Operation enum:
// ShaderLint, FontList, Inspect

// forge_infra GhosttyControl shader_lint:
GhosttyControl::shader_lint("path/to/shader.glsl", "GLES300")?;  // -> LintReport

// forge_infra GhosttyControl font_list:
GhosttyControl::font_list()?;  // -> Vec<FontInfo>

// forge_infra GhosttyControl inspect:
GhosttyControl::inspect()?;    // -> Snapshot (window_titles, config_keys, active_panes)
```

### Coverage gate (per ADR-040, updated wave-3)

**80% lib coverage** enforced for:
- `forge_pheno_shell` (33 unit passing)
- `forge_pheno_winterminal` (7 unit passing)
- `forge_infra` ghostty shader/font/inspect methods (integration-tested via IPC)
- `ghostty-kit` zero-dep IPC request/response enums (each variant covered by doc-tests)

CI gate: `pheno-ci-templates` template `crates-rust-80-coverage@v1` (unchanged).

### Wave-3 audit score breakdown (124 items)

| Category | Items | Shipped | Remaining | % |
|---|---|---|---|---|
| A — Shell abstraction (kind detection, env resolution, flavor maps) | 12 | 12 | 0 | 100% |
| B — Windows Terminal (profiles.json, schemes, palettes, keybindings) | 32 | 32 | 0 | 100% |
| C — Ghostty depth (shader lint, font detection, config resolver, IPC) | 41 | 12 | 29 | 29% |
| D — Underlying tooling (tunnels, file watcher, discovery, WASM loader) | 39 | 0 | 39 | 0% |
| **Total** | **124** | **56** | **68** | **45.2%** |

### V23 closure metadata

| Field | Value |
|---|---|
| **Wave** | v23 — forgecode shell/terminal/Ghostty wave-3 |
| **Closed** | 2026-06-27 |
| **ADRs** | ADR-101 (audit), ADR-102 (closure), ADR-104 (wave-4 backlog) |
| **PRs** | PR #3586 (combined: shell + Windows Terminal + Ghostty against `tailcallhq/forgecode`) |
| **New crates** | `forge_pheno_shell`, `forge_pheno_winterminal`, `ghostty-kit` IPC extensions |
| **Cumulative tests** | 158 passed, 0 failed (118 baseline + 40 wave-3) |
| **Wave-4 follow-ups** | 68 items tracked in ADR-104 |
| **Attestation** | All governance docs (AGENTS.md, STATUS.md, SSOT.md) refreshed with v23 closure data |

Refs: ADR-101, ADR-102, ADR-104, PR #3586.
