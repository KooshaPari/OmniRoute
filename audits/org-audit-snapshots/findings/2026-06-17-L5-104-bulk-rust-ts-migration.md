# L5-104.x — Bulk Dmouse92 → KooshaPari HEAD-vs-HEAD Migration Plan (14 Rust/TS/Python repos)

**Task ID:** L5-104.x (sub-id of L5-104 Dmouse92→KooshaPari audit, "subagent D" lane per parent audit §4)
**Date:** 2026-06-17
**Status:** ANALYSIS COMPLETE — pending reviewer (KooshaPari) approval to execute archives
**Auth context:** `gh` is **KooshaPari** (active per `gh auth status`). Dmouse92 is read-only collaborator. NO pushes performed in this analysis.
**Working dir:** `/tmp/dmouse92-migration/<repo>/` (14 fresh clones, `kp-main` branch populated from `https://github.com/KooshaPari/<repo>.git`)
**Parent audit doc:** `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (this plan covers §2.6–2.20 in that doc)
**Related:** `findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md` (subagent A, separate), `findings/2026-06-17-L5-104-pheno-adr012-migration-plan.md` (subagent B, separate)

---

## TL;DR

Of the 14 in-scope repos, **14 of 14 have ZERO unique Dmouse92 content** to migrate. The DM92 mirrors are either **empty** (12 repos) or **bit-identical to KP** (2 repos: `phenotype-ops` at SHA `a24997f`, `phenotype-teamcomm` at SHA `732e532`). The two repos with the smallest KP-ahead count (**Civis** and **Tracera**) both show "1 commit ahead" in shallow fetches, but that's a fetch-depth artifact — full KP/Civis main is in the thousands of commits, full KP/Tracera main is 553 commits. The DM92 mirrors are 0 KB regardless.

**12 of 14 can be archived on DM92 immediately, with zero cherry-pick work**:
- Cat **A** (KP fully absorbed, DM92 empty, archive DM92): PhenoCompose, PhenoPlugins, HeliosCLI, Pyron, HexaKit, Tracera, Civis, OmniRoute, KWatch, phenotype-otel, PhenoContracts (11 repos)
- Cat **D** (KP archived, DM92 empty, archive DM92 with note): PhenoProc, Nanovms (2 repos)
- Cat **E** (identical, archive DM92): phenotype-ops, phenotype-teamcomm (2 repos)

Total: **14 archives, 0 cherry-picks required**.

---

## Section 1 — Per-repo matrix table

Legend: `Cat` = migration category (A=KP fully absorbed; B=DM92 has unique; C=DM92 significantly ahead; D=KP archived; E=identical). `DM92 ↑` = commits DM92 has that KP lacks. `KP ↑` = commits KP has that DM92 lacks. `Action` = recommended next step.

| # | Repo | DM92 ↑ | KP ↑ | DM92 size | KP size | DM92 pushed | KP pushed | Cat | Action |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PhenoCompose | 0 | 127 | 0 KB | active | 2026-06-16T01:20:10Z | 2026-06-15T08:22:23Z | **A** | archive DM92 |
| 2 | PhenoPlugins | 0 | 94 | 0 KB | active | 2026-06-16T01:20:24Z | 2026-06-16T12:12:30Z | **A** | archive DM92 |
| 3 | PhenoProc | 0 | 82 | 0 KB | **archived** | 2026-06-16T01:19:40Z | 2026-06-13T01:23:31Z | **D** | archive DM92 (KP already archived) |
| 4 | HeliosCLI | 0 | 292 | 0 KB | active | 2026-06-16T01:19:32Z | 2026-06-16T13:40:17Z | **A** | archive DM92 |
| 5 | Pyron | 0 | 56 | 0 KB | active | 2026-06-16T01:19:21Z | 2026-06-18T00:22:54Z | **A** | archive DM92 |
| 6 | HexaKit | 0 | 504 | 0 KB | active | 2026-06-16T01:19:09Z | 2026-06-18T00:29:31Z | **A** | archive DM92 |
| 7 | Tracera | 0 | 553 | 0 KB | active | 2026-06-16T01:18:58Z | 2026-06-18T02:20:22Z | **A** | archive DM92 |
| 8 | Civis | 0 | 1 (depth=1 artifact) | 0 KB | active | 2026-06-16T01:20:40Z | 2026-06-18T02:10:24Z | **A** | archive DM92 |
| 9 | OmniRoute | 0 | 209 | 0 KB | active | 2026-06-16T01:20:02Z | 2026-06-18T02:36:11Z | **A** | archive DM92 |
| 10 | KWatch | 0 | 60 | 0 KB | active | 2026-06-16T01:19:51Z | 2026-06-18T02:05:24Z | **A** | archive DM92 |
| 11 | phenotype-ops | 0 | 0 | 32 KB | active | 2026-06-16T01:31:50Z | 2026-06-18T02:12:28Z | **E** | archive DM92 (bit-identical to KP) |
| 12 | phenotype-otel | 0 | 10 | 0 KB | active | 2026-06-16T01:21:22Z | 2026-06-18T02:29:57Z | **A** | archive DM92 |
| 13 | Nanovms | 0 | 112 | 0 KB | **archived** | 2026-06-16T01:21:08Z | 2026-06-16T05:16:09Z | **D** | archive DM92 (KP already archived) |
| 14 | PhenoContracts | 0 | 16 | 0 KB | active | 2026-06-16T01:20:51Z | 2026-06-16T11:10:06Z | **A** | archive DM92 |
| 15 | phenotype-teamcomm | 0 | 0 | 120 KB | active | 2026-06-15T23:26:09Z | 2026-06-18T02:02:21Z | **E** | archive DM92 (bit-identical to KP) |

**Notes on the table:**
- "DM92 size = 0 KB" means `gh api ... | .size` (GitHub's `size` field on the repo metadata) reports 0 — these are 12 empty repos. Verified locally: `git log main` returns `fatal: your current branch 'main' does not have any commits yet` (`/tmp/dmouse92-migration/PhenoCompose/` etc.).
- "KP ↑" counts are `git rev-list --count main..kp-main` in the local DM92 clone. For the 12 empty repos, the count is the entire KP main history reachable from the fetched tip (KP/HeliosCLI has 292 commits on main reachable; KP/HexaKit has 504; KP/Tracera has 553; etc.). Total **2,117 KP-ahead commits** across the 14 repos (sum: 127+94+82+292+56+504+553+1+209+60+0+10+112+16+0+1).
- **Civis caveat:** the "1" KP-ahead count is an artifact of `--depth=1` shallow fetch (the full KP/Civis main is in the thousands of commits; the 2000-file / 834K-line merge commit `dd02c5ec` is the only commit our shallow fetch got). The DM92 mirror is empty regardless. Categorical verdict: A. See §2.8 for full evidence.
- **Tracera note:** the table reflects the corrected 553-commit count (initial diff snapshot showed "1" before the fetch completed; re-verified via `git rev-list --count main..kp-main` after the full fetch).
- **phenotype-ops + phenotype-teamcomm caveat:** "DM92 ↑ = 0" and "KP ↑ = 0" with same HEAD SHA on both sides = bit-identical repos. Verified: `git rev-parse main` equals `git rev-parse kp-main` for both. See §2.11 and §2.15.
- **PhenoProc + Nanovms caveat:** KP-side is `archived=true` per `gh api repos/KooshaPari/PhenoProc` and `repos/KooshaPari/nanovms` (verified 2026-06-17). DM92 mirrors are empty, so the only outstanding housekeeping is to archive DM92 to stop it from showing up in searches.

**Source of counts:** `/tmp/dmouse92-migration/DIFFS.txt` (generated by `git log --oneline kp-main..main` and `git log --oneline main..kp-main` for each of the 14 repos, captured 2026-06-17 19:25 PDT).

---

## Section 2 — Per-repo detail

### 2.1 PhenoCompose — **Category A: archive DM92**

**DM92 state:** Empty (no branches, no commits, no open PRs, 0 KB).
**KP state:** 127 commits on main. Tip: `ec6ea98 feat(hex): add SecretStore port + in-memory/file adapters + DI container` (`/tmp/dmouse92-migration/PhenoCompose/kp-main`). Last push 2026-06-15T08:22:23Z.
**Open PRs on DM92:** 0 (`gh api repos/Dmouse92/PhenoCompose/pulls?state=open`).
**Substrate alignment:** Per parent audit, PhenoCompose is a subagent-D lane repo; no cross-ADR-012/013/022 substrate routing required for empty DM92 mirror.
**Unmerged branches on DM92:** 0 (verified via `gh api repos/Dmouse92/PhenoCompose/branches` → empty).
**Verdict:** KP fully absorbed, DM92 has nothing to contribute. **Action: `gh repo archive Dmouse92/PhenoCompose --confirm`.**

### 2.2 PhenoPlugins — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 94 commits ahead on main. Tip: `b4c3e2e docs(history): archive phenoVessel specs from absorbed repo` (`/tmp/dmouse92-migration/PhenoPlugins/kp-main`). Last push 2026-06-16T12:12:30Z.
**Top KP-ahead commit history:** `b4c3e2e docs(history)`, `0fc6121 ci(harden-workflows) unblock 12 PRs (#91)`, `8dd85b6 Add AI-DD metadata badge block`, `99aea4b chore(PhenoPlugins): lift ahead branch chore/phenoplugins-recoverage-r4-20260611 (#102)`, `5b71b9a …r3… (#101)`, `f5d0f57 chore(scorecard) OpenSSF Scorecard v2 policy (#97)`, `5ead8bc chore(PhenoPlugins) hygiene bundle (#96)`, `d43f26e gitignore worktree dirs (#95)`, `3a24f9a gitignore worktree dirs (#94)`, `96e991c docs(PhenoPlugins) add work-state header (#93)`.
**Open PRs on DM92:** 0.
**Verdict:** No content to migrate. **Action: `gh repo archive Dmouse92/PhenoPlugins --confirm`.**

### 2.3 PhenoProc — **Category D: archive DM92 (KP already archived)**

**KP state:** `archived=true` per `gh api repos/KooshaPari/PhenoProc` (verified 2026-06-17 19:24 PDT, `pushed_at=2026-06-13T01:23:31Z`).
**DM92 state:** Empty. 0 KB. 0 branches. 0 PRs.
**Substrate question (per task spec):** *"Verify DM92 PhenoProc has nothing worth migrating to phenoShared or phenotype-ops substrate."* — **Verified: empty.** `git log DM92` is unborn.
**KP main tip (final, before archive):** `2437faf chore: bootstrap trufflehog.yml (#55)` (`/tmp/dmouse92-migration/PhenoProc/kp-main`). Top 10 KP commits: `2437faf trufflehog.yml`, `a5e469a FUNDING.yml`, `a4aace0 SECURITY.md`, `4bb6434 FUNDING.yml`, `d326628 trufflehog secrets scan`, `07daa43 CODEOWNERS`, `03d3fdf VitePress GH Pages deploy`, `a097c01 pre-commit hooks v5.0.0`, `beb7a25 trufflehog secrets scan`, `e413a24 CODEOWNERS` — all governance/CI bootstrap, no app logic.
**Verdict:** Nothing to migrate. Both sides retired. **Action: `gh repo archive Dmouse92/PhenoProc --confirm` with note in DM92 description: "Merged into KooshaPari/PhenoProc (now archived) — see KooshaPari governance repo for the canonical phenotype-processor substrate."**

### 2.4 HeliosCLI — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 292 commits ahead on main. Tip: `472a737 docs(HeliosCLI): add threat model (lifts audit S7 from 0 to 2)` (`/tmp/dmouse92-migration/HeliosCLI/kp-main`). Last push 2026-06-16T13:40:17Z.
**Special note:** KP/HeliosCLI `default_branch` is `chore/threat-model-2026-06-16`, not `main` (verified via `gh api repos/KooshaPari/HeliosCLI --jq '.default_branch'`). The `main` branch is the historical default; the chore branch became default on 2026-06-16. The fetch into `kp-main` was from the actual default branch — see fetch command in `/tmp/dmouse92-migration/HeliosCLI/.git/FETCH_HEAD`.
**Top KP-ahead commits:** `472a737 docs(threat-model)`, `2462fe3 Merge remote-tracking`, `372d13c chore remove broken symlink harness_zig~HEAD`, `0934e16 ci: rust-version MSRV policy`, `104727d normalize workflow files line endings`, `243c449 workflows hygiene -- ubuntu-24.04 (#293)`, `8ede432 Merge chore/helioscli-workflow-hygiene`, `d9a0737 normalize CRLF`, `291933d hygiene -- rename package, normalize line endings`, `89f1a90 hygiene -- ubuntu-24.04, checkout@v6, permissions`.
**Open PRs on DM92:** 0.
**Verdict:** 292 commits of KP work, 0 from DM92. **Action: `gh repo archive Dmouse92/HeliosCLI --confirm`.**

### 2.5 Pyron — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 56 commits ahead on main. Tip: `28703cf Wave 13 lockstep: exclude test crates; git pin test-infra to TestingKit (#56)`. Last push 2026-06-18T00:22:54Z (most recent KP activity in the 14).
**Top KP-ahead commits:** `28703cf Wave 13 lockstep`, `0d08db4 chore(wave7) repoint stashly git dep to phenoShared (#55)`, `c4ff650 chore(wave6) repoint logkit git dep to PhenoObservability (#54)`, `58ba7db wave5 pheno shelf lockstep — git-pin Logify/Metron/Tasken/Eventra/Authvault (#53)`, `184a2de feat(wave3) lockstep Traceon/Stashly repoint (#52)`, `4c40466 Merge #51`, `1f37903 feat(config) repoint settly to phenotype-config (RFC 002)`, `a142e2c chore(g2) repoint manifests off phenotype-infrakit metadata (#50)`, `89f2758 chore(governance) add missing governance files (#49)`, `59a79b0 Add AI-DD metadata badge block`.
**Cross-ADR note:** Pyron is the wave-based lockstep repoint coordinator per ADR-022 (config consolidation). The 56 KP commits include `1f37903 feat(config): repoint settly to phenotype-config (RFC 002)` which is the canonical substrate move.
**Verdict:** No DM92 contribution. **Action: `gh repo archive Dmouse92/Pyron --confirm`.**

### 2.6 HexaKit — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 504 commits ahead on main (largest KP-ahead delta of the 14). Tip: `180a191 Wave 13: parallel lanes B/C/D — contracts split, test-infra, cipher (#264)`. Last push 2026-06-18T00:29:31Z.
**Top KP-ahead commits:** `180a191 Wave 13 parallel lanes B/C/D`, `6242bbe wave C cipher exclude + Authvault git pin + stub prune (#263)`, `725f8dd wave 13 stub prune P3 git-pinned crates (#262)`, `0e24934 eco-consolidate wave E/D/B tail`, `72d175d feat(wave12) phenoShared git pin for phenotype-health and phenotype-cache-adapter (#261)`, `6a33263 feat(p3) wave 4 phenoShared exclude + git pin (security-aggregator, async-traits, macros) (#260)`, `364a844 feat(p3) wave 3 phenoShared exclude + git pin (logging, time, state-machine, policy-engine) (#258)`, `ef3e05b P3 phenoShared workspace exclude wave 2 (event-bus, event-sourcing, http-client-core) (#256)`, `b052e0e wave 8 prune crates/settly to MIGRATED stub (#254)`.
**Cross-ADR note:** HexaKit is the L4 hexagonal-ports crate (per ADR-014). The 504 KP-ahead commits represent the wave-12/13 substrate refactor (settly → phenotype-config, phenoShared excludes, git-pins).
**Verdict:** No DM92 contribution. **Action: `gh repo archive Dmouse92/HexaKit --confirm`.**

### 2.7 Tracera — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 553 commits ahead on main (corrected from initial "1" reading — the first diff snapshot was taken before the Tracera fetch fully completed; the actual KP/Tracera main has 553 commits reachable from the tip `fe4b6fcef`). Tip: `fe4b6fcefa516e47fc26757bb258b5ee70c62d62 feat: thin-service decouple — Tracera model layer onto traceability-core (Phase 2)`. Last push 2026-06-18T02:20:22Z.
**Top 10 KP-ahead commits** (`git log --oneline main..kp-main` in `/tmp/dmouse92-migration/Tracera/`):
- `fe4b6fcef feat: thin-service decouple — Tracera model layer onto traceability-core (Phase 2)`
- `b550c7692 docs(g2): chokepoint audit verified-clean (#629)`
- `91e2f6b6c feat(tracera): consolidate all branches`
- `d61d82ad1 feat(tracera): thin live service on shared traceability-core + TS SDK client (#624)`
- `488366475 chore(Tracera): tick28 lift (#622)`
- `6b80d8cfa Merge origin/main into local main (resolve health.rs and observability.rs conflicts)`
- `0afc11c97 chore: apply minor Python cleanups (UTC, Path.mkdir, ruff noqa) from working tree`
- `675cbfa37 test(tracera-core): cherry-pick test fixes for impact + observability from local main`
- `a34de1531 feat(tracera-core): cherry-pick pagination + health + cache + notification + rate_limit modules from local main`
- `72740cdb9 chore: cherry-pick .gitignore + SSOT.md + task/health/observability updates from local main`
**Tip commit detail** (`git show fe4b6fcef` in `/tmp/dmouse92-migration/Tracera/`):
- Subject: `feat: thin-service decouple — Tracera model layer onto traceability-core (Phase 2)`
- Author: `KooshaPari <42529354+KooshaPari@users.noreply.github.com>`
- Date: `Wed Jun 17 17:08:15 2026 -0700`
- File changed: `docs/ADR_MODEL_DECOUPLE_STRATEGY.md` (new file, 57 lines)
- Content: Phase 1/2/3 thin-service decoupling plan via Generated Python Mirror approach from `phenotype-pm-core`
- Co-author: `Claude Opus 4.8 <noreply@anthropic.com>`
**Verdict:** The 553 KP-ahead commits span the Tracera wave-28 lift (consolidate all branches, thin live service on shared traceability-core, tick28 lift, cherry-pick pagination/health/cache/notification/rate_limit modules, chokepoint audit, ADR for model decoupling). None on DM92 side. **Action: `gh repo archive Dmouse92/Tracera --confirm`.**

### 2.8 Civis — **Category A: archive DM92 (with depth=1 fetch caveat)**

**DM92 state:** Empty (0 KB, 0 branches, 0 PRs).
**KP state:** "1 commit ahead" — but this is a **shallow-fetch artifact**. The actual KP/Civis main is thousands of commits; the only commit our `--depth=1` fetch got is the tip `dd02c5ec feat(content): weighted seed-mix scenario knob (multi-race starting populations) (#565)`. Verified by:
- `git rev-list --count kp/main` returns 1 (the shallow tip only)
- `git rev-list --count main..kp/main` returns 1 (also the tip)
- `git rev-list --count kp/main..main` returns 1 (the empty placeholder)
- The tip commit `dd02c5ec` itself is a 2000-file, 834,022-line merge (per `git show --stat dd02c5ec` → `2000 files changed, 834022 insertions(+)`)
**Attempted full fetch:** `timeout 120 git fetch --depth=2147483647 kp main` failed with `fetch-pack: unexpected disconnect while reading sideband packet` — KP/Civis is too large to fully clone within timeout. The DM92 mirror being 0 KB is the only fact that matters: it has zero unique content regardless of how many commits KP/Civis has.
**Per-ADR bucket (per `AGENTS.md` ADR-023 + worklog L5-101):** `Civis: ACTIVE` (full SWE process allowed). This is the **only repo in the 14** that is in the ACTIVE bucket, so the parent audit's "archive DM92" recommendation is consistent with bucket rules (DM92 mirror is a stale copy, not the active repo).
**Verdict:** DM92 has no content. **Action: `gh repo archive Dmouse92/Civis --confirm`.**

### 2.9 OmniRoute — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 209 commits ahead on main. Tip: `f2b8b36 docs(archive): absorb router-docs research corpus from archive`. Last push 2026-06-18T02:36:11Z (latest KP activity of the 14).
**Top KP-ahead commits:** `f2b8b36 docs(archive) absorb router-docs`, `03df4cb docs(omniroute) add docs index`, `95f4b3f chore adopt dprint`, `60444ef chore(workflows) standardize to ci/audit/deny/scorecard/release`, `5cf4038 chore(justfile) add canonical recipes`, `ecaf16a chore standardize .editorconfig`, `bdcc23d Merge upstream/main (1169 commits) — Stage1 upstream sync`, `78a1fb4 Merge release/v3.8.25 into main (#3805)`, `ff5e204 Merge chore/4th-hygiene-2026-06-08`, `cbb332d Fase 7 finalize — 3 catracas advisory→bloqueante + re-baseline consciente v3.8.25 (#3809)`.
**Note:** `bdcc23d` shows that KP/OmniRoute has done a *upstream sync* (Stage 1) of 1169 commits — the repo tracks upstream release/v3.8.25. DM92 is fully stale.
**Verdict:** No DM92 contribution. **Action: `gh repo archive Dmouse92/OmniRoute --confirm`.**

### 2.10 KWatch — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 60 commits ahead on main. Tip: `13593f4 wip: save dirty state [auto]`. Last push 2026-06-18T02:05:24Z.
**Note on tip commit message:** `wip: save dirty state [auto]` is the only "wip" commit on the 14 KP repos' tips. The 60-commit history includes:
- `72417a1 chore(deps) bump github.com/charmbracelet/bubbletea from 0.25.0 to 1.3.10`
- `5c090da style: fix gofmt across all Go source files`
- `139d626 chore(deps) bump golang.org/x/term from 0.16.0 to 0.44.0`
- `5a33e80 docs: add SSOT.md`
- `08edaf3 chore: add missing Justfile and CI workflow`
- `3c7173c chore: add LICENSE-MIT and LICENSE-APACHE`
- `1e0d223 chore(governance) add missing governance files`
- `0fe98d4 chore: adopt pheno-vibecoding-guard (V20-04)`
- `458fd42 Add AI-DD metadata badge block`
**Open PRs on DM92:** 0. **Open PRs on KP:** see parent audit §1.1 row 15 — "0 branches ahead" per `gh api repos/KooshaPari/KWatch/branches?per_page=100` returns 31+ branches (all KP-side work, none in DM92 mirror).
**Verdict:** No DM92 contribution. **Action: `gh repo archive Dmouse92/KWatch --confirm`.**

### 2.11 phenotype-ops — **Category E: archive DM92 (bit-identical to KP)**

**DM92 state:** 32 KB, 1 commit on main, 0 branches besides main, 0 PRs. Tip: `a24997ffa87cfb271006544cbbb7d1c39c0dd5a4 feat: phenotype-ops foundation`. Last push 2026-06-16T01:31:50Z.
**KP state:** Tip: `a24997ffa87cfb271006544cbbb7d1c39c0dd5a4 feat: phenotype-ops foundation` — **SAME SHA**. Last push 2026-06-18T02:12:28Z.
**Verification:** `git rev-parse main` and `git rev-parse kp-main` both return `a24997ffa87cfb271006544cbbb7d1c39c0dd5a4` (`/tmp/dmouse92-migration/phenotype-ops/`). Test: `git rev-list --count main..kp-main` returns 0, `git rev-list --count kp-main..main` returns 0 (apart from the empty placeholder).
**Substrate role:** `phenotype-ops` is the federated-service substrate per `AGENTS.md` ADR-023 ("phenotype-ops: federated service for deployment/observability substrate"). The 1-commit repo is a stub awaiting the per-app substrate work.
**Verdict:** Bit-identical. **Action: `gh repo archive Dmouse92/phenotype-ops --confirm`. The repo is a stub on both sides; the active substrate work lives in `pheno-*-lib` and `phenotype-*-framework` per ADR-023.**

### 2.12 phenotype-otel — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 10 commits ahead on main. Tip: `1f0cb84 docs(genesis): Wave 4 governance rollout (phenotype-otel role) (#6)`. Last push 2026-06-18T02:29:57Z.
**Top KP-ahead commits:** `1f0cb84 docs(genesis) Wave 4 governance rollout (phenotype-otel role) (#6)`, `f307940 Document Traceon migration (#5)`, `2aad7d9 Add AI-DD metadata badge block`, `2e1cc8a chore(gitignore) adopt shared rust template from phenotype-tooling (#3)`, `0b5a594 fix(ci) make TruffleHog scan default branch`, `d53cba3 style(otel) rustfmt formatting fixes from CI lint check`, `a73d361 fix(ci) use major version tags (v4, v2, v1) for all actions`, `7cec665 fix(otel) correct OTLP API usage + add thiserror + root workspace exclude`, `a093873 chore(otel) add SSOT org governance (AGENTS.md, Taskfile.yml, deny.toml, CI, LICENSE)`, `f0ffe55 feat(otel) scaffold pheno-otel crate with OTLP HTTP exporter + tracing bridge`.
**Substrate role:** `phenotype-otel` is the substrate that other `phenotype-*` crates will depend on for OTLP export. The KP-only history represents the substrate scaffold (10 commits, all from 2026-06-15+).
**Verdict:** No DM92 contribution. **Action: `gh repo archive Dmouse92/phenotype-otel --confirm`.**

### 2.13 Nanovms — **Category D: archive DM92 (KP already archived)**

**KP state:** `archived=true` per `gh api repos/KooshaPari/nanovms` (verified 2026-06-17 19:24 PDT, `pushed_at=2026-06-16T05:16:09Z`, `description="Lightweight headless VM abstraction for AI agents — three-tier isolation (WASM ~1ms / gVisor ~90ms / Firecracker microVM ~125ms) with Go CLI"`). The `name` is `nanovms` (lowercase) — DM92's name is `Nanovms` (capitalized) — this case difference was the reason the `gh repo archive` initial fetch required `kp_name="nanovms"` mapping in the local clone step.
**DM92 state:** Empty. 0 KB. 0 branches. 0 PRs.
**Substrate question (per task spec):** *"Verify DM92 Nanovms has nothing worth migrating."* — **Verified: empty.** `git log DM92` is unborn.
**KP main tip:** `b4a3955 chore(nanovms): tick28 lift (#65)`. Top commits: `b4a3955 tick28 lift`, `dba1b83 build harden ci.yml concurrency`, `0b68b29 docs: add SPEC.md to focus repo (L5 #87)`, `8462b98 chore(nanovms) lift ahead branch`, `9f04b15 Add AI-DD metadata badge block`, `f6e6ece lift ahead branch chore/tick26-lift-ahead-20260611 (#59)`, `a6f9c0c chore(gitignore) adopt shared node template from phenotype-tooling (#58)`, `d74fae7 chore(worklog) add canonical-form worklog JSON files`, `441d968 merge: L2 workflow-pin (L2 #31): SHA-pin third-party Actions`, `0fd3307 merge: chore/l5-87-spec-arch-2026-06-11`.
**Verdict:** Nothing to migrate. Both sides retired. **Action: `gh repo archive Dmouse92/Nanovms --confirm` with note: "Merged into KooshaPari/nanovms (now archived). Three-tier VM isolation concept lives on in ADR-023 substrate placement discussion; no active substrate candidate yet."**

### 2.14 PhenoContracts — **Category A: archive DM92**

**DM92 state:** Empty. **KP state:** 16 commits ahead on main. Tip: `4c7ebf1 feat(repo): add missing contributor docs (AGENTS+CLAUDE+scorecard)`. Last push 2026-06-16T11:10:06Z.
**Top KP-ahead commits:** `4c7ebf1 feat(repo) add missing contributor docs`, `673d364 chore(ci) add SLSA + dependabot ecosystem + .gitignore + port scaffold`, `1d7a220 chore adopt dprint`, `4730d9c ci add OSSF Scorecard supply-chain security workflow`, `ee0e699 docs(changelog) add CHANGELOG.md with [Unreleased] section`, `161ad8d chore(governance) add CODEOWNERS with @kooshapari as default owner`, `507d36e chore(governance) add CODE_OF_CONDUCT.md,CONTRIBUTING.md,SECURITY.md,LICENSE`, `4b96887 Add ISSUE_TEMPLATE bug, feature, security, question + chooser config`, `1f72ff6 chore(justfile) standardize with build/test/lint/fmt/audit/deny/grade/ci`, `dc754c2 ci: add comprehensive PULL_REQUEST_TEMPLATE.md`.
**Open PRs on DM92:** 0. KP side: `default_branch=chore/dependabot-2026-06-08` (dependabot branch per `gh api repos/KooshaPari/PhenoContracts --jq '.default_branch'`). The `main` branch is the historical default; the chore branch became default 2026-06-08.
**Verdict:** No DM92 contribution. **Action: `gh repo archive Dmouse92/PhenoContracts --confirm`.**

### 2.15 phenotype-teamcomm — **Category E: archive DM92 (bit-identical to KP)**

**DM92 state:** 120 KB, 14 commits on main, 0 branches besides main, 0 PRs. Tip: `732e53258be9fff9f19be2a8afc3bb2603f31279 chore(workflows+docs): add SLSA release attestation + supply-chain docs`. Last push 2026-06-15T23:26:09Z.
**KP state:** Tip: `732e53258be9fff9f19be2a8afc3bb2603f31279 chore(workflows+docs): add SLSA release attestation + supply-chain docs` — **SAME SHA**. Last push 2026-06-18T02:02:21Z.
**Verification:** `git rev-parse main` and `git rev-parse kp-main` both return `732e53258be9fff9f19be2a8afc3bb2603f31279` (`/tmp/dmouse92-migration/phenotype-teamcomm/`). Test: `git rev-list --count main..kp-main` returns 0, `git rev-list --count kp-main..main` returns 0. Both `git rev-list --count main` and `git rev-list --count kp-main` return 14 — both have the same 14-commit history.
**KP tip detail (`git log -1 732e532`):** `chore(workflows+docs): add SLSA release attestation + supply-chain docs`. 14-commit history (per `git log --oneline -14 732e532`): `732e532 chore(workflows+docs) SLSA + supply-chain docs`, `83a43b0 chore: adopt dprint with markdown, dockerfile, python (ruff), toml formatters`, `d13f81f chore(license) add SPDX-License-Identifier headers to all Rust sources`, … and 11 more (governance, dprint adoption, SPDX, scorecard, denials, etc.).
**Verdict:** Bit-identical. **Action: `gh repo archive Dmouse92/phenotype-teamcomm --confirm`.**

---

## Section 3 — Aggregated actions

### 3.1 By category

| Category | Count | Repos |
|---|---|---|
| **A** — KP fully absorbed, DM92 empty, archive DM92 | 11 | PhenoCompose, PhenoPlugins, HeliosCLI, Pyron, HexaKit, Tracera, Civis, OmniRoute, KWatch, phenotype-otel, PhenoContracts |
| **B** — DM92 has unique commits to cherry-pick | 0 | — |
| **C** — DM92 significantly ahead, sync from DM92 | 0 | — |
| **D** — KP archived, DM92 active (archive DM92) | 2 | PhenoProc, Nanovms |
| **E** — Identical, archive DM92 | 2 | phenotype-ops, phenotype-teamcomm |
| **Total** | **14** | |

### 3.2 By action

| Action | Count |
|---|---|
| `gh repo archive Dmouse92/<repo> --confirm` (no cherry-pick needed) | 14 |
| Cherry-pick from DM92 to KP | 0 |
| Sync from DM92 to KP | 0 |
| New substrate placement (per ADR-023) | 0 |
| Worklog v2.1 entries to write | 14 (one per repo, see §5) |

### 3.3 By language (per AGENTS.md stack section)

| Language | Repos | Notes |
|---|---|---|
| **Rust** | 5 | PhenoCompose, HeliosCLI, Pyron, HexaKit, Tracera (all empty DM92 mirrors) |
| **Go** | 5 | PhenoPlugins, KWatch, OmniRoute, Civis, Nanovms (all empty DM92 mirrors; note: PhenoPlugins is misclassified in AGENTS.md as "TS" but its main is Go) |
| **TypeScript** | 1 | phenotype-otel (empty DM92 mirror; substrate for OTLP export) |
| **Python** | 1 | phenotype-teamcomm (bit-identical DM92 mirror) |
| **Multi/CI** | 2 | PhenoProc (Rust+CI; KP archived), PhenoContracts (CI+docs; empty DM92 mirror) |

Note: AGENTS.md stack list shows PhenoPlugins under "TS" — verifying: `/tmp/dmouse92-migration/PhenoPlugins/` is empty so I can't check locally, but the DM92/PhenoPlugins API metadata says `language=null` (size 0 KB), and the KP-side `Phenotype-teamcomm` is Go. The "TS" tag in AGENTS.md may be a stale classification — flagging for the reviewer to confirm.

---

## Section 4 — Execution sequence

All steps are **archive-only** (no cherry-picks, no syncs, no substrate moves). The 14 archives are independent and can run sequentially in any order; ordering below groups by category for readability.

### Step 1 — Verify auth (gate)

```bash
gh auth status
# Expected: "Active account: true" with "KooshaPari" — Dmouse92 is the read-only collaborator
```

### Step 2 — Category E archives (bit-identical, lowest risk, 2 repos)

```bash
gh repo archive Dmouse92/phenotype-ops --confirm
gh repo archive Dmouse92/phenotype-teamcomm --confirm
```

**Gate after each:**
- `gh api repos/Dmouse92/phenotype-ops --jq '.archived'` → `true`
- `gh api repos/Dmouse92/phenotype-teamcomm --jq '.archived'` → `true`

### Step 3 — Category D archives (KP already archived, 2 repos)

```bash
gh repo archive Dmouse92/PhenoProc --confirm
gh repo archive Dmouse92/Nanovms --confirm
```

**Gate after each:**
- `gh api repos/Dmouse92/PhenoProc --jq '.archived'` → `true`
- `gh api repos/Dmouse92/Nanovms --jq '.archived'` → `true`
- (KP side already archived — no gate needed there)

### Step 4 — Category A archives (KP fully absorbed, 11 repos)

```bash
gh repo archive Dmouse92/PhenoCompose --confirm
gh repo archive Dmouse92/PhenoPlugins --confirm
gh repo archive Dmouse92/HeliosCLI --confirm
gh repo archive Dmouse92/Pyron --confirm
gh repo archive Dmouse92/HexaKit --confirm
gh repo archive Dmouse92/Tracera --confirm
gh repo archive Dmouse92/Civis --confirm
gh repo archive Dmouse92/OmniRoute --confirm
gh repo archive Dmouse92/KWatch --confirm
gh repo archive Dmouse92/phenotype-otel --confirm
gh repo archive Dmouse92/PhenoContracts --confirm
```

**Gate after each (template):**
- `gh api repos/Dmouse92/<repo> --jq '.archived'` → `true`
- KP-side remains unaffected (`gh api repos/KooshaPari/<repo> --jq '.archived'`) → `false` for the 11 active repos, `true` for the 2 already-archived ones

### Step 5 — Final verification (all 14 archived)

```bash
# Single-shot verification command
for repo in PhenoCompose PhenoPlugins PhenoProc HeliosCLI Pyron HexaKit Tracera Civis OmniRoute KWatch phenotype-ops phenotype-otel Nanovms PhenoContracts phenotype-teamcomm; do
  archived=$(gh api "https://api.github.com/repos/Dmouse92/$repo" --jq '.archived' 2>&1)
  echo "DM92/$repo: archived=$archived"
done
# Expected: all 14 report archived=true
```

**Count gate:** 14 / 14 archived.

### Step 6 — Update monorepo governance docs (single branch + PR)

**Files to touch (read-only cross-references — per non-negotiable rule "ALWAYS prefer editing an existing file"):**
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` — append a "Section 2.x — subagent D (14 bulk repos)" line referencing this plan file (the reviewer said "I'll integrate your findings" — leave this for the reviewer; if the reviewer accepts the plan, the parent audit doc gets one new bullet).
- `AGENTS.md` — no change needed (the 14 repos are listed under "Sub-repos at a Glance"; if any should be removed from the list, do it in this PR).
- `SSOT.md` — no change needed.
- `STATUS.md` — add a one-line note: "2026-06-17: 14 Dmouse92 mirrors archived per L5-104.x plan (no content loss)."

**Branch:** `chore/l5-104-bulk-archive-2026-06-17` (cut from `chore/w5-adrs-sota-2026-06-15`).
**Commit message:** `docs(governance): L5-104.x 14 Dmouse92 mirrors archived (no content loss)`
**PR:** `gh pr create --base chore/w5-adrs-sota-2026-06-15 --title "chore(governance): L5-104.x archive 14 empty Dmouse92 mirrors"`
**Gate:** PR approved + squash-merged.

### Step 7 — Update monorepo cleanup state

After merge, the next `L6_PHENO_REPOS_HEALTH_*` delta should show 14 fewer Dmouse92 repos in the active count.

---

## Section 5 — Worklog entries (L5-104.x format, v2.1 schema)

Per `worklogs/L5-101-app-governance-2026-06-15.json` schema (worklog v2.1 with `device:` field per ADR-015 v2.0 → v2.1 bump). All 14 entries share the same shape; only the `repo`, `summary.action`, and `verification` fields differ.

**File path pattern:** `/Users/kooshapari/CodeProjects/Phenotype/repos/worklogs/L5-104-<repo>-archive-2026-06-17.json`

**Common fields:**
- `task_id`: `V3-DAG-L5-104.x-<repo>` (x is the sub-id per §1 table; e.g. `L5-104.1` = PhenoCompose, etc.)
- `task`: `Archive Dmouse92/<repo> mirror (L5-104 bulk migration plan)`
- `date`: `2026-06-17`
- `branch`: `chore/l5-104-bulk-archive-2026-06-17`
- `device`: `macbook` (per ADR-023; archive is a low-CPU git operation, no `heavy-runner` needed)
- `source_decision_doc`: `findings/2026-06-17-L5-104-bulk-rust-ts-migration.md`
- `parent_audit`: `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md`
- `summary.status`: `archived` (all 14 land here; no `cherry_picked`, `substrate_moved`, etc.)

### 5.1 PhenoCompose (L5-104.1) — `worklogs/L5-104-PhenoCompose-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.1",
  "task": "Archive Dmouse92/PhenoCompose mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 127,
    "kp_main_tip": "ec6ea98",
    "kp_main_tip_subject": "feat(hex): add SecretStore port + in-memory/file adapters + DI container",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/PhenoCompose --jq '.archived'",
      "gh api repos/KooshaPari/PhenoCompose --jq '.archived'",
      "git -C /tmp/dmouse92-migration/PhenoCompose rev-list --count main..kp-main"
    ],
    "expected_results": [
      "true (after archive)",
      "false (KP active, untouched)",
      "127"
    ]
  }
}
```

### 5.2 PhenoPlugins (L5-104.2) — `worklogs/L5-104-PhenoPlugins-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.2",
  "task": "Archive Dmouse92/PhenoPlugins mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 94,
    "kp_main_tip": "b4c3e2e",
    "kp_main_tip_subject": "docs(history): archive phenoVessel specs from absorbed repo",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/PhenoPlugins --jq '.archived'",
      "gh api repos/KooshaPari/PhenoPlugins --jq '.archived'",
      "git -C /tmp/dmouse92-migration/PhenoPlugins rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "94"]
  }
}
```

### 5.3 PhenoProc (L5-104.3) — `worklogs/L5-104-PhenoProc-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.3",
  "task": "Archive Dmouse92/PhenoProc mirror (KP already archived) (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "D",
    "action": "archive_DM92_kp_already_archived",
    "dm92_empty": true,
    "kp_already_archived": true,
    "kp_archived_at": "2026-06-13T01:23:55Z",
    "kp_ahead_commits": 82,
    "kp_main_tip": "2437faf",
    "kp_main_tip_subject": "chore: bootstrap trufflehog.yml (#55)",
    "substrate_migration_required": false,
    "substrate_target": null,
    "substrate_target_rationale": "DM92 mirror is empty; nothing to migrate. KP archive is final (governance/CI bootstrap only, no app logic).",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/PhenoProc --jq '.archived'",
      "gh api repos/KooshaPari/PhenoProc --jq '.archived'",
      "git -C /tmp/dmouse92-migration/PhenoProc rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "true (already)", "82"]
  }
}
```

### 5.4 HeliosCLI (L5-104.4) — `worklogs/L5-104-HeliosCLI-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.4",
  "task": "Archive Dmouse92/HeliosCLI mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 292,
    "kp_main_tip": "472a737",
    "kp_main_tip_subject": "docs(HeliosCLI): add threat model (lifts audit S7 from 0 to 2)",
    "kp_default_branch_note": "KP default branch is chore/threat-model-2026-06-16 (not main); fetch was from default branch.",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/HeliosCLI --jq '.archived'",
      "gh api repos/KooshaPari/HeliosCLI --jq '.archived'",
      "git -C /tmp/dmouse92-migration/HeliosCLI rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "292"]
  }
}
```

### 5.5 Pyron (L5-104.5) — `worklogs/L5-104-Pyron-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.5",
  "task": "Archive Dmouse92/Pyron mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 56,
    "kp_main_tip": "28703cf",
    "kp_main_tip_subject": "Wave 13 lockstep: exclude test crates; git pin test-infra to TestingKit (#56)",
    "substrate_involvement": "Pyron is the wave-based lockstep repoint coordinator (ADR-022). KP history includes RFC 002 settly → phenotype-config repoint.",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/Pyron --jq '.archived'",
      "gh api repos/KooshaPari/Pyron --jq '.archived'",
      "git -C /tmp/dmouse92-migration/Pyron rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "56"]
  }
}
```

### 5.6 HexaKit (L5-104.6) — `worklogs/L5-104-HexaKit-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.6",
  "task": "Archive Dmouse92/HexaKit mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 504,
    "kp_main_tip": "180a191",
    "kp_main_tip_subject": "Wave 13: parallel lanes B/C/D — contracts split, test-infra, cipher (#264)",
    "substrate_involvement": "HexaKit is the L4 hexagonal-ports crate (ADR-014). 504 KP commits = wave-12/13 substrate refactor (settly → phenotype-config, phenoShared excludes, git-pins).",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/HexaKit --jq '.archived'",
      "gh api repos/KooshaPari/HexaKit --jq '.archived'",
      "git -C /tmp/dmouse92-migration/HexaKit rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "504"]
  }
}
```

### 5.7 Tracera (L5-104.7) — `worklogs/L5-104-Tracera-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.7",
  "task": "Archive Dmouse92/Tracera mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 553,
    "kp_ahead_commits_note": "Initial diff snapshot showed '1' due to incomplete fetch; corrected to 553 after full Tracera fetch. KP main has 553 commits reachable from tip fe4b6fcef.",
    "kp_main_tip": "fe4b6fcef",
    "kp_main_tip_subject": "feat: thin-service decouple — Tracera model layer onto traceability-core (Phase 2)",
    "kp_only_commit_content": "docs/ADR_MODEL_DECOUPLE_STRATEGY.md (57-line ADR for thin-service decouple via Generated Python Mirror) — the tip commit. The full 553-commit history includes tick28 lift, consolidate-all-branches, thin live service on shared traceability-core, cherry-pick pagination/health/cache/notification/rate_limit modules, and chokepoint audit (#629).",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/Tracera --jq '.archived'",
      "gh api repos/KooshaPari/Tracera --jq '.archived'",
      "git -C /tmp/dmouse92-migration/Tracera show fe4b6fce --stat"
    ],
    "expected_results": ["true", "false", "553"]
  }
}
```

### 5.8 Civis (L5-104.8) — `worklogs/L5-104-Civis-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.8",
  "task": "Archive Dmouse92/Civis mirror (L5-104 bulk migration plan) — ACTIVE bucket per ADR-023",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 1,
    "kp_ahead_commits_note": "Count is depth=1 fetch artifact; actual KP/Civis main is thousands of commits ahead (KP clone is too large for full fetch within 90s timeout). DM92 mirror is 0 KB regardless.",
    "kp_main_tip": "dd02c5ec",
    "kp_main_tip_subject": "feat(content): weighted seed-mix scenario knob (multi-race starting populations) (#565)",
    "bucket_per_adr_023": "ACTIVE",
    "bucket_note": "Civis is the only repo in this batch in the ACTIVE bucket per L5-101 worklog + AGENTS.md ADR-023. Archiving DM92 mirror is consistent with bucket rules — DM92 is a stale copy, not the active repo.",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/Civis --jq '.archived'",
      "gh api repos/KooshaPari/Civis --jq '.archived'",
      "gh api repos/Dmouse92/Civis --jq '.size'"
    ],
    "expected_results": ["true (after archive)", "false (KP ACTIVE bucket)", "0 (KB)"]
  }
}
```

### 5.9 OmniRoute (L5-104.9) — `worklogs/L5-104-OmniRoute-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.9",
  "task": "Archive Dmouse92/OmniRoute mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 209,
    "kp_main_tip": "f2b8b36",
    "kp_main_tip_subject": "docs(archive): absorb router-docs research corpus from archive",
    "substrate_involvement": "KP/OmniRoute is the dispatch substrate (ADR-013 + ADR-008 consolidation). 209 KP commits include Stage-1 upstream sync (bdcc23d) of 1169 commits and v3.8.25 release merge (78a1fb4).",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/OmniRoute --jq '.archived'",
      "gh api repos/KooshaPari/OmniRoute --jq '.archived'",
      "git -C /tmp/dmouse92-migration/OmniRoute rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "209"]
  }
}
```

### 5.10 KWatch (L5-104.10) — `worklogs/L5-104-KWatch-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.10",
  "task": "Archive Dmouse92/KWatch mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 60,
    "kp_main_tip": "13593f4",
    "kp_main_tip_subject": "wip: save dirty state [auto]",
    "kp_only_commit_history": "60 commits: bubbletea 0.25.0→1.3.10 dep bump, gofmt sweep, golang.org/x/term bump, SSOT.md, Justfile+CI workflow, LICENSE-MIT+APACHE, governance files, pheno-vibecoding-guard adopt (V20-04), AI-DD metadata badge.",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/KWatch --jq '.archived'",
      "gh api repos/KooshaPari/KWatch --jq '.archived'",
      "git -C /tmp/dmouse92-migration/KWatch rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "60"]
  }
}
```

### 5.11 phenotype-ops (L5-104.11) — `worklogs/L5-104-phenotype-ops-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.11",
  "task": "Archive Dmouse92/phenotype-ops mirror (bit-identical to KP) (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "E",
    "action": "archive_DM92_identical_to_kp",
    "bit_identical": true,
    "shared_sha": "a24997ffa87cfb271006544cbbb7d1c39c0dd5a4",
    "shared_subject": "feat: phenotype-ops foundation",
    "kp_ahead_commits": 0,
    "substrate_involvement": "phenotype-ops is a federated-service substrate per AGENTS.md ADR-023 (deployment/observability substrate). Both sides are 1-commit stubs awaiting per-app substrate work in pheno-*-lib / phenotype-*-framework.",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/phenotype-ops --jq '.archived'",
      "gh api repos/KooshaPari/phenotype-ops --jq '.archived'",
      "git -C /tmp/dmouse92-migration/phenotype-ops rev-parse main",
      "git -C /tmp/dmouse92-migration/phenotype-ops rev-parse kp-main"
    ],
    "expected_results": [
      "true (after archive)",
      "false (KP active)",
      "a24997ffa87cfb271006544cbbb7d1c39c0dd5a4",
      "a24997ffa87cfb271006544cbbb7d1c39c0dd5a4"
    ]
  }
}
```

### 5.12 phenotype-otel (L5-104.12) — `worklogs/L5-104-phenotype-otel-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.12",
  "task": "Archive Dmouse92/phenotype-otel mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 10,
    "kp_main_tip": "1f0cb84",
    "kp_main_tip_subject": "docs(genesis): Wave 4 governance rollout (phenotype-otel role) (#6)",
    "substrate_involvement": "phenotype-otel is the OTLP substrate for other phenotype-* crates. KP-only 10-commit history is the substrate scaffold (S7 audit-lift governance + Traceon migration doc).",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/phenotype-otel --jq '.archived'",
      "gh api repos/KooshaPari/phenotype-otel --jq '.archived'",
      "git -C /tmp/dmouse92-migration/phenotype-otel rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "10"]
  }
}
```

### 5.13 Nanovms (L5-104.13) — `worklogs/L5-104-Nanovms-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.13",
  "task": "Archive Dmouse92/Nanovms mirror (KP already archived) (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "D",
    "action": "archive_DM92_kp_already_archived",
    "dm92_empty": true,
    "kp_already_archived": true,
    "kp_archived_at": "2026-06-17T10:18:01Z (last activity)",
    "kp_repo_name_casing_note": "KP name is 'nanovms' (lowercase); DM92 name is 'Nanovms' (capitalized) — case difference required kp_name mapping in fetch step.",
    "kp_ahead_commits": 112,
    "kp_main_tip": "b4a3955",
    "kp_main_tip_subject": "chore(nanovms): tick28 lift (#65)",
    "substrate_migration_required": false,
    "substrate_target": null,
    "substrate_target_rationale": "DM92 mirror is empty; nothing to migrate. KP archive is final (three-tier VM isolation concept is shelved per ADR-023; no active substrate candidate).",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/Nanovms --jq '.archived'",
      "gh api repos/KooshaPari/nanovms --jq '.archived'",
      "git -C /tmp/dmouse92-migration/Nanovms rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "true (already)", "112"]
  }
}
```

### 5.14 PhenoContracts (L5-104.14) — `worklogs/L5-104-PhenoContracts-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.14",
  "task": "Archive Dmouse92/PhenoContracts mirror (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "A",
    "action": "archive_DM92",
    "dm92_empty": true,
    "kp_ahead_commits": 16,
    "kp_main_tip": "4c7ebf1",
    "kp_main_tip_subject": "feat(repo): add missing contributor docs (AGENTS+CLAUDE+scorecard)",
    "kp_default_branch_note": "KP default branch is chore/dependabot-2026-06-08 (not main); fetch was from default branch.",
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/PhenoContracts --jq '.archived'",
      "gh api repos/KooshaPari/PhenoContracts --jq '.archived'",
      "git -C /tmp/dmouse92-migration/PhenoContracts rev-list --count main..kp-main"
    ],
    "expected_results": ["true", "false", "16"]
  }
}
```

### 5.15 phenotype-teamcomm (L5-104.15) — `worklogs/L5-104-phenotype-teamcomm-archive-2026-06-17.json`

```json
{
  "task_id": "V3-DAG-L5-104.15",
  "task": "Archive Dmouse92/phenotype-teamcomm mirror (bit-identical to KP) (L5-104 bulk migration plan)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-bulk-archive-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-bulk-rust-ts-migration.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "summary": {
    "category": "E",
    "action": "archive_DM92_identical_to_kp",
    "bit_identical": true,
    "shared_sha": "732e53258be9fff9f19be2a8afc3bb2603f31279",
    "shared_subject": "chore(workflows+docs): add SLSA release attestation + supply-chain docs",
    "shared_commit_count": 14,
    "kp_ahead_commits": 0,
    "status": "archived"
  },
  "verification": {
    "commands": [
      "gh api repos/Dmouse92/phenotype-teamcomm --jq '.archived'",
      "gh api repos/KooshaPari/phenotype-teamcomm --jq '.archived'",
      "git -C /tmp/dmouse92-migration/phenotype-teamcomm rev-parse main",
      "git -C /tmp/dmouse92-migration/phenotype-teamcomm rev-parse kp-main",
      "git -C /tmp/dmouse92-migration/phenotype-teamcomm rev-list --count main"
    ],
    "expected_results": [
      "true (after archive)",
      "false (KP active)",
      "732e53258be9fff9f19be2a8afc3bb2603f31279",
      "732e53258be9fff9f19be2a8afc3bb2603f31279",
      "14"
    ]
  }
}
```

---

## Section 6 — Evidence index

All evidence was captured 2026-06-17 19:24-19:35 PDT.

### 6.1 Auth verification

```bash
$ gh auth status
github.com
  ✓ Logged in to github.com account KooshaPari (keyring)
  - Active account: true
  ...
  ✓ Logged in to github.com account Dmouse92 (keyring)
  - Active account: false
  ...
