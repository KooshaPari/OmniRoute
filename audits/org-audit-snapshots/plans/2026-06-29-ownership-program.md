# Phenotype Ownership Program — Master Scope & Plan (2026-06-29)

Reconstructed from this session's full intent. Standing autonomous mandate: own, audit, harden, and advance the owned Phenotype repos to SOTA, with strict quality.

## Ownership map
**OWNED — audit (A-Z) + work (88):** agentapi-plusplus, Agentora, Apisync, argis-extensions, AuthKit, Authvault, Benchora, bifrost, BytePort, clap-ext, cliproxyapi-plusplus, Configra, Conft, context-mode, context-mode-plusplus, DataKit, Eidolon, Eventra, FocalPoint, forgecode, helios-cli, HeliosLab, HexaKit, Httpora, hwLedger, KDesktopVirt, kmobile, KodeVibe, localbase3, Logify, Melosviz, nanovms, OmniRoute, pheno, pheno-cdylib-bridge, pheno-context, pheno-forge-plugins, pheno-forge-smoke, pheno-runtime-config, pheno-tracing, phenoAI, PhenoCompose, PhenoContracts, phenodag, phenoData, phenoDesign, phenodocs, phenoEvents, PhenoHandbook, phenokits-commons, PhenoObservability, PhenoPlugins, phenoResearchEngine, PhenoRuntime, PhenoSpecs, phenotype-apps, phenotype-contracts, phenotype-gfx, phenotype-go-sdk, phenotype-infra, phenotype-journeys, phenotype-landing, phenotype-ops, phenotype-org-audits, phenotype-pm-core, phenotype-python-sdk, phenotype-registry, phenotype-router-spec, phenotype-tooling, phenoUtils, PhenoVCS, Pine, PlayCua, PlusForges, PolicyStack, portage, Quillr, rich-cli-kit, sharecli, Sidekick, Stashly, substrate, substrate-adapters-bundle, Tasken, TestingKit, thegent, Tokn, Tracely.

**EXCLUDED:**
- Other owners (skip): AgilePlus, Tracera, Civis, Dino, WorldSphereMod, Compound-Spheres-3D(+Backup).
- Paused (skip): QuadSGM, Parpoura, KaskMan, GDK, AtomsBot, KWatch.
- Ignore niche standalone (skip): eyetracker, agent-user-status. **Melosviz KEPT** (melosviz is depended-on).

## Flagship SOTA products (own the product, not just the code)
- **forgecode** → SOTA agentic coding CLI/TUI.
- **OmniRoute** → SOTA LLM model router.
For each flagship: PM-level user/market/competitor research + technical/"research" sweep (arxiv, GitHub, blogs, books) → identify SOTA features → execute optimally.

## Quality bar (non-negotiable, every repo)
- **85–100% coverage**, all tiers: unit → integration → e2e → perf → chaos (+ property/fuzz where apt).
- **Strictest quality gate**, "all running" form: NO skipped/disabled tests; NO reliance on a downstream "quality-full" or other deeper command — the DEFAULT quality gate must itself be the strictest, all-checks-on form.
- Forward-only; no suppressions without rule+justification+tracking ref.

## Phased DAG
- **P1 — Registry + ecosystem map** (`phenotype-registry`): audit, realign/correct the ecosystem map to reality (deps, archetypes, ownership, dup map). UNBLOCKS the correct work-plan. Predecessor: none.
- **P2 — A-Z 100+ pillar audit** of the 88: resume the L0–L40+ framework (v37/v38), score each repo, produce per-repo remediation backlog. Predecessor: P1 (correct map first).
- **P3 — Remediation to quality bar**: per-repo, lift to 85–100% cov + strict gate; fix audit findings. Predecessor: P2 per repo.
- **P4 — Flagship SOTA**: forgecode + OmniRoute product research → feature identification → execution. Runs parallel to P2/P3.
- **P5 — In-flight finish**: e.g. Cloudflare retry convergence (OmniRoute/cliproxy 520/522/524/529), forgecode/OmniRoute open follow-ups.

## Operating rules
- Parent = coordinator; delegate substantive work to subagents; ground-truth verify every "green" claim with real build/test.
- Correct-repo worktrees (`cd <repo>; git worktree add /tmp/<x> -b <branch> origin/main`); sanity-gate; NEVER push to main directly / reset --hard / force-push.
- PR base ALWAYS `--repo KooshaPari/<repo>` (gh defaults to upstream forks — verify + reopen strays).
- Admin-merge (CI billing-blocked). Checkpoint-push long multi-step lanes (API flakiness).
- Surface (don't auto-decide) genuine new sponsor decisions (new repos, destructive ops, cross-owner work).

## NOT mine to do
- `kill 43080` (process kill — forbidden by global rules even under "do all").
- Excluded repos above.
