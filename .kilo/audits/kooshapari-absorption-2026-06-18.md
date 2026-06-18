# KooshaPari Source-Repo Absorption & Deletion-Justification Audit

**Audit date:** 2026-06-18
**Auditor:** Kilo (cloud agent)
**Source repos in scope:** `dagctl`, `kwality`, `phenotype-auth-ts`, `dinoforge-packs`, `Logify`, `Configra`
**Discovered targets (GitHub-discovery confirmed):** `phenodag`, `phenotype-tooling`, `TestingKit`, `Benchora`, `Tracera`, `AuthKit`, `phenoShared`, `Conft`, `Dino`, `phenotype-registry`, `PhenoSpecs`

> All evidence below is taken from local shallow clones under `/tmp/agent_141fabd5-90ee-4825-869d-faba02e3d212/repos` and from GitHub API / web search responses. Public 404s for `Configra` and `Logify` are recorded as `NOT_FOUND` and excluded from deletion-justification.

---

## 1. EXECUTIVE_DECISION

| Source repo | Decision | Confidence | One-paragraph rationale |
|---|---|---|---|
| `KooshaPari/dagctl` | **DELETE_AFTER_PATCHES** | high | Source `README.md` says "SUPERSEDED — dagctl capabilities merged into phenodag"; `phenodag/docs/dagctl-merge-status.md` records `sd-dagctl-01..05` as Done; `phenodag/docs/adr/ADR-dag-superset-merge.md` (Accepted) confirms the union. Every meaningful dagctl capability (`internal/remoteclaim`, v3 commands, operational/meta/visualization/dedup commands, HTML template) is in `phenodag` `main` or queued for `v1.0.0-rc.1`. Only the GitHub archive action and final `v3.3.x` tag are open. |
| `KooshaPari/kwality` | **DELETE_AFTER_PATCHES** | low | Repo is archived but carries the explicit `STRICTLY DO NOT DELETE NOR UNARCHIVE` user promise. Current tooling has no parity for LLM validation, DeepEval/Playwright/Neo4j stacks, multi-tenant Go validation server, or Rust runtime validator. The closest "better" target is `phenotype-tooling` `quality-gate` + `bench-guard` + `legacy-scan` + `fr-trace` (mostly stubs) and `TestingKit` Rust workspace (no LLM validation). The Go/Rust code, k8s manifests, monitor configs, ADRs, and supply-chain CI branches in `kwality` are not represented. Recommend extraction of branch-only ADRs/SBOM/SLSA into `phenotype-tooling` and moving the rest into an archive-only state, not deletion. |
| `KooshaPari/phenotype-auth-ts` | **DELETE_AFTER_PATCHES** | medium | `ARCHIVED.md` states the source is migrated to `libs/auth-ts` as a neutral TS OAuth2/OIDC library, but no public `KooshaPari/libs` or `KooshaPari/auth-ts` repo exists (GitHub API 404). `AuthKit` is a pre-extraction staging repo that does **not** yet contain an auth SDK. The TS source is minimal (Token, Claims, ports, `MemoryTokenStore`, `PlaceholderJwtVerifier`); most README features (OAuth, OIDC, API key, WebAuthn, cross-runtime) are unimplemented. Vitest tests pass for what is implemented. Recommend extracting the working core into a new `phenotype-shared`/`phenoShared` TS package and archiving the source. |
| `KooshaPari/dinoforge-packs` | **PRESERVE** | high | Packs are content artifacts (units, factions, buildings, doctrines, weapons, waves) for the active `Dino` DINOForge framework. `Dino` does not currently host a community packs folder. README explicitly says "inactive but still mutable" and "not archived". Manifest references asset paths that do not exist; `warfare-starwars` ids do not match actual YAML ids. Preservation as `Dino/community-packs/` subtree + a manifest-reconciliation PR is the safe action. |
| `KooshaPari/Configra` | **NOT_FOUND** | high | Public GitHub returns 404 for both `KooshaPari/Configra` and `kooshapari/Configra`; `FocalPoint#130` confirms "Configra: confirmed phantom (404)". Out of scope for deletion-justification. Any remaining `Configra` work is covered by `Conft` and `phenoShared` config crates. |
| `KooshaPari/Logify` | **NOT_FOUND** | high | Public GitHub returns 404 for `KooshaPari/Logify`; no relevant public repo exists. Out of scope; cannot recommend any action without a reachable source. |

**Overall recommendation:** `DELETE_AFTER_PATCHES` for `dagctl`, `kwality`, `phenotype-auth-ts`; `PRESERVE` (with merge action) for `dinoforge-packs`; `NOT_FOUND` (no action) for `Configra` and `Logify`.

---

## 2. SOURCE_INVENTORY

### 2.1 `KooshaPari/dagctl`
- **Default branch:** `main` @ `2c8ef50`; **tags:** `v3.3.0` @ `966159e`.
- **Code:** 10 Go files in repo root (`dagctl.go`, `dagctl_v3_seed.go`, `dagctl_v3_extend2.go`, `dagctl_v3_extend3.go`, `dagctl_extras.go`, `dagctl_viz2.go`, `dagctl_dedup2.go`, `dagctl_meta2.go`, `dagctl_test2.go`, `dagctl_remote_claim.go`) + `internal/remoteclaim/{types,store,sqlite,local,github,flock}.go` + `dagctl_dag_template.html`.
- **Tests:** `internal/remoteclaim/remoteclaim_test.go`. No CI workflows in repo.
- **Docs:** `README.md` only (152 lines). No `docs/`, ADRs, or charters.
- **Status:** Implemented CLI; `README.md` says "SUPERSEDED — dagctl capabilities merged into phenodag"; `extend3-v3` is defined in code but not wired into the command map.

