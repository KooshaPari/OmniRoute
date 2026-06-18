# 00_START_HERE.md — FocalPoint Onboarding

> **Welcome to the FocalPoint repository.**

## What is FocalPoint?

A connector-first screen-time management platform. Native iOS enforcement built on a portable Rust core: rules engine, connector runtime, reward/penalty ledger, audit chain, mascot state machine.

## Quick Start

### Prerequisites

- **Rust** 1.82+ (see `rust-toolchain.toml`)
- **Xcode** 15.2+ (for iOS build)
- **macOS** (iOS development requires macOS)
- Clone adjacent repo: `PhenoObservability` (required by 11 crates via `../PhenoObservability` path-dep)

### Build the Rust Workspace

```bash
# Clone PhenoObservability adjacent (required)
git clone https://github.com/KooshaPari/PhenoObservability.git ../PhenoObservability

# Build the full workspace
cargo build --workspace

# Run tests
cargo test --workspace

# Lint and format
cargo clippy --workspace -- -D warnings
cargo fmt --check
```

### Build the iOS App

```bash
# Open the Xcode project
open apps/ios/FocalPoint/FocalPoint.xcodeproj

# In Xcode:
# 1. Select a simulator target (e.g., iPhone 16 Pro)
# 2. Build (Cmd+B)
# 3. Run (Cmd+R)
```

### Try the CLI

```bash
# Build the CLI
cargo build -p focus-cli --release

# Run the demo
./target/release/focus demo seed --db=/tmp/focus-demo.db
./target/release/focus tasks list --db=/tmp/focus-demo.db --json
```

## Repository Structure

```
crates/          Rust workspace — 67 crates (domain core + connectors + tooling)
apps/ios/        SwiftUI iOS app + FamilyControls + Spline mascot
apps/android/    Deferred beyond Phase 2 (placeholder)
services/        Optional backend — deferred to Phase 5 (placeholders)
docs/            Architecture, ADRs, connector SDK, ecosystem strategy
examples/        Sample rules + connector fixtures
scripts/         Demo walkthrough runner + CI utilities
```

## Key Documents

| Document | Purpose |
|----------|---------|
| [`AGENTS.md`](./AGENTS.md) | Agent governance and working conventions |
| [`CLAUDE.md`](./CLAUDE.md) | Claude-specific instructions (stack, commands, key files) |
| [`PRD.md`](./PRD.md) | Product requirements |
| [`ADR.md`](./ADR.md) | Architecture decisions index |
| [`FUNCTIONAL_REQUIREMENTS.md`](./FUNCTIONAL_REQUIREMENTS.md) | FR traceability matrix |
| [`PLAN.md`](./PLAN.md) | Phased roadmap |
| [`USER_JOURNEYS.md`](./USER_JOURNEYS.md) | Primary user flows |
| [`SPEC.md`](./SPEC.md) | System specification (implemented) |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release history |

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branch conventions, commit format, and PR expectations.

All non-trivial work must be tracked in **AgilePlus**:
```bash
cd /repos/AgilePlus && agileplus <command>
```

## Need Help?

- **Build issues:** Check `docs/reference/honest_coverage.md` for known errors
- **Design questions:** See `docs/adr/` for recorded decisions
- **Feature requests:** Open an issue with the `feature request` template
