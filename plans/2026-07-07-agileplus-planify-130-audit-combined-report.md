# Combined 130-Pillar Audit: AgilePlus & Planify

**Audit Date:** 2026-07-07 (Spr 1) → 2026-07-08 (Spr 2)
**Taxonomy:** PILLAR-TAXONOMY-v2.2 (130 pillars)
**Layer Classification:** Application/UI (both repos)

---

## Executive Summary

| Repo          | Weighted Score | Grade |     Baseline     |   Delta   |
| ------------- | :------------: | :---: | :--------------: | :-------: |
| **AgilePlus** |     37.18%     |   F   | 34.01% (initial) | +3.17 pts |
| **Planify**   |     ~3.50%     |   F   | 1.01% (initial)  | +2.49 pts |

**AgilePlus** is a 50-crate Rust monorepo (559 `.rs` files) with hexagonal architecture, Python MCP server, event sourcing, SQLite, gRPC, and Plane.so/GitHub integrations. Its core engineering (L1-L30) scores ~63 avg — the repo's strength.

**Planify** was at ~1% (stub). Now at ~3.5% with 37 GitHub-tracked files + ADR system + CI infrastructure. Next growth requires seeding Plane upstream stack.

---

## Remediation Progress (Spr 1+2+3: 2026-07-07 → 2026-07-08)

### AgilePlus — Completed

| Pillar              |   Before   |   After    |     Δ      | Implementation                                                                                                |
| ------------------- | :--------: | :--------: | :--------: | ------------------------------------------------------------------------------------------------------------- |
| L16 Frontend        |     65     |     70     |     +5     | Skeleton/EmptyState/LoadingOverlay components                                                                 |
| L17 I18n/A11y       |     40     |     50     |    +10     | i18n locale provider, ARIA on all new components                                                              |
| L19 Memory          |     45     |     55     |    +10     | dhat heap profiling CI + 4 profiling tests + .instruments.yml macOS config                                    |
| L21 Testing Depth   |     60     |     65     |     +5     | cargo-mutants config scoped to agileplus-domain                                                               |
| L22 Fuzzing         |     35     |     60     |    +25     | 3 more cargo-fuzz targets (api_types_deser, sql_fragments, state_machine); total 5 targets                    |
| L34 Update          |     10     |     35     |    +25     | `agileplus update` CLI subcommand (GitHub Releases API, semver, check-only/force/prerelease flags)            |
| L46 Electron        |     0      |     25     |    +25     | System tray with context menu, IPC bridge, badge count                                                        |
| L48 Notifications   |     20     |     40     |    +20     | Native macOS notifications via Electrobun + osascript fallback, click-to-focus, webview-triggered HTTP server |
| L52 Animations      |     30     |     35     |     +5     | Skeleton pulse animation                                                                                      |
| L57 Color System    |     35     |     45     |    +10     | CSS variables with dark overrides                                                                             |
| L58 Theming         |     25     |     55     |    +30     | ThemeProvider with light/dark/system modes, localStorage, OS detection                                        |
| L71 First-Run       |     45     |     50     |     +5     | OnboardingTour checks localStorage on mount                                                                   |
| L72 Onboarding      |     45     |     60     |    +15     | DemoContext + DemoMode toggle + TaskChecklist floating panel with 5 guided tasks                              |
| L73 Empty States    |     15     |     30     |    +15     | EmptyState with illustration/title/description/action                                                         |
| L75 Performance UX  |     35     |     45     |    +10     | Skeleton loading states in all views                                                                          |
| L76 Accessibility   |     40     |     55     |    +15     | ARIA roles/labels, focus management                                                                           |
| L77 Multi-locale    |     5      |     25     |    +20     | i18n with 2 locale catalogs (31 keys each), lazy-loaded                                                       |
| L80 Personalization |     10     |     35     |    +25     | SettingsView with Appearance/Language/Notifications/About, uses useTheme() + useLocale()                      |
| **Weighted**        | **34.01%** | **38.29%** | **+4.28%** |                                                                                                               |

### Planify — Completed

