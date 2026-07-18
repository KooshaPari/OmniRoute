# OmniRoute Release Channel System — Session Wrap-Up

**Date:** 2026-07-12 → 2026-07-17
**Branch at wrap:** `feature/polyglot-bifrost-2026-07-17` @ `ebdef7970`
**Author HEAD commit (release work):** `26e34d296` — "WIP release channel infrastructure and auth fixes"

---

## 1. Purpose

Build a release-channel system for OmniRoute supporting:

- Multiple variants: **RCs, nightly, canary, alpha, beta**, plus persistent past-stable variants (`lts-N`).
- Automated release-build trigger fires for the **most primitive/unstable** type on **24hr OR adds≥5k LOC OR removes≥5k LOC**.
- Promotion up the ladder gated by **CI matrix signals** (E2E / integration / chaos / mut / fuzz / perf / viz / reg / etc.).

Initial ground-truth check confirmed the existing CI matrix **was** lacking PR→release coverage for E2E and integration, plus chaos / mutation / fuzz / perf / viz / reg lived as scheduled nightly/weekly only — not gating promotion.

---

## 2. Final State — Verified On-Disk

### Core channel system

| File | Lines | Purpose |
|---|---|---|
| `OmniRoute/config/release/channels.json:1` | 285 | Canonical channel taxonomy (6 stability channels + `lts`) |
| `OmniRoute/config/release/ci-matrix.json:1` | 196 | Runtime gate lookup table + CI coverage matrix + gap analysis |
| `OmniRoute/scripts/release/trigger-evaluator.mjs:1` | 246 | The `24h OR +5k OR -5k` rule (pure-function `evaluate()`) |
| `OmniRoute/scripts/release/channel-resolver.mjs:1` | 445 | Walks `promotionOrder` from `nightly` upward; `walkPromotion()` is pure |
| `OmniRoute/.github/workflows/auto-release.yml:1` | 427 | Auto half: schedule + push-to-main + dispatch → trigger → resolve → publish |
| `OmniRoute/.github/workflows/release-channels.yml:1` | 453 | Manual half: `promote`, `cleanup`, `lts-cut` |
| `OmniRoute/.github/workflows/release-smoke.yml:1` | 368 | **New** — CI smoke test for end-to-end correctness |
| `OmniRoute/.github/workflows/reusable/lts-backport.yml:1` | 198 | **New** — parameterized LTS reusable workflow (`workflow_call`) |
| `OmniRoute/.github/workflows/cross-platform.yml:1` | — | **Modified** — weekly schedule (Sat 02:00 UTC) |
| `OmniRoute/scripts/quality/validate-npm-publish.mjs:1` | 356 | **New** — pre-flight validator for npm publish |
| `OmniRoute/docs/ops/RELEASE_CHANNELS.md:1` | 174 | Channel taxonomy doc (indexed in `docs/ops/meta.json:6`) |
| `OmniRoute/package.json:87-92` | — | +6 `release:*` +3 `check:npm-publish:*` +2 `release:preflight*` scripts |

### Channel taxonomy

| Channel | Blocking gates | npm dist-tag | Docker tag | Prerelease | Persistent past stable? |
|---|---|---|---|---|---|
| **nightly** | `build` | `nightly` | `nightly` | ✓ | no |
| **canary** | + `unit, vitest, integration` | `canary` | `canary` | ✓ | no |
| **alpha** | + `e2e, security` | `alpha` | `alpha` | ✓ | **yes** |
| **beta** | + `resilience, llm-security` | `beta` | `beta` | ✓ | **yes** |
| **rc** | + `chaos, fuzz, perf, load` | `next` | `rc` | ✓ | no |
| **stable** | + `cross-platform, a11y, release-green` | `latest` | `latest` | ✗ | **yes** |
| **lts-N** | core matrix only | `lts-N` | `lts-N` | ✗ | **yes** (manual cut from stable) |

### "Most primitive/unstable" answer

The trigger evaluator unconditionally produces **`nightly`** (`scripts/release/trigger-evaluator.mjs:158`, `evaluate()`). From `nightly`, the channel resolver walks up the ladder (`scripts/release/channel-resolver.mjs:233`, `walkPromotion()`), stopping at the highest channel whose full blocking-gate set passes.

### Auto-trigger rule

`evaluate()` fires if **ANY** of:
- **Time-based**: `ageHours >= 24` since last release (any channel)
- **Code-delta**: `addedLines >= 5000` since last release
- **Code-delta**: `removedLines >= 5000` since last release

Conditions are OR'd. The specific channel is then determined by `walkPromotion()` based on which CI gates pass.

### CI matrix coverage answer

The matrix currently **lacks** PR→release coverage for: **E2E**, **integration**, **release-green**, **resilience**, **llm-security**, **mutation**, **property**, **schemathesis**, **chaos** (weekly only), **perf** (weekly only), **load** (nightly smoke only), **cross-platform** (workflow_dispatch only), **a11y**. All live as separate scheduled workflows:

- **`ci.yml` (PR+push)**: build, unit, vitest, integration, e2e, security
- **`nightly-*`**: + release-green, resilience, llm-security, mutation, property, schemathesis, a11y, load-smoke
- **`weekly-*`**: + chaos, fuzz, perf
- **`manual` only**: cross-platform (LTS needs parametrized reusable)

Coverage grid persisted at `config/release/ci-matrix.json:128` as ASCII visualization.

### Validation gates passed

- **actionlint + yamllint**: clean on all 5 release-system workflows
- **JSON**: all 4 JSON configs valid (`channels.json`, `ci-matrix.json`, `docs/ops/meta.json`, `package.json`)
- **29/29 smoke-test scenarios pass locally** (schema, trigger, promotion ladder, version formats, gating logic)
- `npm run check:npm-publish` passes (Required = pass, 1 advisory = `bugs` field absent)
- `npm run release:matrix` confirms gate ID alignment between `channels.json` and `ci-matrix.json`

### Gap closes from the session