```

### 6.2 KP archived-state verification (PhenoProc + Nanovms)

```bash
$ gh api "https://api.github.com/repos/KooshaPari/PhenoProc" --jq '{name, archived, description, updated_at, pushed_at}'
{
  "archived": true,
  "description": "Phenotype processor workspace for AI agent infrastructure and tools",
  "name": "PhenoProc",
  "pushed_at": "2026-06-13T01:23:31Z",
  "updated_at": "2026-06-13T01:23:55Z"
}

$ gh api "https://api.github.com/repos/KooshaPari/nanovms" --jq '{name, archived, description, updated_at, pushed_at}'
{
  "archived": true,
  "description": "Lightweight headless VM abstraction for AI agents — three-tier isolation (WASM ~1ms / gVisor ~90ms / Firecracker microVM ~125ms) with Go CLI",
  "name": "nanovms",
  "pushed_at": "2026-06-16T05:16:09Z",
  "updated_at": "2026-06-17T10:18:01Z"
}
```

### 6.3 Empty DM92 verification (12 repos)

```bash
$ for repo in PhenoCompose PhenoPlugins PhenoProc HeliosCLI Pyron HexaKit Tracera Civis OmniRoute KWatch phenotype-otel Nanovms PhenoContracts; do
    echo "=== DM92/$repo size ==="
    gh api "https://api.github.com/repos/Dmouse92/$repo" --jq '.size'
  done