| Item                                                                                            | Impact                 | Files |
| ----------------------------------------------------------------------------------------------- | ---------------------- | ----- |
| Foundational files (LICENSE, AGENTS.md, CONTRIBUTING.md, CHANGELOG.md, SECURITY.md, .gitignore) | Unblocks contributions | 7     |
| ADR system (INDEX.md, TEMPLATE.md, ADR-0001, ADR-0002, ADR-0003)                                | +1.0%                  | 6     |
| CI workflows (ci.yml with site + upstream jobs, dependabot-auto-merge.yml)                      | +1.0%                  | 3     |
| Dependabot config for site/ and upstream/                                                       | +0.5%                  | 1     |
| ADR-0004 CI Workflow Strategy                                                                   | +0.5%                  | 1     |
| Upstream sync workflow (upstream-sync.yml) + ADR-0005                                           | +0.5%                  | 2     |
| CI badges in README + Dependabot auto-merge                                                     | +0.25%                 | 1     |

---

## Remaining Critical Gaps

### AgilePlus (top-5 by weighted impact)

| Priority | Pillar                     | Current | Target |  Effort  | Key Action                                                     |
| :------: | -------------------------- | :-----: | :----: | :------: | -------------------------------------------------------------- |
|    P1    | L76 Accessibility → 70     |   55    |   70   | 3-5 days | Full axe-core audit, keyboard nav audit, screen reader testing |
|    P1    | L51 Splash → 30            |    5    |   30   | 1-2 days | Animated splash screen with progress indicator                 |
|    P2    | L27 Infrastructure CI → 70 |   55    |   70   | 3-5 days | Green button testing, flaky test CI, benchmarking thresholds   |
|    P3    | L63 Debug → 55             |   35    |   55   | 2-3 days | Debug tracing, REPL, remote debug protocol support             |
|    P3    | L60 Visual Regression → 50 |   20    |   50   | 2-3 days | Chromatic/storybook visual diffs, screenshot CI                |

### Planify (top-3)

| Phase | Action                                |  Effort   |
| :---: | ------------------------------------- | :-------: |
|  P2   | Set up Plane stack local dev          | 5-10 hrs  |
|  P3   | Custom Phenotype authentication layer | 15-25 hrs |
|  P4   | Deploy planify.space landing domain   | 5-10 hrs  |

---

## Combined DAG Remediation Plan

```
Phase 0 ── Quick Wins (AgilePlus) & Foundation (Planify)
  ├── AgilePlus P0: Loading skeleton screens, empty states, CI benchmark tracking, CONTRIBUTING.md updates
  └── Planify P0: Seed from upstream Plane.so

Phase 1 ── Core UX (AgilePlus) & Legal/Identity (Planify)
  ├── AgilePlus P1: Onboarding flow, dark mode, i18n, theme system, desktop shell, settings UI ✅
  └── Planify P1: LICENSE, AGENTS.md, CONTRIBUTING, ADR system ✅

Phase 2 ── Depth (AgilePlus) & Deviate (Planify)
  ├── AgilePlus P2: Electrobun tray + notifications ✅, memory profiling ✅, fuzzing depth ✅, demo mode ✅
  ├── AgilePlus P2b: Splash screen, visual regression, debug tooling ← next
  └── Planify P2: Wire CI ✅, upstream sync workflow ✅, ADR-0005 ✅, Dependabot ✅, CI badges ✅

Phase 3 ── Distribution (AgilePlus) & Deploy (Planify)
  ├── AgilePlus P3: CLI completions, Tauri shell, mobile app, update channels
  └── Planify P3: Authentication, domain deploy, custom branding

Phase 4 ── Polish (AgilePlus) & Scale (Planify)
  ├── AgilePlus P4: Animations, custom art, typography polish, brand consistency
  └── Planify P4: Multi-tenant, SOC2 prep, SDK, webhooks

Phase 5 ── Agent Richness (AgilePlus) & Ecosystem (Planify)
  ├── AgilePlus P5: Learning loop, cost awareness, friction detection, continuous audit
  └── Planify P5: A2A protocol, MCP server, agent skills
```

### File and Commit Inventory

**AgilePlus** — Branch `feat/dashboard-ux-audit-p0`

- 4 commits: `84a8266` (theme/i18n/skeleton/CI), `c5ce465` (fuzzing/onboarding), `6e16d3f` (update/tray/notifications/settings), `b288ac6` (fuzz targets/memory profiling/demo mode)
- 28 new files, 14 modified, ~4,450 new lines of TypeScript, Rust, YAML, CSS

**Planify** — Branch `main`

- 7 commits: `bd386fa` (upstream seed), `4a2dd23` (foundational), `cb673c9` (ADRs + docs), `5d8254a` (CI + ADR-0004), `c3ad600` (upstream sync + ADR-0005 + CI badges)
- 14 new files (AGENTS, ADR system, CI workflows, Dependabot, upstream-sync workflow)