### 2.2 `KooshaPari/kwality`
- **Default branch:** `main` @ `7055f97`; **tags:** `v1.0.0` @ `a6072bb`. **Refs:** 31 branches.
- **Code (Go):** `cmd/kwality/main.go`, `cmd/kwality-cli/main.go`, `internal/server/gin_server.go`, `internal/handlers/*`, `internal/database/database.go`, `internal/orchestrator/orchestrator.go`, `internal/validation/*`, `internal/engines/static_analysis.go`, `internal/config/config.go`.
- **Code (Rust):** `engines/runtime-validator/{Cargo.toml, src/{lib,container,fuzzing,metrics,performance,security,validation}.rs}`.
- **Tests:** `tests/integration/{validation_pipeline_test.go,runtime_validator_test.go}`, `python-tests/examples/test_llm_validation_tdd.py`.
- **Deployment/ops:** `Dockerfile`, `docker-compose.yml`, `docker-compose.kwality.yml`, `docker-compose.production.yml`, `k8s/kwality-deployment*.yaml`, `nginx/kwality-nginx.conf`, `monitoring/openllmetry-config.yml`.
- **Docs:** `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `FUNCTIONAL_REQUIREMENTS.md`, `docs/*`, `SPEC.md`, `PRD.md`, `SOTA.md`.
- **State/data:** `.hive-mind/*.db*`, `memory/{backups,data}/*.json`, checked-in `bin/kwality` and `bin/kwality-cli`.
- **CI:** 9 workflows (CI, CI/CD, CI/CD production, trufflehog, quality-gate, doc-links, fr-coverage, legacy-tooling-gate, dependabot, release-drafter).
- **Status:** Repo is archived; README carries `STRICTLY DO NOT DELETE NOR UNARCHIVE - Personal Project - LLM validation platform`. Default branch is Go/Rust; `v1.0.0` was JS/TS/Node (now deleted). Many docker-compose references to missing files; `auth.go` returns 501 on refresh; `runtime_validator_test.go` schema-mismatch fixes live on a non-default branch.

### 2.3 `KooshaPari/phenotype-auth-ts`
- **Default branch:** `main` @ `7b6b4a8`. **Refs:** 19 branches. **Tags:** none.
- **Code (TS):** `src/domain/{token,claims,errors}.ts`, `src/ports/index.ts`, `src/adapters/{memory-token-store,jwt-provider}.ts`, `src/index.ts`. No `src/application/`, no `src/adapters/jwt/`, no `src/adapters/oauth/`, no `src/adapters/oidc/`, no `src/adapters/webauthn/`, no `src/adapters/apiKey/`.
- **Tests:** `tests/core.test.ts`, `tests/token.contract.test.ts`, `tests/phenotype-ts-utils.test.ts` (33 passing).
- **Docs:** `README.md`, `docs/index.md`, `docs/getting-started.md`, `docs/.vitepress/*`, `adr/ADR-001-architecture.md`, `ARCHIVED.md`.
- **Manifests/CI:** `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `Taskfile.yml`, `renovate.json5`, `.nvmrc`; 9 CI workflows.
- **Status:** `ARCHIVED.md` says migrated to `libs/auth-ts` as neutral `auth-ts` package. README and ADR promise OAuth2/OIDC/API key/WebAuthn/jose/cross-runtime, but the actual code is only Token/Claims/Ports/`PlaceholderJwtVerifier` (always rejects) + `MemoryTokenStore`. Docs usage example imports wrong path and wrong store method signature.

### 2.4 `KooshaPari/dinoforge-packs`
- **Default branch:** `main` @ `65573c7`. **Refs:** 21 branches. **Tags:** none.
- **Content:** `example-balance/{pack.yaml, units/militia.yaml, factions/defenders.yaml, buildings/barracks.yaml, stats/melee-buff.yaml}` and `warfare-starwars/{pack.yaml, manifest.yaml, units/{clone-trooper,republic_units,cis_units}.yaml, factions/{republic,cis}.yaml, buildings/{republic_buildings,cis_buildings}.yaml, doctrines/{republic_doctrines,cis_doctrines}.yaml, weapons/blasters.yaml, waves/clone_wars_waves.yaml}`.
- **Tests:** `tests/smoke_test.go`.
- **Docs:** `README.md`, `docs/operations/{journey-traceability.md,iconography/SPEC.md}`, `docs/journeys/manifests/README.md`, `docs/sessions/20260428-taskfile-dinoforge-packs/*`, `docs/worklogs/README.md`.
- **CI:** 7 workflows; quality-gate/fr-coverage/doc-links are echo stubs.
- **Status:** Inactive but not archived. `manifest.yaml` references `arc-trooper`, `at-te`, `clone-gunship`, `b1-battle-droid`, `b2-super-battle-droid`, `droideka`, `hailfire-droid` ids and `assets/textures/republic_icon.png`, `assets/textures/cis_icon.png`, `assets/audio/clone_wars_theme.ogg` that do not exist.

### 2.5 `KooshaPari/Configra`
- **Public GitHub API:** 404 (both `KooshaPari/Configra` and `kooshapari/Configra`).
- **`FocalPoint#130` evidence:** "Configra: confirmed phantom (404). `pheno-context` is request-context (not config), excluded."
- **No branches, no tags, no code, no docs.**

### 2.6 `KooshaPari/Logify`
- **Public GitHub API:** 404.
- **No branches, no tags, no code, no docs.**

---

## 3. BRANCH_INVENTORY

### 3.1 `dagctl.git` (mirror)
- **Local heads:** 1 (`main`). **Remote heads:** 0. **Tags:** `v3.3.0`.
- **No non-default branches. No branch-only work to preserve.**

### 3.2 `kwality.git` (mirror)
- **Local heads:** 31. **Remote heads:** 0. **Tags:** `v1.0.0`.
- **Non-default branches by class:**
  - **Materially different, code:** `fix/integration-test-schema-missing-fields` (schema-alignment between Go tests and Rust validator), `chore/e2e-2026-06-16` (E2E smoke + workflow), `cursor/project-configuration-issues-5728`, `cursor/committed-debugging-notes-cleanup-2d7b`, `chore/kwality-safe-audit-normalization`, `chore/20260430-pin-checkout-actions`, `ci/add-golangci-lint`, `chore/workflow-hygiene-ubuntu-24` (contains 5 Rust `target/` artifacts).
  - **Materially different, governance/audit:** `chore/decisions-2026-06-16` (ADR scaffold), `chore/retention-2026-06-16` (data retention policy), `chore/slos-2026-06-16` (SLOs), `chore/threat-model-2026-06-16` (STRIDE model).
  - **Materially different, supply-chain CI:** `chore/sbom-2026-06-16` (CycloneDX SBOM), `chore/provenance-metadata-2026-06-16` (attest-build-provenance), `chore/verify-attest-2026-06-16` (SLSA verify), `chore/slsa-build-2026-06-16` (SLSA build).
  - **Superseded:** `chore/pin-github-actions-*`, `chore/gov-bootstrap-2026-05-02`, `chore/bootstrap-deny-toml-2026-05-04`, all `dependabot/*` branches.
  - **Abandoned:** `chore/dinoforge-packs-local-snapshot-20260608` / `ci/fix-trufflehog-actions-rot` / `snapshot-2026-06-07` share tip `0dc8cfb` (only `kwality` mirror anomaly: these are kwality-local).

### 3.3 `phenotype-auth-ts.git` (mirror)
- **Local heads:** 19. **Remote heads:** 0. **Tags:** none.
- **Non-default branches by class:**
  - **Materially different:** `chore/docs/standardize-20260402` (governance scaffold, 65 files).
  - **Superseded:** `bootstrap/pr-template`, `chore/deps-high-sweep`, `chore/hygiene-pr-template`, `chore/pin-actions-sha`, `chore/trufflehog-auth-ts`, `feat/journey-impl`, `feat/phenotype-ts-utils-adopt-2026-06-12` (already on main), all `dependabot/*` branches.
  - **Merged:** `chore/populate-empty-hygiene-files`, `ci/sonar-advisory`.
  - **Abandoned:** `temp-branch` (duplicate tip `bc31c1a` with `chore/trufflehog-auth-ts`), `wip/devclone-rescue-phenotype-auth-ts-20260601` (Sonar rescue config).

### 3.4 `dinoforge-packs.git` (mirror)
- **Local heads:** 21. **Remote heads:** 0. **Tags:** none.
- **Non-default branches by class:**
  - **Materially different:** `ci/pin-trufflehog` (TruffleHog replacement), `cursor/trufflehog-setup-go-action-af33` (setup-go pin), `hygiene/preserve-canonical-20260605` (CODEOWNERS + SECURITY).
  - **Superseded:** `chore/changelog-stub`, `chore/pre-commit-bootstrap`, `chore/workflow-hygiene-20260606-dinoforge-packs`, `chore/gov-bootstrap-20260502`, `chore/pin-github-actions-20260430`, `hygiene/trufflehog-sha-pin-20260605`, `cursor/trufflehog-identical-commits-7fe1`, `feat/journey-impl`, `issue-templates/bootstrap`, `dependabot/*`, `chore/pin-actions` (merged).
  - **Merged:** `chore/pin-actions`, `codex/dinoforge-packs-worklog-agents`.
  - **Abandoned:** `chore/dinoforge-packs-local-snapshot-20260608`, `ci/fix-trufflehog-actions-rot`, `snapshot-2026-06-07` (all share tip `0dc8cfb`).

---

## 4. TARGET_PARITY_SUMMARY

| Target | Repo | Owns | Evidence |
|---|---|---|---|
| `phenodag` | `KooshaPari/phenodag` | Superset DAG CLI that absorbs `dagctl`; SQLite + modernc.org/sqlite, POSIX flock, `internal/remoteclaim`, v3 commands, 38+ commands, YAML presets, 5 presets. | `phenodag/README.md:1-141`, `phenodag/docs/adr/ADR-dag-superset-merge.md` (Accepted, "retire nothing"), `phenodag/docs/dagctl-merge-status.md` (sd-dagctl-01..05 Done, except `sd-dagctl-04` v1.0.0-rc.1 release and `sd-dagctl-05` GitHub archive). |
| `phenotype-tooling` | `KooshaPari/phenotype-tooling` | Consolidated Rust workspace of CLIs: `quality-gate`, `bench-guard`, `fr-trace`, `legacy-scan`, `docs-health`, `dag-scheduler`, `acceptance-contract`, `agent-orchestrator`, `agent-forecast`, `temporal-grounding`, `worktree-manager`, `phenotype-resilience`, `phenotype-service-registry`, `phenotype-diff`, `sbom-gen`, `release-cut`, `fr-coverage`, `doc-link-check`, `commit-msg-check`, `audit-privacy`, `fuzz-setup`, `anthropic-usage-poll`. Most are stubs (TODO placeholders). | `phenotype-tooling/Cargo.toml:1-55`, `phenotype-tooling/crates/quality-gate/src/main.rs` (3 TODO lines), `phenotype-tooling/crates/fr-trace/src/main.rs` (4 TODO lines), `phenotype-tooling/crates/bench-guard/src/main.rs` (real impl + 9 tests). |
| `TestingKit` | `KooshaPari/TestingKit` | Rust test-utilities workspace: `phenotype-testing`, `phenotype-mock`, `phenotype-test-fixtures`, `phenotype-test-infra`, `phenotype-compliance-scanner`, `phenotype-bdd`. Python submodules are empty. | `TestingKit/README.md:1-129`, `TestingKit/rust/phenotype-compliance-scanner/src/lib.rs`. |
| `Benchora` | `KooshaPari/Benchora` | Rust benchmarking framework (`gauge`) — 30% pre-1.0 scaffold. | `Benchora/README.md:1-89`, `Benchora/SPEC.md`. |
| `Tracera` | `KooshaPari/Tracera` | Agent-native requirements traceability (Go backend, Python matrix, router CRUD, scorer) with comprehensive Playwright/Go/Vitest/pytest validation pipeline. | `Tracera/.github/workflows/test-validation.yml:1-220+`, `Tracera/backend/tests/validation_test.go:1-220+`. |
| `AuthKit` | `KooshaPari/AuthKit` | Pre-extraction staging repo: 5 Rust crates (`phenotype-bid`, `phenotype-content-hash`, `phenotype-contracts`, `phenotype-policy-engine`, `phenotype-security-aggregator`); SPEC/PRD describe OAuth2/OIDC/SAML/WebAuthn/RBAC/ABAC, but **no auth SDK code is checked in**. | `AuthKit/README.md:1-80`, `AuthKit/docs/SPEC.md:1-260+`. |
| `phenoShared` | `KooshaPari/phenoShared` | Rust infrastructure toolkit: `phenotype-domain`, `phenotype-application`, `phenotype-port-interfaces`, `phenotype-contracts`, `phenotype-event-sourcing`, `phenotype-cache-adapter`, `phenotype-policy-engine`, `phenotype-state-machine`, **`phenotype-config-core`**, **`phenotype-config-loader`**, `phenotype-error-core`, `phenotype-health`, `phenotype-postgres-adapter`, `phenotype-redis-adapter`, `phenotype-http-adapter`, `phenotype-http-client-core`, `ffi_utils`. | `phenoShared/crates/phenotype-config-core/{Cargo.toml, src/lib.rs}`, `phenoShared/crates/phenotype-config-loader/{Cargo.toml, src/lib.rs}`. |
| `Conft` | `KooshaPari/Conft` | Rust `configkit` at `rust/phenotype-config/` + TS `@phenotype/config-ts` at `typescript/packages/conft/` (layered config, file/env/CLI precedence, TOML/YAML/JSON/ENV, schema validation, hot reload, env profiles, secrets). README status: maintenance, work-state alpha. | `Conft/README.md:1-121`, `Conft/typescript/packages/conft/src/{index.ts, domain/config.ts, ports/config-source.ts, adapters/{file-adapter,env-adapter}.ts}`. |
| `Dino` | `KooshaPari/Dino` | C# DINOForge general-purpose mod platform (Unity/BepInEx Mono CLR), registries, schemas, pack compiler, MCP server. Does not currently host a community packs folder. | `Dino/README.md`, `Dino/schemas/pack-manifest.schema.json`, `Dino/schemas/unit.schema.yaml`. |
| `phenotype-registry` | `KooshaPari/phenotype-registry` | Ecosystem index (`ECOSYSTEM_MAP.md`) + PhenoSpecs/PhenoHandbook/phenotype-org-governance spine links. PhenoSpecs `registry.yaml` is stale (last updated 2026-04-04). | `phenotype-registry/README.md` (GitHub). |
| `libs/auth-ts` (implied target from `ARCHIVED.md`) | 404 | Public `KooshaPari/libs` and `KooshaPari/auth-ts` repos do not exist on GitHub. | GitHub API 404. |

---

## 5. ABSORPTION_MATRIX

| Source Item | Source Evidence | Category | Source State | Target Repo | Target Evidence | Status | Deletion Justification | Risk if Deleted | Required Action |
|---|---|---|---|---|---|---|---|---|---|
| dagctl README "SUPERSEDED" banner | `dagctl/README.md:23` | Docs | implemented | `phenodag` | `phenodag/docs/dagctl-merge-status.md:1-74` | DONE | Banner already published; archive completes the redirect. | low | none |
| `internal/remoteclaim/*` (6 files) | `dagctl/internal/remoteclaim/{types,store,sqlite,local,github,flock}.go` | Code | implemented | `phenodag` | `phenodag/internal/remoteclaim/*.go` (same 6 files) | SUPERSEDED_PARITY | phenodag `main` contains a verbatim port per `ADR-dag-superset-merge.md:108-113`. | low | none |
| `internal/remoteclaim/remoteclaim_test.go` | source: `internal/remoteclaim/remoteclaim_test.go` | Tests | implemented | `phenodag` | `phenodag/internal/remoteclaim/remoteclaim_test.go` (ported) | SUPERSEDED_PARITY | Identical test names and assertions ported. | low | none |
| v3 engine (`seed3`, `extend3-v2`) | `dagctl/dagctl_v3_seed.go`, `dagctl/dagctl_v3_extend2.go` | Code | implemented | `phenodag` | `phenodag/phenodag_v3.go`, `phenodag/cmd/legacy_dagctl/` | SUPERSEDED_PARITY | `phenodag/docs/dagctl-merge-status.md:32-37` lists `seed3`/`extend3-v2`/`extend3-v3` as merged. | low | none |
| `extend3-v3` (defined but unwired) | `dagctl/dagctl_v3_extend3.go` (`cmdExtend3V3`) | Code | scaffold | `phenodag` | absent in `phenodag/cmd/` | NOT_COVERED | `cmdExtend3V3` is not wired into `dagctl.go` command map; `phenodag` also lacks a `extend3-v3` shim. | medium | patch `phenodag` to alias `extend3-v3` → `extend3-v2` (per ADR Phase 4) before archiving dagctl. |
| Operational commands (doctor, thrash, sweep, dispatch) | `dagctl/dagctl_test2.go` | Code | implemented | `phenodag` | `phenodag/phenodag_extras.go` | SUPERSEDED_PARITY | Listed in `dagctl-merge-status.md:38`. | low | none |
| Meta commands (worktree-claim, agent-stats, diff, critical-path) | `dagctl/dagctl_meta2.go` | Code | implemented | `phenodag` | `phenodag/phenodag_extras.go` | SUPERSEDED_PARITY | Listed in `dagctl-merge-status.md:37`. | low | none |
| Viz (gantt, mermaid, burndown, dashboard, csv, html) | `dagctl/dagctl_viz2.go`, `dagctl/dagctl_extras.go` | Code | implemented | `phenodag` | `phenodag/phenodag_extras.go`, `phenodag_dedup2.go` | SUPERSEDED_PARITY | Listed in `dagctl-merge-status.md:39-40`. | low | none |
| Task ops (add, merge, next, where, topo, promote, completion) | `dagctl/dagctl.go`, `dagctl_extras.go` | Code | implemented | `phenodag` | `phenodag/phenodag_extras.go` | SUPERSEDED_PARITY | Listed in `dagctl-merge-status.md:41`. | low | none |
| HTML template `dagctl_dag_template.html` | `dagctl/dagctl_dag_template.html` | Asset | implemented | `phenodag` | `phenodag/dagctl_dag_template.html` (present) | DONE | Asset copied per `dagctl-merge-status.md:42`. | low | none |
| `seed-requirements` (FR/NFR catalog) | `dagctl/dagctl.go` (command present) | Code | implemented | none active | `phenodag` lists it as deferred to Tracera Phase 4 (`dagctl-merge-status.md:49`) | NOT_COVERED | Tracera-specific; no `phenodag` consumer. | medium | preserve `seed-requirements` in `phenodag/cmd/legacy_dagctl/` until Tracera consumes it. |
| POSIX `flock` integration | `dagctl/internal/remoteclaim/flock.go` + `dagctl.go` withLock | Code | implemented | `phenodag` | `phenodag/internal/remoteclaim/flock.go` (ported) | SUPERSEDED_PARITY | Per ADR Phase 1 step 4, flock is moved into phenodag; `withLock` stub at `phenodag.go:116` is replaced. | low | none |
| Hardcoded `repoSet` (24 fleet repos) | `dagctl/dagctl.go` (constant) | Code | implemented | none active | `dagctl-merge-status.md:52` defers to optional preset YAML | PARTIAL | phenodag scan is path-driven; preset YAML is the planned replacement, not yet implemented. | low | not a deletion blocker; keep dagctl as historical reference until preset YAML lands. |
| `FLEET_DAG_v3.db` default DB name | `dagctl/dagctl.go` | Code | implemented | `phenodag` | `phenodag/phenodag.go` defaults to `phenodag.db`; auto-detect planned | INTENTIONALLY_DEPRECATED | Per ADR: default switches to `phenodag.db`; one-time warning on collision. | low | not a blocker. |
| `-db` single-dash flag aliases | `dagctl/*.go` (many files) | Code | implemented | `phenodag` | `phenodag` uses `--db`; shim planned in Phase 4 | NOT_COVERED | Alias shim not yet on phenodag main. | medium | add `clap` alias `-db` → `--db` in `phenodag` before archiving. |
| `v1.0.0-rc.1` release | ADR plan | Release | scaffold | `phenodag` | ADR says rc tagged | BRANCH_ONLY | Needs CHANGELOG, README command union table, CI green. | medium | cut `phenodag` v1.0.0-rc.1; tag final `v3.3.x` on `dagctl`; GitHub archive. |
| CI workflows in `dagctl` | none | CI | absent | n/a | n/a | NO_MERIT | No CI ever existed in dagctl. | low | none |
| Docs beyond README | none | Docs | absent | n/a | n/a | NO_MERIT | No `docs/`, no ADRs, no charters. | low | none |
| kwality README `STRICTLY DO NOT DELETE NOR UNARCHIVE` | `kwality/README.md` | User promise | explicit | none active | No target honors this promise yet | LAST_RESORT_EXCEPTION | The promise is a user-authored contract; no current tooling demonstrates parity. | high | extract branch-only ADRs/SBOM/SLSA to `phenotype-tooling`; honor the archive status and document in `CHANGELOG.md`. |
| `kwality` v1.0.0 tag (JS/TS/DeepEval/Playwright/Neo4j) | `kwality.git` tag `v1.0.0` (`a6072bb`) | Code | removed (history only) | none active | not represented in `TestingKit`/`phenotype-tooling` | INTENTIONALLY_DEPRECATED | Tag exists in history; the JS/TS implementation was deleted in the Go/Rust conversion. | low | keep tag reachable for git history; do not restore content. |
| `engines/runtime-validator` Rust crate | `kwality/engines/runtime-validator/{Cargo.toml, src/{lib,container,fuzzing,metrics,performance,security,validation}.rs}` | Code | implemented | `phenotype-tooling` (partial) | `crates/bench-guard` covers performance regression; `crates/legacy-scan` covers some security primitives; no fuzzing or container execution in tooling. | PARTIAL | Tooling has bench-guard and legacy-scan but no runtime-validator parity. | medium | extract clean schema-aligned version from `fix/integration-test-schema-missing-fields`; land in `phenoShared` `phenotype-contracts` or a new `pheno-runtime-validator` crate. |
| `internal/server/gin_server.go` | `kwality/internal/server/gin_server.go` | Code | implemented (TODO on validation route) | `phenotype-tooling` | absent (no Go server) | NOT_COVERED | No Go API target in tooling. | medium | convert or drop. |
| `internal/validation/*` pluggable validators | `kwality/internal/validation/*.go` | Code | scaffold | `phenoShared` | `phenotype-contracts` exists but no Go validation framework | NOT_COVERED | No parity. | medium | extract to `phenoShared/phenotype-validation` or drop with ADR. |
| `internal/engines/static_analysis.go` | `kwality/internal/engines/static_analysis.go` | Code | implemented | `phenotype-tooling` | `crates/legacy-scan/src/main.rs` is stub | NOT_COVERED | Tooling `legacy-scan` is a stub; no real static-analysis engine. | medium | extract to `phenotype-tooling/crates/static-analysis` (new crate) or drop. |
| `internal/orchestrator/orchestrator.go` | `kwality/internal/orchestrator/orchestrator.go` | Code | implemented | `phenoShared` | absent | NOT_COVERED | No orchestrator target. | medium | drop unless adopted by Tracera. |
| `internal/handlers/auth.go` (501 Not Implemented on refresh) | `kwality/internal/handlers/auth.go` | Code | broken | none | n/a | NO_MERIT | Auth refresh is unimplemented. | low | drop. |
| `tests/integration/validation_pipeline_test.go` | source path | Tests | implemented | none | n/a | NOT_COVERED | No Go validation framework in targets. | medium | extract to `Tracera` (validation tests) or drop. |
| `tests/integration/runtime_validator_test.go` | source path | Tests | scaffold (schema mismatch on main) | none | n/a | BRANCH_ONLY | Schema-alignment fix on `fix/integration-test-schema-missing-fields`. | low | cherry-pick the fix into Tracera or phenoShared; drop test if not adopted. |
| `python-tests/examples/test_llm_validation_tdd.py` | source path | Tests | scaffold | `TestingKit` `python/pheno-testing/` (empty submodule) | not present | NOT_COVERED | Python testing subtree is empty submodules. | low | drop. |
| `Dockerfile`, `docker-compose*.yml` (with broken refs) | `kwality/{Dockerfile, docker-compose*.yml}` | Deployment | scaffold | none | n/a | NO_MERIT | Compose references missing `Dockerfile.deepeval`, `Dockerfile.playwright`, `monitoring/prometheus.yml`, `monitoring/grafana/provisioning/*`, `monitoring/otel-collector-config.yaml`, `nginx/ssl/*`. | low | drop. |
| `k8s/kwality-deployment*.yaml` | source paths | Deployment | scaffold | none | n/a | NO_MERIT | k8s manifests reference unclear images. | low | drop. |
| `nginx/kwality-nginx.conf`, `monitoring/openllmetry-config.yml` | source paths | Deployment | scaffold | none | n/a | NO_MERIT | Single-file nginx/otel configs without supporting infrastructure. | low | drop. |
| `SPEC.md`, `PRD.md`, `SOTA.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `FUNCTIONAL_REQUIREMENTS.md` | `kwality/{SPEC,PRD,SOTA,ARCHITECTURE,CHANGELOG,FUNCTIONAL_REQUIREMENTS}.md` | Docs | implemented (Go/Rust version vs README's JS/TS promise) | none | n/a | PARTIAL | Documents current Go/Rust implementation, but the README still describes JS/TS/DeepEval/Playwright/Neo4j. Useful as a deep-dive of what existed, but no consumer. | medium | move to `docs/_archived/kwality/` in `phenotype-registry` or `PhenoHandbook`; otherwise drop. |
| `.hive-mind/*.db*`, `memory/{backups,data}/*` | source paths | Data | implemented (private state) | none | n/a | NO_MERIT | Local state DBs and JSON dumps committed to source; no portability. | low | drop; not source-of-truth. |
| `bin/kwality`, `bin/kwality-cli`, `kwality`, `kwality-cli` | source paths | Binaries | implemented (checked-in) | none | n/a | NO_MERIT | Compiled binaries should not be committed. | low | remove from history on archive. |
| kwality CI workflows (9) | `.github/workflows/*.yml` | CI | implemented | `phenotype-tooling` `phenoShared` reusable workflows | `phenotype-tooling/.github/workflows/reusable/*.yml` is the hub | PARTIAL | Reusable workflows are being consolidated in `phenotype-tooling`; specific kwality workflows are not yet replaced. | low | migrate reusable workflows to `phenoShared` consumables before archive. |
| kwality ADRs (branch `chore/decisions-2026-06-16`) | `docs/decisions/0001-record-architecture-decisions.md` | Docs | scaffold | `phenotype-registry` `PhenoSpecs/adrs/` | `PhenoSpecs/adrs/` is the canonical ADR location | BRANCH_ONLY | ADR template, not real decisions. | low | merge to PhenoSpecs only if specific decisions exist; otherwise drop. |
| kwality data retention policy (branch) | `docs/retention.md` | Docs | implemented | none | n/a | BRANCH_ONLY | Standalone retention policy. | low | migrate to `phenotype-org-governance` if relevant; otherwise drop. |
| kwality SLOs (branch) | `docs/slos.md` | Docs | implemented | none | n/a | BRANCH_ONLY | Standalone SLOs. | low | migrate to `phenotype-registry` `ECOSYSTEM_MAP.md` SLOs section; otherwise drop. |
| kwality STRIDE threat model (branch) | `docs/threat-model.md` | Docs | implemented | none | n/a | BRANCH_ONLY | Standalone threat model. | low | migrate to `AuthKit` security aggregator docs; otherwise drop. |
| kwality supply-chain CI: SBOM, provenance, SLSA build/verify (4 branches) | `.github/workflows/{sbom,provenance,slsa-build,verify-attest}.yml` | CI | implemented | `phenotype-tooling` | `phenotype-tooling/.github/workflows/release-attestation.yml`, `phenotype-tooling/docs/slsa.md` (added 2026-06-15) | SUPERSEDED_BETTER | Tooling's release-attestation workflow is the consolidated replacement. | low | cherry-pick into `phenotype-tooling` if not already represented; close branches. |
| kwality governance branches (`chore/gov-bootstrap`, `chore/bootstrap-deny-toml`) | branch tips | CI | superseded | n/a | n/a | INTENTIONALLY_DEPRECATED | `main` already has equivalent paths. | low | close branches. |
| kwality `cursor/configuration-and-build-issues-f955`, `chore/20260430-pin-checkout-actions` (target/ artifacts) | branch tips | CI | materially different with risk | n/a | n/a | LAST_RESORT_EXCEPTION | Both contain 6,000+ Rust `target/` artifact files. Do not merge. | low | close without merge; delete the artifact-laden branches. |
| kwality `fix/integration-test-schema-missing-fields` | branch tip | Tests | materially different | n/a | n/a | BRANCH_ONLY | Real schema-alignment between Go integration tests and Rust validator. | medium | cherry-pick the Rust side to phenoShared; cherry-pick the Go test to Tracera or drop. |
| kwality E2E workflow (branch `chore/e2e-2026-06-16`) | `.github/workflows/e2e.yml`, `tests/e2e_smoke_test.go` | CI/Tests | implemented | `phenotype-tooling` | absent | BRANCH_ONLY | Minimal Go E2E smoke. | low | port to `phenotype-tooling` if it adopts Go tests; otherwise drop. |
| kwality Dependabot branches | 8 branches | CI | superseded | n/a | n/a | INTENTIONALLY_DEPRECATED | `main` already has equivalent updates. | low | close. |
| kwality `cursor/committed-debugging-notes-cleanup-2d7b` | branch tip | Cleanup | implemented | n/a | n/a | INTENTIONALLY_DEPRECATED | Cleanup branch for accidentally committed notes. | low | close. |
| phenotype-auth-ts `ARCHIVED.md` | `ARCHIVED.md` | Docs | implemented | `libs/auth-ts` (claimed target) | not found on GitHub | NOT_COVERED | Claimed target does not exist. | medium | create `KooshaPari/libs/auth-ts` or land the auth core in `phenoShared` TypeScript surface. |
| phenotype-auth-ts `README.md` (OAuth2/OIDC/WebAuthn/cross-runtime claims) | `README.md:1-260+` | Docs | docs-only | n/a | n/a | NOT_COVERED | The README describes features the code does not implement. | medium | rewrite README to match actual code, or implement the missing features. |
| `src/domain/token.ts` (`Token`, `TokenRequest`, `TokenResponse`, `TokenError`) | `src/domain/token.ts:1-...` | Code | implemented | none (TS target) | n/a | NOT_COVERED | AuthKit is Rust-only and pre-extraction; `phenoShared` is Rust; no `libs/auth-ts` public repo. | medium | port to `phenoShared/crates/phenotype-auth` (Rust) or to a new `KooshaPari/libs/auth-ts` TypeScript package. |
| `src/domain/claims.ts` (`JwtClaims`) | `src/domain/claims.ts` | Code | implemented | none (TS target) | n/a | NOT_COVERED | Same as above. | medium | same. |
| `src/domain/errors.ts` (`AuthErrors`) | `src/domain/errors.ts` | Code | implemented | none (TS target) | n/a | NOT_COVERED | Same as above. | medium | same. |
| `src/ports/index.ts` (`TokenProvider`, `TokenStore`, `TokenVerifier`, `ClaimsValidationOptions`) | `src/ports/index.ts:1-...` | Code | implemented | none (TS target) | n/a | NOT_COVERED | Same as above. | medium | same. |
| `src/adapters/memory-token-store.ts` | source path | Code | implemented | none | n/a | NOT_COVERED | Same as above. | medium | same. |
| `src/adapters/jwt-provider.ts` (`PlaceholderJwtVerifier`) | `src/adapters/jwt-provider.ts:1-...` | Code | scaffold | none | n/a | NOT_COVERED | `verify()` always throws `AuthErrors.INVALID_TOKEN()`. | medium | either implement against `jose`/JWKS or drop the adapter. |
| `src/index.ts` | source path | Code | implemented | none | n/a | NOT_COVERED | Public API surface. | low | port. |
| `tests/core.test.ts` (token errors, memory store, claim validation) | `tests/core.test.ts:1-...` | Tests | implemented (33 passing) | none | n/a | NOT_COVERED | Tests pass but are not adopted by a target. | medium | port alongside code. |
| `tests/token.contract.test.ts` | source path | Tests | implemented | none | n/a | NOT_COVERED | Contract tests for tokens. | medium | port. |
| `tests/phenotype-ts-utils.test.ts` | source path | Tests | implemented | `KooshaPari/phenotype-ts-utils` | consumed as devDep (smoke) | DONE | Smoke tests for utility adoption already pass. | low | none |
| `package.json` (`@phenotype/auth-ts`, vitest/vitepress, `phenotype-ts-utils`) | `package.json:1-...` | Manifest | implemented | n/a | n/a | SUPERSEDED_PARITY | Migration target is `auth-ts` (per `ARCHIVED.md`). | low | rename to `auth-ts` in target. |
| `docs/.vitepress/*`, `docs/index.md`, `docs/getting-started.md` | source paths | Docs | implemented (broken examples) | none | n/a | PARTIAL | Docs site builds, but examples import wrong paths and use wrong store method signature. | medium | fix examples or archive. |
| `adr/ADR-001-architecture.md` (hexagonal) | source path | ADR | implemented | none | n/a | NOT_COVERED | AuthKit's ADRs cover a different scope (Rust). | low | migrate to `PhenoSpecs/adrs/`. |
| `assets/brand/*` (logo.svg/png, Export-Brand.ps1) | source paths | Assets | implemented | none | n/a | NOT_COVERED | Brand assets not adopted. | low | migrate to `phenotype-brand` or drop. |
| CI workflows (9) | `.github/workflows/*.yml` | CI | implemented | `phenotype-tooling` `phenoShared` reusable workflows | adopted by `phenotype-auth-ts` main | SUPERSEDED_PARITY | Workflows are already on the shared reusable set. | low | none |
| `bootstrap/pr-template` | branch tip | Docs | superseded | n/a | n/a | INTENTIONALLY_DEPRECATED | PR template exists on main. | low | close. |
| `chore/docs/standardize-20260402` (65 files governance scaffold) | branch tip | Docs | materially different | `phenotype-tooling` | tooling already has docs scaffold | PARTIAL | Large governance scaffold; check if any specific file is missing from main. | low | selective cherry-pick only if specific files absent. |
| `feat/phenotype-ts-utils-adopt-2026-06-12` | branch tip | Tests | superseded | n/a | n/a | INTENTIONALLY_DEPRECATED | Already on main. | low | close. |
| `feat/journey-impl` (older journey/iconography docs) | branch tip | Docs | superseded | n/a | n/a | INTENTIONALLY_DEPRECATED | Main has simpler journey docs. | low | close. |
| Dependabot branches (5) | branch tips | CI | superseded | n/a | n/a | INTENTIONALLY_DEPRECATED | Main has equivalent updates. | low | close. |
| `temp-branch`, `wip/devclone-rescue-phenotype-auth-ts-20260601` | branch tips | Cleanup | abandoned | n/a | n/a | NO_MERIT | Duplicate CODEOWNERS tip; WIP rescue config. | low | delete without merge. |
| `wip/devclone-rescue-phenotype-auth-ts-20260601` (removes `phenotype-ts-utils` from main) | branch tip | Code | abandoned | n/a | n/a | LAST_RESORT_EXCEPTION | This branch contradicts the main `phenotype-ts-utils` adoption. | low | delete without merge. |
| dinoforge-packs `README.md` (inactive, "not archived", pack metadata) | `README.md:1-40` | Docs | implemented | `Dino` | `Dino/README.md` (DINOForge framework) | DONE | `Dino` is the framework; the pack is a content pack for that framework. | low | none (preserve). |
| `example-balance/` reference pack | `example-balance/{pack.yaml, units/militia.yaml, factions/defenders.yaml, buildings/barracks.yaml, stats/melee-buff.yaml}` | Content | implemented | `Dino` | absent (no `community-packs/`) | NOT_COVERED | No community packs folder currently in `Dino`. | medium | add `Dino/community-packs/example-balance/` subtree. |
| `warfare-starwars/` total-conversion pack | `warfare-starwars/*.yaml` (14 files) | Content | implemented | `Dino` | absent | NOT_COVERED | Same as above. | medium | add `Dino/community-packs/warfare-starwars/` subtree after manifest reconciliation. |
| `warfare-starwars/manifest.yaml` (referenced ids and assets) | `warfare-starwars/manifest.yaml` | Content | scaffold | `Dino` | `Dino/schemas/pack-manifest.schema.json`, `Dino/schemas/total-conversion.schema.json` | PARTIAL | Schemas exist; manifest references ids/assets that do not exist. | high | reconcile manifest with actual YAML ids and add missing assets or remove references. |
| `tests/smoke_test.go` | source path | Tests | implemented | `Dino` | `Dino/test_packs.sh`, `Dino` test infrastructure exists | SUPERSEDED_PARITY | `Dino` has richer test infrastructure; the Go smoke test is redundant. | low | migrate or drop. |
| `docs/operations/journey-traceability.md` | source path | Docs | implemented | `Dino` | `Dino/docs/journeys/traceability.md` (PR #252) | SUPERSEDED_PARITY | `Dino` already has richer journey traceability. | low | none. |
| `docs/operations/iconography/SPEC.md` | source path | Docs | implemented | `Dino` / `phenotype-tooling` | `Dino` iconography, `phenotype-tooling/docs/operations/iconography/SPEC.md` | DONE | Generic spec already in tooling. | low | none. |
| `docs/journeys/manifests/README.md` | source path | Docs | implemented | `Dino` | `Dino/docs/journeys/manifests/` | DONE | `Dino` has the canonical manifests folder. | low | none. |
| `docs/sessions/20260428-taskfile-dinoforge-packs/*` | source path | Docs | implemented | `Dino` | `Dino` has its own session logs | SUPERSEDED_PARITY | Session log specific to Taskfile language detection work. | low | migrate or drop. |
| `docs/worklogs/README.md` | source path | Docs | implemented | n/a | n/a | INTENTIONALLY_DEPRECATED | Standard worklog README. | low | drop. |
| `FUNCTIONAL_REQUIREMENTS.md` (stub) | source path | Docs | scaffold | `Dino` | `Dino` has FRs | SUPERSEDED_PARITY | Stub only. | low | drop. |
| Quality-gate, fr-coverage, doc-links workflows (echo stubs) | `.github/workflows/{quality-gate,fr-coverage,doc-links}.yml` | CI | scaffold | `phenoShared` reusable workflows | `KooshaPari/phenoShared/.github/workflows/*` (already pinned on main) | SUPERSEDED_PARITY | Stub workflows are already replaced by shared reusable workflows. | low | none. |
| `ci.yml` | `.github/workflows/ci.yml` | CI | implemented | `Dino` | `Dino` has its own CI | SUPERSEDED_PARITY | Generic pack CI. | low | drop. |
| `trufflehog.yml` | `.github/workflows/trufflehog.yml` | CI | implemented | `phenoShared` | shared reusable | SUPERSEDED_PARITY | Already shared. | low | none. |
| `scorecard.yml`, `alert-sync-issues.yml` | source paths | CI | implemented | `phenoShared` | shared reusable | SUPERSEDED_PARITY | Same. | low | none. |
| `.pre-commit-config.yaml` | source path | Config | implemented | `phenotype-tooling` | shared | SUPERSEDED_PARITY | Pre-commit config is org-standard. | low | none. |
| `LICENSE` (MIT) | source path | License | implemented | `Dino` | MIT | DONE | Same license. | low | none. |
| `FUNDING.yml`, `CODEOWNERS`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CITATION.cff` | source paths | Governance | implemented | `Dino` | similar | DONE | Standard governance. | low | none. |
| `ci/pin-trufflehog` (TruffleHog replacement/pinning) | branch tip | CI | materially different | `phenoShared` | shared reusable | SUPERSEDED_PARITY | Replacement/pinning already on main via PR #32. | low | close. |
| `cursor/trufflehog-setup-go-action-af33` (setup-go pin) | branch tip | CI | materially different | `phenoShared` | shared reusable | SUPERSEDED_PARITY | Same. | low | close. |
| `hygiene/preserve-canonical-20260605` (CODEOWNERS + SECURITY) | branch tip | Governance | materially different | `Dino` | already on main | SUPERSEDED_PARITY | Already on main via PR #41. | low | close. |
| `chore/dinoforge-packs-local-snapshot-20260608`, `ci/fix-trufflehog-actions-rot`, `snapshot-2026-06-07` (share tip `0dc8cfb`) | branch tips | Snapshot | abandoned | n/a | n/a | NO_MERIT | Local dirty-state snapshot. | low | delete without merge. |
| `Configra` source repo | GitHub API 404, `FocalPoint#130` "phantom (404)" | Source | NOT_FOUND | `Conft` and `phenoShared` config crates | `Conft/rust/phenotype-config/`, `Conft/typescript/packages/conft/`, `phenoShared/crates/phenotype-config-core`, `phenoShared/crates/phenotype-config-loader`, `FocalPoint` `pheno-config` loader | INTENTIONALLY_DEPRECATED | Public 404; no surviving artifact to delete. | low | none. |
| `phenotype-config` canonical config | implied target | Concept | unknown | `Conft` and `phenoShared` | as above | SUPERSEDED_PARITY | The canonical config responsibility is owned by `Conft` (Rust `configkit` + TS `@phenotype/config-ts`) and `phenoShared` (`phenotype-config-core`, `phenotype-config-loader`). `FocalPoint#130` plan further centralizes on `pheno-config` crate. | low | no source action; target owners continue migration per ADR-012. |
| `Logify` source repo | GitHub API 404 | Source | NOT_FOUND | none | n/a | INTENTIONALLY_DEPRECATED | Public 404; no artifact. | low | none. |

---

## 6. GAPS_AND_EXCEPTIONS

### Gaps requiring target patches
1. **dagctl `extend3-v3` shim** — add `-db` alias in `phenodag`; cut `phenodag` v1.0.0-rc.1.
2. **kwality branch-only ADRs/SBOM/SLSA** — cherry-pick into `phenotype-tooling` before archive.
3. **kwality `engines/runtime-validator` Rust crate** — port clean version to `phenoShared` or drop.
4. **kwality `internal/engines/static_analysis.go`** — port to `phenotype-tooling/crates/static-analysis` or drop.
5. **kwality `fix/integration-test-schema-missing-fields`** — cherry-pick into `Tracera` or drop.
6. **phenotype-auth-ts TS core** — port to `phenoShared` TypeScript surface, a new `KooshaPari/libs/auth-ts`, or another TS auth consumer. Rewrite README to match code or implement missing features.
7. **phenotype-auth-ts `PlaceholderJwtVerifier`** — implement against `jose`/JWKS or drop.
8. **dinoforge-packs `warfare-starwars/manifest.yaml`** — reconcile ids and assets before subtree merge into `Dino`.
9. **dinoforge-packs reference pack `example-balance/`** — subtree into `Dino/community-packs/`.

### Last-resort exceptions
1. **kwality** as a whole — user-authored `STRICTLY DO NOT DELETE NOR UNARCHIVE` promise is not satisfied by any target. Archive status is current; deletion is unsafe.
2. **kwality `cursor/configuration-and-build-issues-f955`, `chore/20260430-pin-checkout-actions`** — contain 6,000+ Rust `target/` artifacts; do not merge; close without merge.
3. **phenotype-auth-ts** as a whole — `ARCHIVED.md` declares migration to `libs/auth-ts`, but the target is not findable on GitHub. Do not delete the source until the migration target is reachable.
4. **phenotype-auth-ts `wip/devclone-rescue-phenotype-auth-ts-20260601`** — branch contradicts main's `phenotype-ts-utils` adoption. Close without merge.

---

## 7. LAST_RESORT_EXCEPTIONS

1. **kwality repo** — `STRICTLY DO NOT DELETE NOR UNARCHIVE - Personal Project - LLM validation platform` (user promise) and absence of parity for LLM/DeepEval/Playwright/Neo4j/Go validation server/Rust runtime validator. Minimum patch: extract branch-only ADRs/SBOM/SLSA into `phenotype-tooling`; honor archive status; do not delete.
2. **phenotype-auth-ts** — `ARCHIVED.md` migration target (`libs/auth-ts`) is GitHub-404. Minimum patch: create a reachable target (`KooshaPari/libs/auth-ts` or `phenoShared` TS surface), port the working core, and re-archive.
3. **dinoforge-packs** — content is preserved; only the destination is missing. Minimum patch: add `Dino/community-packs/example-balance/` and `Dino/community-packs/warfare-starwars/` subtrees, reconcile the `warfare-starwars/manifest.yaml`, then archive `dinoforge-packs` or keep it as a mutable community-submit registry per the original spec.

---

## 8. DELETION_JUSTIFICATION_ESSAY

### 1. Executive decision
`DELETE_AFTER_PATCHES` for `dagctl`, `kwality`, `phenotype-auth-ts`; `PRESERVE` for `dinoforge-packs`; `NOT_FOUND` (no action) for `Configra` and `Logify`. **Confidence:** high for `dagctl`, `dinoforge-packs`, `Configra`, `Logify`; **low** for `kwality`; **medium** for `phenotype-auth-ts`.

### 2. Absorption target mapping
- **dagctl → phenodag** (better). The `phenodag` superset binary preserves every dagctl command, including `internal/remoteclaim`, the v3 engine, operational/meta/visualization/dedup commands, and the HTML template. ADR `ADR-dag-superset-merge.md` is Accepted. `phenodag/docs/dagctl-merge-status.md` tracks `sd-dagctl-01..05` as Done.
- **kwality → phenotype-tooling + phenoShared + Tracera** (partial). Tooling has stubs for `quality-gate`, `bench-guard`, `legacy-scan`, `fr-trace`. There is no parity for the LLM validation, DeepEval/Playwright/Neo4j stack, Go validation server, or Rust runtime validator. The user `STRICTLY DO NOT DELETE NOR UNARCHIVE` promise is honored by leaving the repo archived.
- **phenotype-auth-ts → claimed `libs/auth-ts`** (missing). The claimed target is GitHub-404. `AuthKit` is a pre-extraction staging repo that does not yet contain auth SDK code.
- **Configra/phenotype-config → Conft + phenoShared** (better). `Conft` provides Rust `configkit` and TS `@phenotype/config-ts`; `phenoShared` provides `phenotype-config-core` and `phenotype-config-loader`; `FocalPoint#130` consolidates further on `pheno-config`.
- **dinoforge-packs → Dino** (better). `Dino` is the DINOForge framework. The pack should land under `Dino/community-packs/`.
- **Logify** — no target, because there is no source.

### 3. Evidence summary
- **Source inventory summary:** documented in §2; each repo has default branch, refs, tags, code, tests, docs, CI, and state.
- **Branch inventory summary:** 31+19+21 = 71 non-default branches across `kwality`/`phenotype-auth-ts`/`dinoforge-packs`; `dagctl` has none. Most branches are superseded, dependency bumps, or hygiene; a smaller set is materially different and listed in §3.
- **Target parity summary:** `phenodag` is parity for `dagctl`; `phenotype-tooling` is partial scaffold parity for `kwality`; `AuthKit` is pre-extraction and not parity for `phenotype-auth-ts`; `Conft` and `phenoShared` are parity for the absent `Configra`; `Dino` lacks a community-packs folder.
- **Gaps and exceptions:** enumerated in §6 and §7.

### 4. Merit of broken/empty/scaffold work
- **dagctl `extend3-v3` unwired command**: low merit on its own; patch phenodag to alias it.
- **kwality `auth.go` 501 Not Implemented**: no merit; drop.
- **kwality docker-compose with missing files**: no merit; drop.
- **kwality checked-in binaries (`bin/kwality`, etc.)**: no merit; remove on archive.
- **kwality `.hive-mind/*.db*`, `memory/` data files**: no merit; not source-of-truth; drop.
- **kwality ADRs/SBOM/SLSA branch-only work**: merit; extract to `phenotype-tooling` or `phenotype-org-governance`.
- **phenotype-auth-ts `PlaceholderJwtVerifier`**: low merit; either implement or drop.
- **phenotype-auth-ts README features not in code**: low merit; rewrite or implement.
- **dinoforge-packs `warfare-starwars/manifest.yaml` with missing assets**: low merit on its own; reconcile before subtree merge.
- **dinoforge-packs CI stub workflows (echo only)**: no merit; drop.
- **Configra / Logify 404s**: no merit; not applicable.
- **All abandoned snapshot branches (`temp-branch`, `wip/devclone-rescue-phenotype-auth-ts-20260601`, `snapshot-2026-06-07` etc.)**: no merit; delete without merge.

### 5. Last-resort exceptions
- `kwality` — user promise and no parity.
- `phenotype-auth-ts` — claimed migration target is 404.
- `dinoforge-packs` — destination is missing; preserve content; migrate to `Dino/community-packs/`.

### 6. Final deletion recommendation
- **`dagctl`: DELETE_AFTER_PATCHES.** Required patches: (a) add `extend3-v3` shim and `-db` alias in `phenodag`; (b) cut `phenodag` v1.0.0-rc.1; (c) tag final `v3.3.x` on `dagctl`; (d) GitHub archive `dagctl` (do not delete git history or releases).
- **`kwality`: DELETE_AFTER_PATCHES (with archive only).** Required patches: (a) cherry-pick branch-only ADRs/SBOM/SLSA into `phenotype-tooling`; (b) port the schema-aligned Rust `runtime-validator` to `phenoShared`; (c) port the `static_analysis.go` to `phenotype-tooling/crates/static-analysis`; (d) honor the user's archive-only promise.
- **`phenotype-auth-ts`: DELETE_AFTER_PATCHES.** Required patches: (a) make the `libs/auth-ts` migration target reachable (create `KooshaPari/libs/auth-ts` or a `phenoShared` TS surface); (b) port the working core; (c) re-archive.
- **`dinoforge-packs`: PRESERVE.** Required action: subtree `example-balance/` and `warfare-starwars/` into `Dino/community-packs/`, reconcile the manifest, then either archive `dinoforge-packs` or keep it as the community-submit registry.
- **`Configra` / `Logify`: NOT_FOUND.** No action.

---

## 9. RECOMMENDED_NEXT_ACTIONS

1. **dagctl**: file PR in `phenodag` adding `extend3-v3` shim and `-db` alias; cut `phenodag` v1.0.0-rc.1; tag `dagctl` v3.3.1 with README redirect; GitHub archive `dagctl`.
2. **kwality**: open PR into `phenotype-tooling` cherry-picking `chore/sbom-2026-06-16`, `chore/provenance-metadata-2026-06-16`, `chore/verify-attest-2026-06-16`, `chore/slsa-build-2026-06-16`; port `engines/runtime-validator/src/{lib,validation,security,performance,container,fuzzing,metrics}.rs` to `phenoShared/crates/phenotype-runtime-validator` (or drop); port `internal/engines/static_analysis.go` to `phenotype-tooling/crates/static-analysis`; close governance/superseded branches; honor archive status.
3. **phenotype-auth-ts**: confirm target with user (create `KooshaPari/libs/auth-ts` or a `phenoShared` TS surface); port `src/domain/`, `src/ports/`, `src/adapters/memory-token-store.ts`, and a real `jose`-backed `JwtVerifier`; rewrite README to match code; close Dependabot/superseded branches; re-archive.
4. **dinoforge-packs**: file `Dino/community-packs/{example-balance,warfare-starwars}/` subtrees; reconcile `warfare-starwars/manifest.yaml`; migrate or drop smoke test; archive the source repo or keep as mutable community-submit registry.
5. **phenotype-registry / PhenoSpecs**: refresh `ECOSYSTEM_MAP.md` and `PhenoSpecs/registry.yaml` to reflect the absorption outcomes (phenoShared ownership of `phenotype-config`, `phenodag` ownership of `dagctl`, `Conft` ownership of the TS config surface, `Dino/community-packs/` ownership of the Star Wars content pack).
6. **phenotype-tooling**: port any remaining reusable workflows from `kwality` so the `phenotype-shared` reusable set is the single source of truth.
7. **AuthKit**: begin the staged auth SDK work per its own README roadmap; this audit does not authorize deletion but supports the move toward a single Phenotype auth home.