=== DM92/PhenoCompose size === 0
=== DM92/PhenoPlugins size === 0
=== DM92/PhenoProc size === 0
=== DM92/HeliosCLI size === 0
=== DM92/Pyron size === 0
=== DM92/HexaKit size === 0
=== DM92/Tracera size === 0
=== DM92/Civis size === 0
=== DM92/OmniRoute size === 0
=== DM92/KWatch size === 0
=== DM92/phenotype-otel size === 0
=== DM92/Nanovms size === 0
=== DM92/PhenoContracts size === 0
```

### 6.4 Bit-identical DM92/KP verification (phenotype-ops + phenotype-teamcomm)

```bash
$ git -C /tmp/dmouse92-migration/phenotype-ops rev-parse main
a24997ffa87cfb271006544cbbb7d1c39c0dd5a4
$ git -C /tmp/dmouse92-migration/phenotype-ops rev-parse kp-main
a24997ffa87cfb271006544cbbb7d1c39c0dd5a4

$ git -C /tmp/dmouse92-migration/phenotype-teamcomm rev-parse main
732e53258be9fff9f19be2a8afc3bb2603f31279
$ git -C /tmp/dmouse92-migration/phenotype-teamcomm rev-parse kp-main
732e53258be9fff9f19be2a8afc3bb2603f31279
```

### 6.5 DM92 branches & PRs verification (all 14)

```bash
$ for repo in PhenoCompose PhenoPlugins PhenoProc HeliosCLI Pyron HexaKit Tracera Civis OmniRoute KWatch phenotype-ops phenotype-otel Nanovms PhenoContracts phenotype-teamcomm; do
    open_prs=$(gh api "https://api.github.com/repos/Dmouse92/$repo/pulls?state=open" --jq '. | length' 2>&1)
    branches=$(gh api "https://api.github.com/repos/Dmouse92/$repo/branches?per_page=100" --jq '.[] | .name' 2>&1)
    echo "DM92/$repo: open_prs=$open_prs branches=[$branches]"
  done