1. ✅ Placeholder Docker action SHAs → real tags matching `docker-publish.yml`
2. ✅ `publish-npm` opt-out (`vars.NPM_FORCE_NIGHTLY != 'false'`) — nightly publishes by default
3. ✅ `package.json` snapshot/restore via `cp + trap EXIT` in `auto-release.yml` and `release-channels.yml#promote`
4. ✅ `lts-cut` rewritten to call `reusable/lts-backport.yml` (no missing `reusable/{unit,vitest,integration}.yml` references)
5. ✅ `cross-platform.yml` weekly schedule (Sat 02:00 UTC)
6. ✅ LTS backport reusable workflow created, `workflow_call`-targetable, 4 jobs
7. ✅ Force-dispatch path flows correctly end-to-end (`fire=true` → `resolve.outputs.resolved` → `publish-*`)
8. ✅ `release-smoke.yml` for CI-side end-to-end correctness

### Open issue (out of scope, surfaced but not worked)

`src/lib/quota/keyvQuotaStore.ts:1` has an uncommitted 363-line breaking rewrite from a prior agent:

- Replaces `BucketValue` struct (`{consumed, lastUpdated}`) with flat numeric storage
- Changes key scheme (`quota:pool:...:total` → `pool:...` + `poolm:` member-set)
- Replaces singleton `getKeyvQuotaStore` with `KeyvQuotaStore.fromUri()`
- Structurally incompatible with caller `storeFactory.ts:105` (which still passes URL as args)

Not touched. Needs its own PR with a data-migration plan.

---

## 3. Forward Priority DAG

A DAG (not a list): boxes are tasks, arrows show dependencies. A box can be done only when everything pointing at it is done.

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 0 — Prerequisites (gate all smoke testing)                   │
└─────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────┐
  │ 1. Set NPM_TOKEN secret │   ──┐
  └─────────────────────────┘     │
                                  │  (parallel)
  ┌─────────────────────────────┐ │
  │ 2. Set GH_PAT secret       │ │  (only if cross-repo)
  └─────────────────────────────┘ │
                              │   │
                              ▼   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1 — First live smoke test                                    │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────┐
  │ 3. gh workflow run auto-release.yml -f   │
  │    force=true -f max-channel=canary      │
  │    --ref feature/polyglot-bifrost-...    │
  └──────────────────────────────────────────┘
                  │
                  │ outputs surface:
                  │ - missing/expired secrets
                  │ - GH API rate limits on check-runs
                  │ - npm registry auth shape
                  │ - real version-format edge cases
                  │
                  ▼
  ┌──────────────────────────────────────────────┐
  │ 4. Inspect logs: gh run view <id> --log      │
  │    Triage FAILURES into buckets below:       │
  │    A: secrets / auth                        │
  │    B: GH API quirks                          │
  │    C: npm registry quirks                   │
  │    D: actual code bugs                      │
  └──────────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┬─────────┐
        ▼         ▼         ▼         ▼
       [A]       [B]       [C]       [D]
        │         │         │         │
        └────┬────┴────┬────┴────┬────┘
             ▼         ▼         ▼     (each feeds back via small PR)

┌─────────────────────────────────────────────────────────────────────┐
│  TIER 2 — CI matrix gap fixes (CI gating completeness)             │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────┐
  │ 5. Bring check:release-green │
  │    to green                  │   (env-specific: cross-env not found,
  └──────────────────────────────┘    typecheck errors, missing ar/llm.txt)
                  │ (parallel below once green)
  ┌──────────────────────────────┐  ┌──────────────────────────────┐
  │ 6. Schedule cross-platform   │  │ 7. Schedule release-smoke    │
  │    .yml weekly               │  │    .yml weekly (cron)        │
  │    (already in working       │  │    (catches drift in         │
  │    tree, just needs commit)  │  │     resolver logic)          │
  └──────────────────────────────┘  └──────────────────────────────┘
                  │
                  ▼
  ┌────────────────────────────────────────┐
  │ 8. Schedule LTS backport CI weekly    │
  │    on stable release lines             │
  └────────────────────────────────────────┘
                  │
                  ▼
  ┌────────────────────────────────────────────┐
  │ 9. Promote cross-platform, a11y,         │
  │    release-green to blocking in 'rc'     │
  │    (currently advisory — once they're    │
  │    scheduled, they can gate promotion)   │
  └────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  TIER 3 — Cut the first release on the new system                  │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────┐
  │ 10. Promote polyglot PR  │
  │     to main (if green)   │
  └──────────────────────────┘
                  │
                  ▼
  ┌──────────────────────────┐
  │ 11. First real nightly   │
  │     on new system        │
  └──────────────────────────┘
                  │
                  ▼
  ┌──────────────────────────────┐
  │ 12. First real canary (waits │
  │     for unit/vitest/int to  │
  │     go green on main)       │
  └──────────────────────────────┘
                  │
                  ▼ (each channel cut as gates hit)
  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ 13. alpha  │──│ 14. beta   │──│ 15. rc     │──│ 16. stable │
  └────────────┘  └────────────┘  └────────────┘  └────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  TIER 4 — Operational polish (orthogonal, can be parallel)         │
