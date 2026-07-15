# Migration Checklist -- sequence every step

Order matters. Do not parallelize; some steps depend on others.

## Phase 0 -- preconditions

- [ ] Confirm the GitHub CLI is authenticated for the KooshaPari org:
      gh auth status
- [ ] Confirm write access on every repo touched in Phases 1-3:
      gh repo view KooshaPari/AuthKit --json viewerPermission
      gh repo view KooshaPari/Authvault --json viewerPermission
      gh repo view KooshaPari/AtomsBot --json viewerPermission
      gh repo view KooshaPari/GDK --json viewerPermission
      gh repo view KooshaPari/KaskMan --json viewerPermission
      gh repo view KooshaPari/phenotype-org-audits --json viewerPermission
      gh repo view KooshaPari/phenotype-apps --json viewerPermission
- [ ] Confirm the session folder exists:
      /Users/kooshapari/CodeProjects/Phenotype/repos/docs/sessions/20260705-fork-reqwrite-audit/
      and this file (04-triage/05-MIGRATION-CHECKLIST.md) is in it.

## Phase 1 -- Authvault DELETE (one commit, one push)

- [ ] cd /Users/kooshapari/CodeProjects/Phenotype/repos/Authvault
- [ ] In AuthKit, write migrations/from-authvault.md documenting the
      toml/git snippet from Authvault's own README.
- [ ] In AuthKit/specs/requirements/authkit-frnfr.md (or equivalent),
      ensure the traceability table covers every FR-AUTHV-* from
      Authvault/FRs/. If any FR is missing, port the spec text.
- [ ] Commit in AuthKit:
      chore(docs): add from-authvault migration guide + port FRs
- [ ] Push AuthKit.
- [ ] In Authvault, add a final CHANGELOG.md entry referencing the merge
      and tag authvault-final. Do NOT touch the code.
- [ ] git tag authvault-final in Authvault.
- [ ] gh repo edit KooshaPari/Authvault --enable-issues=false
- [ ] On the GitHub web UI: Settings -> Danger Zone -> Archive this repository.
- [ ] Worktree copies (Authvault-2nd, -3rd): leave alone. They become
      inert backups.

## Phase 2 -- AtomsBot, GDK, KaskMan ARCHIVE (strict pause)

See 04-ARCHIVE-PLAN.md for the full per-repo actions. Sequenced:

### 2a -- AtomsBot (canonical)
- [ ] cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-apps/AtomsBot-2nd
- [ ] Prepend banner to README.md (see 04-ARCHIVE-PLAN.md).
- [ ] Commit: chore: strict-pause archive notice (AtomsBot, 2026-07-05).
- [ ] Push to KooshaPari/AtomsBot (the top-level repo, not the worktree).
      Update the top-level KooshaPari/AtomsBot/README.md with the same banner.
- [ ] gh repo edit KooshaPari/AtomsBot --description "[ARCHIVED]..." --add-topic ...
- [ ] On the GitHub web UI: Settings -> Danger Zone -> Archive this repository.

### 2b -- KaskMan
- [ ] cd /Users/kooshapari/CodeProjects/Phenotype/repos/KaskMan
- [ ] Prepend banner to README.md.
- [ ] Vendor claude-flow and dashboard-*.js into
      phenotype-org-audits/archive/kaskman/ (preservation snapshot).
- [ ] Commit: chore: strict-pause archive notice (KaskMan, 2026-07-05).
- [ ] Push.
- [ ] gh repo edit KooshaPari/KaskMan --description "[ARCHIVED]..." --add-topic ...
- [ ] GitHub web UI: Archive.

### 2c -- GDK mirrors (all copies)
- [ ] For each empty GDK worktree copy, paste the banner into a new
      README.md (or delete the dir if the parent allows).
- [ ] The canonical phenotype-apps/GDK/README.md already has the banner;
      no change.

### 2d -- AtomsBot worktree copies
- [ ] Same as 2c, but for each AtomsBot-Nth/ empty copy.

## Phase 3 -- phenotype-org-audits and phenotype-apps SPINE-promote

### 3a -- phenotype-org-audits
- [ ] Add the spine charter block (see 02-ORG-AUDITS-PLAN.md) to the top
      of phenotype-apps/README.md, above the AI-DD-META block.
- [ ] Replace the tooling/aggregator/ symlink with a vendored copy.
- [ ] Restructure audits/<YYYY-MM-DD>/ into audits/<YYYY>/<YYYY-MM-DD>/.
- [ ] Create spines/REGISTRY.md listing all seven spines.
- [ ] Open an issue/PR against substrate and AgilePlus documenting the
      "consumes-registry" dependency.
- [ ] Commit, push.

### 3b -- phenotype-apps
- [ ] Add the spine charter block to phenotype-apps/README.md.
- [ ] Prune the *-Nth duplicates older than 90 days. Move pruned copies
      under phenotype-org-audits/archive/<app>/.
- [ ] Move the apps-launcher (Cargo.toml+go.mod) into launcher/.
- [ ] Create catalog/apps.toml (machine-readable source of truth).
- [ ] Open an issue/PR against BytePort for the
      "byteport apps pull phenotype-apps:catalog/apps.toml" integration.
- [ ] Commit, push.

## Phase 4 -- update the registry

- [ ] In phenotype-org-audits/inventory/AUTHORITATIVE_REPO_INVENTORY.md,
      update the status of:
      - Authvault -> ARCHIVED, redirects to AuthKit
      - AtomsBot -> ARCHIVED, strict pause
      - KaskMan -> ARCHIVED, strict pause
      - GDK -> ARCHIVED, strict pause (already correct, verify)
- [ ] In phenotype-org-audits/inventory/deleted_traces.md, add the
      per-repo decision rationale and pointer to this session.
- [ ] In phenotype-org-audits/metrics/SYSTEMIC_ISSUES.md, add a new
      section "Q3 2026 portfolio decisions" with the cross-repo impact.
- [ ] In phenotype-org-audits/metrics/UPLIFT_REPORT.md, add the entry
      "Q3 2026: 3 archived, 2 promoted to spine" so the longitudinal
      trend is preserved.

## Phase 5 -- verification

- [ ] Re-run rg -l 'Authvault' over the polyrepo (excluding the audit/
      coverage/ dist/ session/ .tmp* abm_trace.log dirs) and confirm every
      remaining hit is either:
      (a) inside the docs/sessions/2026-*/ audit folder, OR
      (b) inside phenotype-org-audits/inventory/ or audits/, OR
      (c) inside Authvault/ (the archived copy itself)
- [ ] Re-run the same for AtomsBot, KaskMan, GDK. Same expected result.
- [ ] gh repo view KooshaPari/Authvault --json isArchived -> true
- [ ] gh repo view KooshaPari/AtomsBot --json isArchived -> true
- [ ] gh repo view KooshaPari/KaskMan --json isArchived -> true
- [ ] gh repo view KooshaPari/phenotype-org-audits --json isArchived -> false
- [ ] gh repo view KooshaPari/phenotype-apps --json isArchived -> false