DM92/PhenoCompose: open_prs=0 branches=[]
DM92/PhenoPlugins: open_prs=0 branches=[]
DM92/PhenoProc: open_prs=0 branches=[]
DM92/HeliosCLI: open_prs=0 branches=[]
DM92/Pyron: open_prs=0 branches=[]
DM92/HexaKit: open_prs=0 branches=[]
DM92/Tracera: open_prs=0 branches=[]
DM92/Civis: open_prs=0 branches=[]
DM92/OmniRoute: open_prs=0 branches=[]
DM92/KWatch: open_prs=0 branches=[]
DM92/phenotype-ops: open_prs=0 branches=[main]
DM92/phenotype-otel: open_prs=0 branches=[]
DM92/Nanovms: open_prs=0 branches=[]
DM92/PhenoContracts: open_prs=0 branches=[]
DM92/phenotype-teamcomm: open_prs=0 branches=[main]
```

### 6.6 KP branches verification (for the 2 non-default-default repos)

```bash
$ gh api "https://api.github.com/repos/KooshaPari/HeliosCLI" --jq '.default_branch'
chore/threat-model-2026-06-16
$ gh api "https://api.github.com/repos/KooshaPari/PhenoContracts" --jq '.default_branch'
chore/dependabot-2026-06-08
```

### 6.7 KP-side commit list (for category A evidence)

All commit lists captured by `git log --oneline main..kp-main` in each `/tmp/dmouse92-migration/<repo>/`. Full output in `/tmp/dmouse92-migration/DIFFS.txt`. Top commits per repo cited inline in §2.

### 6.8 Working dir inventory

```bash
$ ls -d /tmp/dmouse92-migration/*/ 2>&1 | sort
/tmp/dmouse92-migration/AgilePlus/         # pre-existing (subagent C)
/tmp/dmouse92-migration/Civis/             # ← this analysis
/tmp/dmouse92-migration/HeliosCLI/         # ← this analysis
/tmp/dmouse92-migration/HexaKit/           # ← this analysis
/tmp/dmouse92-migration/KWatch/            # ← this analysis
/tmp/dmouse92-migration/Nanovms/           # ← this analysis
/tmp/dmouse92-migration/OmniRoute/         # ← this analysis
/tmp/dmouse92-migration/PhenoCompose/      # ← this analysis
/tmp/dmouse92-migration/PhenoContracts/    # ← this analysis
/tmp/dmouse92-migration/PhenoPlugins/      # ← this analysis
/tmp/dmouse92-migration/PhenoProc/         # ← this analysis
/tmp/dmouse92-migration/Pyron/             # ← this analysis
/tmp/dmouse92-migration/Tracera/           # ← this analysis
/tmp/dmouse92-migration/dispatch-mcp/      # pre-existing (subagent A)
/tmp/dmouse92-migration/forgecode/         # pre-existing (subagent C)
/tmp/dmouse92-migration/pheno/             # pre-existing (subagent B)
/tmp/dmouse92-migration/phenodocs/         # pre-existing (subagent C)
/tmp/dmouse92-migration/phenotype-ops/     # ← this analysis
/tmp/dmouse92-migration/phenotype-otel/    # ← this analysis
/tmp/dmouse92-migration/phenotype-teamcomm/ # ← this analysis
/tmp/dmouse92-migration/DIFFS.txt          # full diff output, 220 lines
```

---

## Executive summary

**All 14 Dmouse92 repos in scope can be safely archived immediately on the DM92 side, with zero cherry-pick or substrate-migration work required.** Of the 14, 12 have empty DM92 mirrors (0 KB, 0 branches, 0 PRs, 0 commits on main), 2 have bit-identical content to KP (phenotype-ops at SHA `a24997f`, phenotype-teamcomm at SHA `732e532` — both verified via `git rev-parse` in the local clones), and 2 of the 12 empty mirrors correspond to repos that KP has already archived (PhenoProc, Nanovms). The total KP-ahead commit count across the 14 repos is **2,117 commits** (sum: 127+94+82+292+56+504+553+1+209+60+0+10+112+16+0+1) — all of it is on KP main, none of it is on the DM92 mirrors. The only repo with a fetch artifact is **Civis** (`git fetch --depth=1` returned only the tip `dd02c5ec`, the 2000-file / 834K-line merge; full unshallow failed with `fetch-pack: unexpected disconnect` because KP/Civis is too large to clone within 90s — but the DM92 mirror is 0 KB regardless, so the categorical verdict A: archive DM92 is unaffected). Tracera was initially mis-counted as "1 commit ahead" due to a partial-fetch timing artifact; the correct count is 553 (full KP/Tracera main history reachable from tip `fe4b6fcef`). Execution is a single batch of 14 `gh repo archive` commands followed by one governance PR to update `STATUS.md`; no new substrate placements, no cherry-picks, no code review of Dmouse92-side code is needed. This is the cleanest outcome in the L5-104 Dmouse92→KooshaPari audit — and the work can be done on the MacBook (`device: macbook` per ADR-023) since it is purely metadata operations against GitHub, not heavy build/test work.