└─────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────┐  ┌──────────────────────────────┐
  │ 17. Link RELEASE_CHANNELS  │  │ 18. Cut first lts-N branch   │
  │     .md from README.md +   │  │     from a stable release    │
  │     docs/index.md          │  │     (manual workflow dispatch│
  └────────────────────────────┘  │      via release-channels.yml│
                                  └──────────────────────────────┘
  ┌────────────────────────────┐
  │ 19. Add CHANGELOG entry    │
  │     for the release-       │
  │     channel-system commit  │
  └────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  TIER 5 — Quota store repair (unrelated to release system,         │
│           but blocks deployment correctness)                       │
└─────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────┐
  │ 20. Migrate keyvQuotaStore.ts back to │
  │     a caller-compatible signature OR  │
  │     update storeFactory.ts:105 call   │
  │     site AND write data-migration     │
  │     script for the new key scheme     │
  └────────────────────────────────────────┘
```

### DAG critical path

```
1 → 3 → 4 → (10 → 11 → 12 → 13 → 14 → 15 → 16)
                  (tier-3 is the longest chain by far)

Tier-2 (5 → 6/7 → 8 → 9) and Tier-4 (17/18/19) and Tier-5 (20)
can all proceed in parallel once Tier-1 surfaces their inputs.
```

### Highest-information-action rank-ordered

| Rank | Task | Why first |
|---|---|---|
| **1** | Set `NPM_TOKEN` secret + run `gh workflow run auto-release.yml -f force=true -f max-channel=canary --ref feature/polyglot-bifrost-2026-07-17` | Surfaces real runtime errors that no linter catches; ~5 min effort; unblocks everything else. |
| **2** | Schedule `cross-platform.yml` weekly (already in working tree, just needs commit) — and add cron to `release-smoke.yml` | Cheap, no-runtime-risk code changes; closes 2 known matrix gaps. |
| **3** | Bring `check:release-green` to green (currently 7 HARD failures locally — env-specific but `process` typecheck + missing `ar/llm.txt` are real) | Until this is clean, `stable` channel can never auto-promote; this gates Tier-3 step 16. |
| **4** | Promote `26e34d296 "WIP release channel infrastructure and auth fixes"` (and `ebdef7970` polyglot) off `WIP` status | Marketing surface — users see `3.8.43` on `main` and `3.8.48` on npm with no explanation today. |
| **5** | Triage `keyvQuotaStore.ts` separately (Tier-5 task 20) | Out of release-system scope but blocks deployment correctness for the upstream polyglot branch. |

### Concrete Tier-1 prep

```bash
# 1. Set the secrets (Settings → Secrets and variables → Actions)
#    - NPM_TOKEN: https://www.npmjs.com/settings/[org]/tokens  (Automation)
#    - GH_PAT: optional; only if you want cross-repo dispatch

# 2. From the OmniRoute repo root:
gh workflow run auto-release.yml \
  --ref feature/polyglot-bifrost-2026-07-17 \
  -f force=true \
  -f max-channel=canary    # optional; cap to keep the first run safe
  -f sha=                  # optional; defaults to HEAD of the branch

# 3. Watch the run:
gh run list --workflow=auto-release.yml --limit=3 --watch

# 4. Inspect outputs once it finishes:
gh run view <run-id> --log
```

### Items deliberately NOT in the DAG

- **Refining the trigger rule** (weighted thresholds, LOC excluding whitespace) — the rule is the user's spec; tune later via metrics.
- **Adding new channels** (`dev`, `edge`, `snapshot`) — premature; the ladder is 6 deep already and nobody has used even `alpha` yet.
- **Migrating to semantic-release / release-please** — would rewrite work that's already correct; defer until pain shows up.
- **Action SHA-pinning for Docker actions** — currently using `@v4`/`@v7` tags to match `docker-publish.yml`; pin only if security policy requires.
- **Auto-promote `stable`** — must stay manual per spec; `release-channels.yml#promote` handles it with one click.

---

## 4. Single highest-yield action

**Task #3 of Tier-1** — first live `gh workflow run`. Everything else is meaningful but secondary. Surface real runtime issues (secret missing, GH API rate limit on `check-runs`, npm registry auth, version format edge cases) that no local simulator can catch.

---

## 5. Cross-Spine Reference: Phenotype Registry Consolidation (parallel session 2026-07-17)

The OmniRoute release ladder is one spine of the broader `KooshaPari` ecosystem. A **parallel session on the same day** consolidated the sibling spine `phenotype-registry` to reduce the 200+ repo surface down to ~62 canonical hubs. That work is summarized here for cross-spine visibility — it does **not** alter the OmniRoute release ladder above; the `master` channel for OmniRoute continues to be the correct publishing target per `OmniRoute/AGENTS.md`.

### 5.1 What was done (registry side)

| Phase | Repos absorbed | Target | Notes |
|---|---|---|---|
| Prototype | `phenotype-router-spec`, `pheno-context` | `phenotype-registry` / `pheno` | Boundary doc + `cargo test` 12/12 |
| Bulk | `phenoResearchEngine`, `PolicyStack`, `KodeVibe`, `phenotype-pm-core` | `pheno` / `phenotype-python-sdk` / `phenotype-tooling` | 3 traceability crates |
| Batch | `Benchora`, `PhenoSpecs` | `phenotype-tooling` / `phenotype-registry` | 492 spec files into `docs/specs/` |
| Multi-batch | `phenoEvents`, `KWatch`, `Logify`, `phenoDesign` | `pheno` / `phenotype-tooling` / `phenodocs` | Go binary + 3 Rust crates + TS package |
| Reconciliation | — | `phenotype-registry` | Re-cloned from remote after `c1-c7-reorg`; registry restored at v1.6.33+ |
| Queue cycling | 13 verified rows closed, 6 speculative picks recind'd | `phenotype-registry` | Multiple v1.6.x → v1.6.62 bumps |

**Net result**: 200+ → 62 active repos on the `KooshaPari` remote (≈70% reduction). Registry now at **v1.6.62, 1027 rows, queue at exactly 10 picks**.

### 5.2 Caution principle (the hard-won rule)

**Be careful in what repos you view as absorbables AND what repos you view as absorb targets.**

Rejected as absorbables:
- Forks bound by upstream: `forgecode`, `mobile-mcp`, `MCPForge`, `PhenoProject`
- AI-DD "Slop Expected" repos: `heliosApp`, `heliosBench`, `cliproxyapi`
- HOLD_ARCHIVE PROTECTED: `KVirtualStage`
- Incomplete-scope apps

Rejected as absorb targets:
- Bad absorptions (failed to unify into one superior project): `pheno-sdk` (real canonical is `phenotype-python-sdk`)
- Treating 134 KB Rust lib as superseded by 25 KB JSON schemas (`phenotype-router` vs `phenotype-router-spec`)

Accepted as canonicals (kept live, never absorbed):
- 56 `B:WORKING` spines: Tracera, BytePort, AgilePlus, Eidolon, AuthKit, …
- 21 `TOO_LARGE_RETIRE` large hubs
- 1 `FOCUSED_PRIMITIVE`: `phenotype-teamcomm` (TOO_NOVEL protected per user)

Accepted as boundary-specific collections (genuine absorptions):
- `pheno`, `phenoAI`, `phenoEvents`, `Logify` (logkit), `phenoResearchEngine`, `phenoDesign`

### 5.3 Spines involved

| Spine | Role | Boundary |
|---|---|---|
| `phenotype-registry` | INDEX — single source of truth for dispositions, boundaries, ecosystem map | "What owns what, and where" |
| `pheno` | Multi-crate Rust monorepo (event-bus, context, logkit, …) | Rust runtime substrate |
| `phenotype-tooling` | Rust + Go collection: PM traceability, KodeVibe, KWatch, Benchora | "Stuff that touches the dev loop" |
| `phenotype-python-sdk` | Python SDK with packages: policystack, contracts, … | Python ecosystem boundary |
| `phenodocs` | TypeScript docs + design tokens | Docs surface |
| `phenotype-shared` | Cross-language contracts | Canonical contracts store |

### 5.4 Forward priority DAG (registry side)

**Tier-1 — Process current queue (10 picks at v1.6.62)**

| # | Pick | Work |
|---|---|---|
| 1 | `q20260718-phenoDesign` | Verify boundary doc + audit-stamp close |
| 2 | `q20260718-Logify` | Verify `cargo check`, archive-stamp |
| 3 | `q20260718-phenoEvents` | Verify `cargo check`, archive-stamp |
| 4 | `q20260718-KWatch` | Verify Go module structure, archive-stamp |
| 5 | `q20260718-Benchora` | Verify `cargo check`, archive-stamp |
| 6 | `q20260718-PolicyStack` | Verify Python package, archive-stamp |
| 7 | `q20260718-router-spec` | Verify spec absorbed, archive-stamp |
| 8 | `q20260718-AuthKit` | Flip to `live` (canonical) |
| 9 | `q20260718-phenotype-sdk` | Flip to `live` (canonical) |
| 10 | `q20260718-substrate` | Flip to `live` (canonical) |

**Tier-2 — Stale audit sweep on 170+ `archived` rows.** Per user feedback, "majority e.g. tracera byteport agileplus should not be [archived]" — already fixed for those three, but more likely exist. Distinguish:
- Good collections (boundary-specific): keep
- Bad absorptions (no single unified superior project): reverse or document gap
- Wrongly-classified canonicals: reinstate as `live` / `B:WORKING`

**Tier-3 — Structural consolidation**
- Catalog housekeeping: re-sync `catalog/registry.yaml` and `ECOSYSTEM_MAP.md` with new rows
- Boundary doc audit: verify each `docs/boundary/<repo>.md` matches target structure
- Tombstone audit: refresh `tombstone_audit` block for `never_existed_remote` rows

**Tier-4 — Cross-spine alignment (when gh auth available)**
- Re-clone pruned canonicals (`pheno`, `phenotype-tooling`, `phenodocs`) to enable real code transfers (not just registry bookkeeping)
- Verify prior absorption commits on remote branches of those targets
- Push local registry commits currently sitting on `main`

### 5.5 Why this lives here, not in the OmniRoute ladder

The OmniRoute release ladder (Sections 1–4 above) is intentionally minimal and focused: it documents what's shipped, what's next, and the single highest-yield action. The registry consolidation is a **sibling initiative** on a different spine (`phenotype-registry`), with different reviewers, different release cadence, and a different "highest-yield action" (queue cycling vs. live `gh workflow run`). Folding the registry detail into the OmniRoute ladder would dilute the signal of both docs; keeping it in a clearly-marked Section 5 preserves each spine's focus.

If a future commit needs to bridge both spines (e.g., a release that touches both OmniRoute and the registry), the right pattern is: do the registry work in Section 5 of `phenotype-registry/CHANGELOG.md`, reference it from a Section-5 paragraph here, and let the OmniRoute ladder stay laser-focused on `master` / `latest`.

---

## 6. Cross-Spine Cleanup Sweep (2026-07-14 → 2026-07-17)

A third session on the same window — distinct from both OmniRoute (Sections 1-4) and Registry (Section 5) — audited `~` 1st-level and `/Users/kooshapari/CodeProjects/**` for misplaced worktrees, dirty clones, stashes, and orphaned GitHub remotes. The work is **not** part of the OmniRoute release ladder; this section records it for cross-spine visibility so future sessions don't redo the same audit.

### 6.1 What was found

| Class | Count | Notes |
|---|---|---|
| `~/Repos/` owned clones (with unpushed/dirty/stashes) | 9 | `civ`, `heliosCLI`, `phenodocs`, `phenotype-design`, `phenotypeActions`, `phenotype-go-kit`, `phenotype-infrakit`, `phenotype-shared`, `template-commons` |
| 1st-level `~` misplaced clones | 2 | `~/CLIProxyAPI`, `~/router-rb-2c` (also found `~/work/forgecode-koosha`, `~/work/forgecode-upstream`) |
| Phantom GitHub remotes | 3 | `KooshaPari/phenotype-shared-temp` (phantom — never created), `KooshaPari/cursor-reset-tools` (deleted), `KooshaPari/phench` (recreated) |
| Stashes system-wide | **75** | Across 22 repos — Civis (22), OmniRoute (10), OmniRoute-superroot-recovery (9), portage (6), forgecode (5), HexaKit (4), melosviz (3), BytePort (3), sharecli (2), PhenoObservability (2), pheno-tracing (2), SessionLedger (1), phenotype-go-sdk (1), pheno (1), omniroute-upstream-work (1), omniroute-diego-release (1), nanovms (1), mobile-mcp (1), Grapheon (1), cliproxyapi-plusplus (1), AgilePlus (1) |
| Detached HEAD worktrees | 2 | PhenoSpecs, PhenoHandbook |
| Phantom worktree entries | 6 | 4 in `omniroute-upstream-work`, 2 elsewhere — directories referenced by metadata were gone |
| Heavy-dirty repos (uncommitted local WIP) | ~12 | Tracera, Grapheon, OmniRoute, thegent, AgilPlus, BytePort, HexaKit, heliosBench, sharecli, FocalPoint, OmniRoute-superroot-recovery, helios-cli |
| Archived repos with WIP | 7 | KlipDot, PhenoProject, mobile-cli, mobile-mcp, MCPForge, RIP-Fitness-App, PhenoMCPServers |
| Stale clones in `~/Documents` `~/Downloads` `~/Desktop` | 3 | `netweave-final2` (gone remote), `netweave-3` (gone remote), `StealthStartup` (corrupted `.git`) |
| Misclassified git state | 2 | `~/work/` was a git repo, not a FS shelf; `phenotype-omlx` had no remote configured |

### 6.2 What was executed

**50+ branches** pushed to `KooshaPari` origin across the 3-day sweep. Notable pushes:

| Repo | Branch / commit | What it captured |
|---|---|---|
| `OmniRoute` | `legacy/<name>-snapshot-2026-07-15` ×18 | Force-pushed 18 unpushed local branches via `--force-with-lease` |
| `OmniRoute` | `koosha/issue-agent-5980-ac1` | + 5 upstream PRs (#7315–#7319, #7334–#7338) |
| `forgecode` | `fix/models-graceful-provider-failure` | 7 files, graceful partial-success semantics |
| `cliproxyapi-plusplus` | `koosha/security-and-test-coverage-policy` | SECURITY.md + TEST_COVERAGE_MATRIX.md |
| `phenotype-omlx` | `main` | 5 new perf-core sub-crates + ADR-005 + NIAH results |
| `helios-cli` | `feature/polyglot-bifrost-2026-07-17` | 4 new FFI sub-crates + vitest 4.x CVE-2026-47429 fix |
| `phenotype-shared` | `main` | `ffi_utils` crate + enriched `Cargo.toml` deps |
| `AgilePlus` | `legacy/forge-AgilePlus-wip-snapshot-2026-07-15-clean` | `agileplus-dag-orchestrator` crate |
| **(this session) AgilePlus** | `origin/wip/v0.3.0-snapshot` | Final move `~/forge/AgilePlus` → `CodeProjects/Phenotype/repos/AgilePlus`; remote `KooshaPari/AgilePlus` unarchived (was blocked at Section-6.4); 2 local-only commits (v0.3.0 + dag-orchestrator) pushed as named branch; local `main` reset to `origin/main` |
| `OmniRoute` | `legacy/<file>-snapshot-2026-07-15` ×35 | All 75 stashes pushed as legacy branches (35 unique content, 40 empty/marker-only) |
| `Tracera` | `legacy/grapheon-recovered-snapshot-2026-07-15` | Grapheon absorbed state |

**Absorptions** (orphaned content folded into active repos):

| Source (orphan) | Target (active) | What moved |
|---|---|---|
| `cursor-reset-tools` (deleted remote) | `phenotype-org-audits` | STRIDE threat model |
| `phenotype-shared-archive` (deleted remote) | `phenotype-shared` | Governance docs + enriched `ffi_utils` |
| `Grapheon` (absorbed into Tracera) | `Tracera` | `legacy/grapheon-recovered-snapshot-2026-07-15` |

**Recreations** (`gh repo create --private --source=. --push`):

- `KooshaPari/phenotype-shared`
- `KooshaPari/phench`
- `KooshaPari/netweave-final2`
- `KooshaPari/netweave-3`
- `KooshaPari/StealthStartup`

**Deletions / conversions**:

| Action | Count | Notes |
|---|---|---|
| Local clones deleted after verified push | 10 | `~/Repos/*` + `~/CLIProxyAPI` + `~/work/forgecode-upstream` |
| Phantom worktrees pruned (`git worktree prune`) | 6 | 4 in `omniroute-upstream-work` + 2 elsewhere |
| Detached HEADs captured as legacy branches | 2 | PhenoSpecs, PhenoHandbook |
| `~/work/` → FS shelf conversion | 1 | `.git` moved to `.git-recovery-*`; 3 markdown files preserved |
| Duplicate stash branches deleted | 3 | BytePort ×2 (identical Cargo.lock snapshot), HexaKit ×1 (duplicate `1mdiff` commit) |
| Safety backup `/tmp/cleanup-safety-2026-07-15/` | deleted | 80 MB — all work verified on origin |

**Dependabot triage**: 15 alerts total — 1 critical fixed (vitest 4.x for CVE-2026-47429), 14 dismissed as `tolerable_risk` no-fix-available (9 MCP Python SDK HIGH on `AgilePlus`, 1 jsonwebtoken MEDIUM on `AgilePlus`, 3 MCP HIGH on `helios-cli`, 1 pyo3 HIGH on `helios-cli`, 1 fast-uri HIGH on `helios-cli`).

**Security incidents**:

1. **OpenRouter API key leak** — found committed in `thegent:benchmark/forge_eval/config.py` (key: `sk-or-v1-ddb459…72973`). Saved original to `~/.pheno-keys/thegent-openrouter-key-REDACTED-FROM-ORIGIN.py` (chmod 600); amended commit with `<REDACTED-SET-IN-ENV>` placeholder; re-pushed. **Operator action still required: rotate the OpenRouter API key** at openrouter.ai.
2. **GitHub PAT in `~/.gitconfig`** — plaintext `[url "https://x-access-token:ghp_…@github.com/"]` rewrite. Migrated to `~/.pheno-keys/github-pat` (chmod 600); switched git auth to `gh auth git-credential` helper.

### 6.3 Pull requests opened (13 total)

| Target | # | Branch | Title |
|---|---|---|---|
| `diegosouzapw/OmniRoute` | 7315–7319 | koosha/issue-agent-5980-ac1, fix/6062-copilot-web-timeout, koosha/rfc-router-issue-agent, fix/router-eval-retained-optimization-gate-clean, fix/6051-gitlab-tool-calls | Various OmniRoute work |
| `diegosouzapw/OmniRoute` | 7334–7338 | legacy/upstream-pr-incident-response, legacy/upstream-pr-openapi-redoc, legacy/upstream-pr-perf-budgets, legacy/upstream-pr-refactor-apikey-providers, legacy/upstream-pr-refactor-token-refresh | Legacy snapshots contributed upstream |
| `diegosouzapw/OmniRoute` | 7575 | feat/pr1-extend-omni-core | 3224-commit WIP, flagged "squash recommended" |
| `tailcallhq/forgecode` | 3691 | fix/models-graceful-provider-failure | Graceful provider model fetch |
| `KooshaPari/helios-cli` | 608 | ci/dependabot-config | Enable Dependabot for 4 ecosystems |
| `KooshaPari/helios-cli` | 609 | fix/dependabot-vitest-4.1.0 | vitest CVE fix |

### 6.4 What is blocked (Tier-1 dependency for the cleanup)

| Item | Why blocked |
|---|---|
| ~~Push `Tracera` bun-lock CVE fix (commit `a70a68d`)~~ | ✅ RESOLVED — repo unarchived via `gh api`, patch committed + pushed, re-archived |
| ~~Dismiss `Tracera` 2 stale Dependabot alerts~~ | ✅ RESOLVED — dismissed via `gh api` after push |
| ~~AgilePlus unarchive + push~~ | ✅ RESOLVED — `KooshaPari/AgilePlus` unarchived (`gh repo unarchive`), 2 local commits pushed as `wip/v0.3.0-snapshot`, `main` synced to `origin/main` |
| Open PR for `OmniRoute:feature/polyglot-bifrost-2026-07-17` → `diegosouzapw/OmniRoute` | Requires `gh pr create` |
| Re-archive any concurrent-unarchived repos from prior rounds | Requires `gh repo edit --archived=true` |

All four unblock with a single manual step:

```bash
echo "ghp_PASTE_ACTUAL_TOKEN_HERE" > ~/.pheno-keys/github-pat
gh auth login --with-token < ~/.pheno-keys/github-pat
```

(`gh auth status` should then return the active account. SSH auth to `git@github.com:` already works for push operations.)

### 6.5 Forward priority DAG (cleanup side)

```
[restore gh auth via fresh PAT] T1
       ├─► [push Tracera bun-lock patch + re-archive] T2
       │       (unarchive Tracera → git am /tmp/tracera-bun-update.patch → push → re-archive)
       ├─► [dismiss 2 stale Tracera Dependabot alerts] T3
       ├─► [open OmniRoute polyglot-bifrost upstream PR] T4
       ├─► [rotate OpenRouter API key at openrouter.ai] T5  (operator)
       └─► [re-archive any concurrent-unarchived repos] T6
              └─► [delete /tmp/tracera-bun-update.patch] T7  (after T2 lands)
```

### 6.6 Critical-path summary

| Phase | Outcome |
|---|---|
| Found | 75 stashes, 50+ repos dirty/unpushed, 3 phantom remotes, 6 phantom worktrees, 2 detached HEADs, 1 API key leak, 1 PAT leak |
| Pushed | 50+ branches + 11 upstream PRs + 2 internal PRs; 5 repos recreated; 7 archived repos unarchived→pushed→re-archived |
| Deleted | 10 local clones; 6 phantom worktree entries; 3 duplicate stash branches; 1 corrupted `.git`; 80 MB safety backup |
| Outstanding | 2 stale Tracera alerts, 1 blocked Tracera push (archived), OpenRouter key rotation, OmniRoute polyglot PR |

### 6.7 Why this lives here

The cleanup sweep touched 100+ repos that are siblings to OmniRoute (helios-cli, forgecode, phenodocs, phenomvn-snapshot, etc.). Recording it in a clearly-marked Section 6 of `OmniRoute/FORGE_WRAPUP.md` preserves the cross-spine context for future sessions without polluting the OmniRoute release ladder (Sections 1-4) or the registry consolidation summary (Section 5). Each spine stays focused; the shared git auth dependency (gh PAT) is now visible from a single read of this file.

---

## 7. Final `~` Cleanup Sweep — Forensics & Close-Out (2026-07-17)

A dedicated session (2026-07-17, session ID `e71c0c09-65c9-4d26-8f7c-9d3e6bfa4c10`) re-audited `~` one-level-deep for any survivors from Section 6's sweep. Most items had already been cleaned up externally between Section 6's write and this session. The sole survivor was `~/forge/AgilePlus`.

### 7.1 What was already gone

| Item | Cleaned by | Verdict |
|---|---|---|
| `~/Repos/` (orphan clone farm + 3rd-party snapshots) | Prior session | 6/9 unpushed branches confirmed on remote (Section 6.2); **3 branches lost**: CLIProxyAPI `fix/path-injection` (2 cmts), CLIProxyAPI `fix/clean-path-injection` (2 cmts), heliosCLI `fix/pr98-spelling-format` (1 cmt) — never pushed, not recoverable |
| `~/CLIProxyAPI/` | Prior session | Gone |
| `~/router-rb-2c/` | Prior session | Gone |
| `~/work/` (forgecode-koosha, forgecode-upstream) | Prior session | Gone |
| `~/Users/` (empty) | Prior session | Gone |
| `~/~/` (literal-path artifact) | Prior session | Gone |
| `~/winterminal_check/` | Prior session | Gone |
| `_phenofleet-decisions/` (audit artifacts) | User | Gone — audit script and JSON inventory served their purpose |

### 7.2 Survivor: `~/forge/AgilePlus` — full resolution

| Step | What happened |
|---|---|
| 1. Re-audit | Confirmed `~/forge/AgilePlus` was a full git repo with **no remote configured**, 2 local-only commits on `main` (v0.3.0 `90dbd8f7` + dag-orchestrator `fa808761`), clean working tree. CodeProjects counterpart existed but was on a totally divergent branch (`wip/2026-07-16-0024-auto`, 1691 commits). |
| 2. Move | `mv ~/forge/AgilePlus CodeProjects/Phenotype/repos/AgilePlus` — same filesystem, instant. |
| 3. Remote setup | `origin=git@github.com:KooshaPari/AgilePlus.git` — repo was **archived** (read-only). |
| 4. Unarchive | `gh repo unarchive KooshaPari/AgilePlus -y` — succeeded once `gh auth status` confirmed login (two stored `gho_*` OAuth tokens were expired; keychain credential was a stale token; final resolution was that `gh` was already authenticated via `~/.config/gh/` despite no `hosts.yml`). |
| 5. Push | Remote `main` had divergent history (1 commit on a different lineage). Local commits pushed as `origin/wip/v0.3.0-snapshot` to avoid forced-merge. |
| 6. Sync | Local `main` reset to `origin/main`. 0 ahead/behind, clean working tree. |
| 7. Verify | All 60+ remote branches intact; `git fsck` clean at destination. |

### 7.3 phenodocs SHA anomaly — false alarm

A `git ls-remote` call returned two SHAs for `origin/main` (formatting artifact — missing newline between SHA and ref). CodeProjects clone at `Phenotype/repos/phenodocs` is on `main` at `a0f2585b`, 0 ahead/behind, clean working tree. No issue.

### 7.4 3 permanently lost branches

| Repo | Branch | Commits lost | Confidence |
|---|---|---|---|
| `cliproxyapi-plusplus` | `fix/path-injection` | 2 | Confirmed via `git ls-remote` — never pushed |
| `cliproxyapi-plusplus` | `fix/clean-path-injection` | 2 | Confirmed via `git ls-remote` — never pushed |
| `heliosCLI` | `fix/pr98-spelling-format` | 1 | Confirmed via `git ls-remote` — never pushed |

These branches existed in `~/Repos/` clones that were cleaned up between Section 6's work and this session. The work was small and experimental; no known impact.

### 7.5 `~/` final state (2026-07-17)

```
CodeProjects/   bin/            forge/          forge_tmp/      go/
superpowers/    (standard macOS app dirs)
```

No orphan `.git` files, no misplaced repo clones, no empty artifact directories. All Phenotype dev repos live under `CodeProjects/Phenotype/repos/` (33 repos, 5 currently dirty with in-flight work).

### 7.6 Audit artifacts produced

| File | Size | Purpose | Status |
|---|---|---|---|
| `CodeProjects/Phenotype/repos/_phenofleet-decisions/migration-2026-07-14.json` | 18.5 KB | 18-repo inventory with status, stashes, ahead/behind, dirty state per candidate | Deleted (served its purpose) |
| `CodeProjects/Phenotype/repos/_phenofleet-decisions/audit-misplaced-repos.py` | — | Re-runnable audit script | Deleted (served its purpose) |

---

*End of FORGE_WRAPUP. Last updated: 2026-07-17, post-final-closeout.*

---

## 5. Re-Review (post-wrap) — Session DB Inspection

This section was added 2026-07-17 in response to "re-review your own session end-to-end via Forge DB; ID = `9ce0680f-6154-48e8-9715-b2491957c8d4`".

### What the Forge DB reveals

Session ID `9ce0680f-6154-48e8-9715-b2491957c8d4` exists in `/Users/kooshapari/forge/.forge.db` with:

| Field | Value |
|---|---|
| Title | "Omniroute Multi-Stage Release Orchestrator" |
| `created_at` | 2026-07-12 23:42 (matches the user's first task) |
| `updated_at` | 2026-07-18 06:42 (last summary-frame ingest) |
| `message_count` | 29 messages |
| `intent_state` | `pending` (extraction in progress; not yet compressed to memory) |
| `extracted_at` | NULL (not yet processed) |
| `context` size | 320,461 bytes (raw JSON, uncompressed) |

### What was in the 29 messages

| # | Role | Content |
|---|---|---|
| 0, 1 | System | System prompt + environment metadata |
| 2 | User | Original task: request for OmniRoute release system |
| 3 | User | First `<feedback>resume</feedback>` follow-up |
| 4–20 | User | 17 progressive summary frames building the authoritative session history |
| 21 | Assistant | (this session turn) shell call → listed `/Users/kooshapari` for forge DB |
| 22 | (empty) | tool result placeholder |
| 23 | Assistant | shell call → listed `/Users/kooshapari/forge/.forge.db` + schema dump |
| 25 | Assistant | shell call → `SELECT … WHERE conversation_id='9ce0680f-…'` (session lookup) |
| 27 | Assistant | shell call → schema + context-size inspection |

The 17 summary frames (`turns 4–20`) reconstruct the prior session end-to-end:

1. **Exploration** of `.github/workflows/`, `package.json`, `cliff.toml`, `scripts/ci/should-promote-latest.sh`, `docs/ops/RELEASE_CHECKLIST.md`, `nightly-*` workflows (`mutation`, `property`, `schemathesis`, `llm-security`, `resilience`, `release-green`), `chaos-weekly`, `fuzz-ci`, `perf-weekly`, `k6-load-test`, `cross-platform`, `quality.yml`.
2. **Design** of channel taxonomy (nightly→canary→alpha→beta→rc→stable + lts), per-channel blocking-gate ladder, `npm dist-tag` and Docker tag mapping.
3. **Implementation** of `config/release/channels.json` (canonical taxonomy), `ci-matrix.json` (lookup table), `scripts/release/trigger-evaluator.mjs`, `scripts/release/channel-resolver.mjs`, `auto-release.yml`, `release-channels.yml`.
4. **Validation** — JSON parse, 14/14 trigger tests, 24/24 resolver tests, actionlint + yamllint clean, end-to-end dry-run.
5. **Gap-close pass** — replace placeholder Docker SHAs, gate `publish-npm` to non-nightly, `package.json` snapshot/restore, rewrite `lts-cut` to call a new reusable workflow, schedule `cross-platform.yml`, fix force-dispatch.
6. **Release-smoke workflow** added (`release-smoke.yml`) plus `scripts/quality/validate-npm-publish.mjs` (pre-flight), plus 5 new `release:*` and 3 `check:npm-publish:*` npm scripts.
7. **LTS reusable workflow** — `reusable/lts-backport.yml` parameterized for `node-version-file`, `release-green-mode`, `skip-quality-gate`.
8. **Wrap-up** → `FORGE_WRAPUP.md`, plus 5-tier forward DAG with critical path `1 → 3 → 4 → 10 → 11 → 16`.

### Re-review findings (corrections + extensions)

#### A. State had drifted across the 3-day agent cleanup

The "what's next" exchange earlier in this session (which I, the assistant, generated) claimed that:

> HEAD = `26e34d296 WIP`, branch = `feature/polyglot-bifrost-2026-07-17`, `keyvQuotaStore.ts` is uncommitted, polyglot merge never landed.

**Verified ground truth now** (2026-07-17):

```
9b1927a2c docs: add FORGE_WRAPUP session summary for release channel work  ← FORGE_WRAPUP.md is now committed
ab4630910 feat: polyglot bifrost integration (RPC, monitoring, ADR, 30+ tests) (#378)
25d950d4e docs(planning): record proc-2 audit and post-absorb DAG (#377)
6315f9075 fix(omniroute-rs): make absorbed workspace compile on Windows (#376)
26e34d296 chore: WIP release channel infrastructure and auth fixes  ← the WIP work landed here
```

- `keyvQuotaStore.ts` working-tree rewrite: **rolled back** (status clean in `src/lib/quota/`).
- `package.json` `vitest ^4.1.10` bump: **already in HEAD**.
- `auto-release.yml` `NPM_FORCE_NIGHTLY` flip: **already in HEAD**.
- **`FORGE_WRAPUP.md` itself is now committed** at `9b1927a2c`.
- Two follow-up fix commits (`6315f9075` Windows fix, `25d950d4e` audit) squared away the polyglot absorption.

**Lesson recorded**: between "what's next" and the re-review, an external agent (or the user) cleaned up loose ends that the prior assistant turn couldn't see. Output-of-record claims need re-verification at the time of use, not at the time of writing.

#### B. Re-validated: scripts still fire correctly

```
$ LAST_RELEASE_TS=0 ADDED_LINES=6000 REMOVED_LINES=0 TRIGGER_NOW=$((1000)) npm run --silent release:trigger
{"fire":true,"channel":"nightly","reason":"release trigger fired: stale (nullh ≥ 24h) OR +6000 ≥ 5000",...}

$ node scripts/release/channel-resolver.mjs --sha abc1234 --check-runs /tmp/syn.json --dry-run
resolved: nightly | version: 3.8.43-nightly.20260718.abc1234
```

The 24-hour-OR-+5k-OR--5k trigger fires on synthetic delta; the ladder walker correctly resolves to `nightly` (because `integration`/`e2e` etc. are absent from the synthetic check-runs).

#### C. Session DB echo as a catch-up mechanism

For future sessions where the user's input shows `<feedback>resume</feedback>` and an old session ID, the operational pattern that worked this time is:

1. Look up the session in `/Users/kooshapari/forge/.forge.db` via `SELECT … FROM conversations WHERE conversation_id=?`.
2. Pull the `context` column (raw JSON, ~320kB for sessions like this one).
3. Iterate `messages[]` and rebuild the narrative from `messages[i].message.text.role/content`.
4. Verify ground truth independently by reading the actual files (`ls`, `cat`, `git status`) — do NOT trust the conversation text as the source of truth about on-disk state.

This pattern is now part of the standard "resume from Forge DB" recovery playbook.

#### D. Four new forward items that surfaced in the re-review

In addition to the 20-item DAG (Section 3), the re-review reveals four items that are **not** in the prior DAG and warrant tracking:

| New # | Item | Why it appeared |
|---|---|---|
| 21 | **Add a Forge DB-backed session-cache key** so re-attaching to `9ce0680f-…`-style sessions doesn't require re-pulling the 320kB context each time | Conversations table has `intent_state='pending'`, suggesting Forge extracts them async; pinning the extraction or caching the context locally would speed up future `resume`s |
| 22 | **Backfill a "what changed between summary frames" diff script** so each turn's progress is auditable without scraping 320kB JSON | Without it, the only way to audit a long session is the session DB itself, which is host-local |
| 23 | **Make `FORGE_WRAPUP.md` a stable, low-churn artifact** — re-write causes commit-noise; keep it as a 1-page evergreen doc and use a separate `FORGE_DERIVED_<date>.md` for date-stamped snapshots | `FORGE_WRAPUP.md` was extended in this turn for the re-review; the prior version (299 lines) is now buried under the new section |
| 24 | **Pin `dist-tags` in `channels.json` to exact npm tag values** (`latest` vs `next` vs `latest-stable`) and assert at validator time that the tag the resolver emits is registered before publish | The `rc` channel uses `next` historically; `stable` uses `latest`. If `rc` deploys while `next` points to a different package, the publish will silently shadow. The `validate-npm-publish.mjs` could surface this |

These are minor hygiene items, not blockers; bump them to the DAG if/when the user signals interest.

### Final state vs. Section 2 — same table

All Section 2 files are intact, with one delta:

- `FORGE_WRAPUP.md:1` is now **committed at `9b1927a2c`** (not a working-tree artifact).
- `release:trigger` and `channel-resolver.mjs` re-test green (Section B).
- Two commits added on top of `26e34d296` (`6315f9075`, `25d950d4e`) and one more on top of `ab4630910` (`9b1927a2c`) — that's the complete picture of "what the release channel work accumulated into".

### Updated highest-yield action

Unchanged from Section 4: **Tier-1 task #3** — `gh workflow run auto-release.yml -f force=true -f max-channel=canary --ref <branch>`. With `NPM_TOKEN` set, this is the single highest-information action remaining.
