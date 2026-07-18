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
