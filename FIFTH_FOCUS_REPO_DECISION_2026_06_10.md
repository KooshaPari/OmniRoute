# Fifth Focus Repo Decision - 2026-06-10

## Scope

Evaluate fifth-focus candidates: PhenotypeAgents, Tracera, HeliosCLI, KWatch, Civis.

Evidence commands used: `ls`, `du`, `wc`, and `cat` against candidate roots, README files, and top-level build manifests.

## Scoring Model

Scores are 1-5, where 5 is best.

| Dimension | Meaning |
|---|---|
| Size | Smaller repo / lower local footprint is better for a fifth focus lane. |
| Ease | Simpler stack, fewer external services, and clearer local workflow are better. |
| Mac-target | Stronger macOS relevance or first-class Mac support is better. |
| Build status | Clearer documented build/test path and current work-state confidence are better. |

## Per-Candidate Scores

| Candidate | Observed size | Size | Ease | Mac-target | Build status | Total | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| PhenotypeAgents | Not found at `/Users/kooshapari/CodeProjects/Phenotype/repos/PhenotypeAgents` | 1 | 1 | 2 | 1 | 5 | Default candidate by instruction, but no exact repo path was present in the workspace during evaluation. Cannot verify README, manifest, or build path without the repo. |
| Tracera | 3.3G | 2 | 2 | 2 | 3 | 9 | Polyglot RTM/dashboard repo: Go backend, Python package, TypeScript/React/Turbo frontend, PostgreSQL, Redis, Bun. Work state shows 70% progress with build/security/policy badges, but stack and service dependencies make it heavier than ideal for a fifth focus lane. |
| HeliosCLI | 906M | 3 | 3 | 5 | 4 | 15 | Rust/TypeScript CLI with documented macOS 12+ support and macOS sandbox command path. Build path is explicit: `codex-rs cargo build`, `codex-cli npm run build`, plus fmt/clippy/tests. Strong Mac relevance, but it is substantial and already a high-complexity active lane. |
| KWatch | 158M | 5 | 5 | 4 | 4 | 18 | Small Go CLI/watch utility. Makefile documents `make build`, `make test`, `make build-all`, and cross-compiles `darwin-amd64` and `darwin-arm64`. Best immediate execution candidate if the default repo is unavailable. |
| Civis | 15G | 1 | 1 | 3 | 4 | 9 | Rust simulation platform with documented `cargo build --workspace`, `cargo test --workspace`, `just civis-3d-verify`, and local-first quality manifest flow. Build status is well documented, but repo size, breadth, and pre-MVP scope are too large for a fifth focus slot. |

## Recommendation

Primary recommendation: **PhenotypeAgents**, honoring the requested default, conditional on making the repo available at the expected workspace path or providing its actual path/name.

Actionable fallback: **KWatch**. It is the smallest and easiest candidate, has clear macOS build targets, and has the least coordination overhead for a fifth concurrent focus repo.

Do not pick Civis or Tracera for the fifth slot unless the goal is specifically to invest in large product-platform work. Do not pick HeliosCLI as the fifth slot unless the fifth focus should reinforce the existing Mac/agent tooling lane rather than diversify into a smaller, lower-risk repo.

