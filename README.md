> **Pinned references (Phenotype-org)**
> - MSRV: see rust-toolchain.toml
> - cargo-deny config: see deny.toml
> - cargo-audit: rustsec/audit-check@v2 weekly
> - Branch protection: 1 reviewer required, no force-push
> - Authority: phenotype-org-governance/SUPERSEDED.md

> **Work state:** ACTIVE · **Progress:** `█████████░ 85%`
> Connector-first screen-time platform: portable Rust core (rules/ledger/audit-chain) + native iOS shell. Phase 1 ~85% but WORKSPACE DOES NOT COMPILE since 2026-04-23 (5 crates, E-series errors) — blocked until fixed. · updated 2026-06-02

# FocalPoint

[![AI Slop Inside](https://sladge.net/badge.svg)](https://sladge.net)
[![Build](https://img.shields.io/github/actions/workflow/status/KooshaPari/FocalPoint/rust.yml?branch=main&label=build)](https://github.com/KooshaPari/FocalPoint/actions)
[![Release](https://img.shields.io/github/v/release/KooshaPari/FocalPoint?include_prereleases&sort=semver)](https://github.com/KooshaPari/FocalPoint/releases)
[![License](https://img.shields.io/github/license/KooshaPari/FocalPoint)](LICENSE)
[![Phenotype](https://img.shields.io/badge/Phenotype-org-blueviolet)](https://github.com/KooshaPari)

**Status:** v0.0.5 — Phase 1 in progress (~85%).
**✅ Builds green** — `cargo build --workspace` Finished (verified 2026-06-02). NOTE: 11 crates use a relative cross-repo path-dep on `phenotype-observably-macros`, so **clone [PhenoObservability](https://github.com/KooshaPari/PhenoObservability) adjacent** (`../PhenoObservability`) before building. (Earlier "compilation broken" status is resolved.)

Connector-first screen-time management platform. Native iOS enforcement built on a portable Rust core: rules engine, connector runtime, reward/penalty ledger, audit chain, mascot state machine.

**What's shipped:**
- ✅ Domain layer end-to-end: event sourcing, rules engine, wallet/penalty ledgers, audit chain (hash-chained, tamper-evident), task scheduling, rituals (Morning Brief + Evening Shutdown)
- ✅ iOS shell: SwiftUI views, FamilyControls integration (awaiting entitlement approval), rule authoring wizard, Canvas OAuth
- ✅ 17 crates + 80+ passing tests (when workspace compiles)
- ✅ Multi-platform FFI (UniFFI Rust → Swift; JNI stubs for Android future)

**Honest gaps blocking production:**
- ❌ **Workspace compilation:** backup (E0505 borrow-check), rituals (E0277 Eq on f32), 3× connectors (type errors)
- ❌ **Apple entitlement:** FamilyControls driver logic shipped but gated behind `#if FOCALPOINT_HAS_FAMILYCONTROLS` flag. Awaiting Apple review (submitted Phase 0, 1–4 week SLA).
- ❌ **Onboarding UX:** 0 screens shipped. Users cannot self-serve setup today.
- ❌ **Designer assets:** Coachy 3D animation (`.riv` Rive file); SwiftUI placeholder in use.
- ❌ **Real-device QA:** simulator only; entitlement approval required for real testing.
- ❌ **GCal/GitHub OAuth:** buttons exist, flows incomplete.

**See [roadmap_v2.md](docs/roadmap_v2.md) for phased plan (6 phases, honest effort estimates, dependencies, and known deviations from earlier claims).**

## Feature Status at a Glance

| Feature | Status | Details |
|---------|--------|---------|
| **Domain: Events** | [SHIPPED] | SHA256-chained deduping, 9+ event sources, schema v3 |
| **Domain: Rules engine** | [SHIPPED] | 12 condition primitives, 6 actions, schedule triggers, cooldowns, explainability |
| **Domain: Wallet** | [SHIPPED] | +/-Credit mutations, balance caps, audit trail on every change |
| **Domain: Penalties** | [SHIPPED] | Lockout windows, rigidity spectrum (Hard/Semi/Soft), debt tracking, escalation |
| **Domain: Audit chain** | [SHIPPED] | Hash-chained tamper-evident records; verification on startup |
| **Domain: Task scheduling** | [SHIPPED] | Rigidity-aware bin-packing, working-hours constraints, chunk splitting, 14 tests |
| **Domain: Calendar integration** | [SHIPPED] | Async trait + mock; GCal OAuth scaffold, EventKit real adapter (iOS) |
| **Domain: Rituals** | [SHIPPED] | Morning Brief (schedule-derived + LLM-coached), Evening Shutdown (task classification + streak); 15 tests |
| **iOS: App shell** | [SHIPPED] | SwiftUI skeleton, 5 tabs (Home, Tasks, Rules, Activity, Settings) |
| **iOS: Rule authoring** | [SHIPPED] | 4-step wizard (When/If/Then/Settings), JSON preview, DSL catalog |
| **iOS: Canvas OAuth** | [SHIPPED] | ASWebAuthenticationSession, keychain persistence, sync heartbeat |
| **iOS: GCal OAuth** | [SCAFFOLD] | Button present, flow incomplete |
| **iOS: GitHub OAuth** | [SCAFFOLD] | Button present, flow incomplete |
| **iOS: Onboarding** | [SCAFFOLD] | Canvas button only; no user-facing setup flow |
| **iOS: FamilyControls driver** | [SCAFFOLD] | ManagedSettingsStore + DeviceActivityCenter wired behind `#if FOCALPOINT_HAS_FAMILYCONTROLS` flag; awaiting entitlement approval |
| **iOS: Coachy mascot** | [PARTIAL] | SwiftUI render shipped; `.riv` Rive animation pending designer |
| **Connectors: Canvas** | [SHIPPED] | OAuth2, 4 event types, 44 wiremock tests, live-API test scaffold |
| **Connectors: GCal** | [SCAFFOLD] | OAuth2 scaffold, event list WIP |
| **Connectors: GitHub** | [SCAFFOLD] | Auth scaffold, event mapping pending |
| **Connectors: Readwise, Notion, Linear** | [SCAFFOLD] | Event mapping stubs only |
| **Backup & restore** | [SCAFFOLD] | age encryption + passphrase, CLI built; iOS FFI has E0505 borrow-check error |
| **Builder (web task editor)** | [SHIPPED] | 12 ReactFlow node types, Coachy preview, dist/ builds (not integrated to iOS) |
| **Ecosystem: Connector manifest** | [SHIPPED] | TOML format, tier system (Official/Verified/MCPBridged/Private) |
| **Ecosystem: Webhook registry** | [SHIPPED] | Signature verification, handler dispatch, 5 tests |
| **Ecosystem: Template pack format** | [SHIPPED] | ed25519 signing, TOML round-trip, deterministic UUID derivation |
| **Ecosystem: MCP-bridged connectors** | [SCAFFOLD] | Type defined, transport pending |
| **Ecosystem: Marketplace catalog** | [SHIPPED] | ConnectorRegistry, tier-ordered, deduped listings |
| **Ecosystem: Visual rule builder** | [SHIPPED] | iOS Rule Wizard shipped; web-hosted builder has all primitives to consume |
| **Backend: Services** | [SCAFFOLD] | auth-broker, webhook-ingest, sync-api placeholders only |
| **Backend: Sentry integration** | [SHIPPED] | SDK integrated, live monitoring pending real deploy |
| **Backend: Release notes gen** | [SHIPPED] | markdown + Discord format generators, tested |
| **Docs: ADRs** | [SHIPPED] | 9 decisions logged (stack, architecture, privacy, connectors, auth) |
| **Docs: Connector SDK** | [SHIPPED] | Manifest spec, trait contract, example walkthrough |
| **Docs: Design docs** | [SHIPPED] | Multi-device CRDT sync, Watch companion, Coachy art direction, connector ecosystem strategy |
| **Docs: RFC process** | [SHIPPED] | RFC-0001 plugin SDK, RFC-0002 template format |
| **i18n: Translations** | [SHIPPED] | Spanish + Japanese (122 strings), Localizable.xcstrings extracted |
| **CI: Linting** | [SHIPPED] | Clippy green, Vale markdown checks, commit-msg validator |
| **CI: Testing** | [SHIPPED] | 80+ unit tests, 44 Canvas wiremock tests, ritual integration tests, sync cursor persistence |
| **CI: Security** | [PARTIAL] | Audit chain tamper-detection tested; external security audit pending |

## Primary differentiators

- **Connector runtime** treats Canvas LMS, calendars, tasks, health apps as
  first-class behavioral inputs. Ecosystem is the compounding moat, not blocking.
- **Rules engine** with explainable decisions, cooldowns, and state snapshots.
- **Reward/penalty dual-ledger** with escalation tiers, streaks, bypass budgets.
- **Portable Rust core** exported to iOS (Swift via UniFFI) + Android (Kotlin via JNI).

## Try it now

The `focus` CLI is ready for exploration. Walk through the end-to-end workflow:

```bash
# 3-command quickstart
cargo build -p focus-cli --release
./target/release/focus demo seed --db=/tmp/focus-demo.db
./target/release/focus tasks list --db=/tmp/focus-demo.db --json
```

For a full automated walkthrough with transcript, see [CLI Demo](docs-site/guides/cli_demo.md) or run:

```bash
task demo
```

This exercises all major subcommands (audit, tasks, rules, wallet, sync, eval, focus sessions, templates) and generates a markdown report.

## Repo structure

```
crates/          Rust workspace — 17 crate stubs (domain core + mascot)
apps/ios/        SwiftUI + FamilyControls/ManagedSettings + Spline mascot
apps/android/    Deferred beyond Phase 2 (placeholder)
services/        Optional backend — deferred to Phase 5 (placeholders)
docs/            Architecture, ADRs, connector SDK, ecosystem strategy
examples/        Sample rules + connector fixtures
scripts/         Demo walkthrough runner + CI utilities
```

## Spec docs

- [`PRD.md`](PRD.md) — product requirements
- [`ADR.md`](ADR.md) — architecture decisions index
- [`FUNCTIONAL_REQUIREMENTS.md`](FUNCTIONAL_REQUIREMENTS.md) — FR-CONN/EVT/RULE/STATE/ENF/DATA/UX
- [`PLAN.md`](PLAN.md) — phased roadmap
- [`USER_JOURNEYS.md`](USER_JOURNEYS.md) — primary flows
- [`00_START_HERE.md`](00_START_HERE.md) — onboarding

## Build & Test Status

**⚠️ Workspace does not currently compile.** See [honest_coverage.md](docs/reference/honest_coverage.md) for error details (5 crates with E-series errors pending fix).

When compilation is repaired:

```bash
cargo build --workspace
cargo test --workspace      # ~80 tests pass
cargo clippy --workspace -- -D warnings  # green after repair
cargo fmt --check
```

**iOS build:** SwiftUI compiles; requires Xcode 15.2+, iOS 16+ deployment target.
**Android build:** JNI bindings scaffolded; no Gradle integration yet.

## Stack

- **Rust** (1.82, edition 2021) — shared core (will bind to Android later)
- **Swift 5.9+ / SwiftUI** — iOS 16+; FamilyControls entitlement required
- **SQLite** — local-first persistence
- **UniFFI** — Rust↔Swift bindings
- **Spline** — iOS mascot animation runtime (`crates/focus-mascot` + `apps/ios/Mascot/`)

Android Kotlin/Compose support reserved in `apps/android/` but deferred
beyond Phase 2. Cross-native frameworks (Tauri / RN / Flutter) rejected
per ADR-001.

See [`ADR.md`](ADR.md) for the full decision log.

## Status & Planning

- **[roadmap_v2.md](docs/roadmap_v2.md)** — Honest 6-phase roadmap with effort estimates, dependencies, and known gaps
- **[honest_coverage.md](docs/reference/honest_coverage.md)** — Feature-by-feature audit (shipped vs scaffold vs partial vs external-blocked)
- **[open_questions.md](docs/research/open_questions.md)** — Tracked unknowns that may impact Phase 1.5+ timing

## License

MIT OR Apache-2.0.
