# Planify 130-Pillar Audit Report

**Date:** 2026-07-07
**Repo:** [KooshaPari/Planify](https://github.com/KooshaPari/Planify) (stub)
**Upstream:** [makeplane/plane](https://github.com/makeplane/plane)
**Layer:** Application/UI (Web Frontend)
**Taxonomy:** PILLAR-TAXONOMY-v2.md (v2.2)
**Auditor:** Forge (Comprehensive 130-pillar audit engine)

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| **Weighted Score** | **1.01%** |
| **Raw Unweighted Score** | 1.12% |
| **Letter Grade** | **F** |
| **Total Pillars** | 130 |
| **Non-Zero Pillars** | 16 of 130 (12.3%) |
| **Avg Score (non-zero)** | 10.3/100 |
| **State** | **Stub** — 2 files, 54 lines total |

Planify is a **stub repository** containing only a README.md (34 lines) and UPSTREAM.md (20 lines). It has not been seeded from upstream Plane.so. The weighted score of 1.01% (grade F) is expected and appropriate for a repo at this stage — it has no source code, no CI, no dependencies, no tests, no components. The only value accumulated is in documentation metadata: the README describes the repo's purpose, architecture, and relationship to the Phenotype ecosystem.

### Top Scoring Pillars

| Pillar | Name | Score | Why |
|---|---|---|---|
| L91 | README Quality | 30 | Has purpose, architecture overview, setup steps, ecosystem links |
| L61 | Contributing | 15 | 4-step setup documented; links to upstream |
| L93 | Architecture Docs | 15 | README covers Planify/AgilePlus relationship |
| L25 | Vendor Lockin | 10 | Fork relationship explicitly documented; upstream seeding pattern |
| L69 | Documentation | 10 | Two documentation files covering seeding and purpose |
| L97 | Roadmap | 10 | Stub status acknowledged; seeding plan documented |
| L99 | Community | 10 | Links to AgilePlus, upstream Plane.so, phenotype.space |

### Severity Distribution

| Severity | Count | Pillars Affected |
|---|---|---|
| **Critical** | 16 | L1 Architecture, L2 Dev Loop, L3 Agent Loop, L4 Observability, L5 Security, L6 Performance, L7 Extensibility, L9 Complexity, L10 Type Safety, L11 Dependencies, L12 Error Handling, L13 Logging, L14 Data Layer, L15 API Surface, L16 Frontend, L17 I18n/A11y, L18 Concurrency, L19 Memory, L20 Config, L21 Testing, L62 Testing for Devs, L76 Accessibility |
| **High** | 25 | L8 Compliance, L23 Release, L24 Migration, L27 Infrastructure, L29 Monitoring, L31 Packaging, L33 Install, L35 Reproducibility, L44 Web App, L57 Color System, L59 Brand Consistency, L63 Debug, L68 Tooling Integration, L71 First-Run, L72 Onboarding, L74 Error UX, L75 Performance UX, L82 Bug Detection, L86 Continuous Audit, L116 Upgrade Path |
| **Medium** | 37 | L25 Vendor Lockin, L30 Onboarding, L32 Distribution, L34 Update, L36 Portability, L37 Container Quality, L40 Installer UX, L41 CLI UX, L42 Desktop App, L43 Mobile App, L48 Notifications, L51 Splash Screen, L52 Animations, L53 Custom Art, L55 Icons, L56 Typography, L58 Theming, L60 Visual Regression, L65 Refactor Safety, L67 Knowledge Sharing, L70 Issues/PRs, L73 Empty States, L77 Multi-locale, L78 Multi-platform, L79 Offline-first, L80 Personalization, L81 Solo-Operation, L83 User Story Gap, L90 Explainability, L92 API Docs, L96 ADR System, L98 Changelog, L100 Support, L113 Multi-tenancy, L117 Webhooks/API, L118 SDK, L120 Performance Budget |
| **Low** | 52 | L22 Fuzzing, L26 Event Driven, L28 Cost Efficiency, L38 Signing, L39 Artifact Storage, L45 Tauri Shell, L46 Electron, L47 System Integration, L49 Update Channels, L50 Hardware/Edge, L54 Animated Art, L64 Profiling, L66 Code Search, L84 Friction Detection, L85 Polish Awareness, L87 Self-Healing, L88 Learning Loop, L89 Cost Awareness, L94 Tutorial Series, L95 Cookbook, L101-L110 (Compute), L111-L112, L114-L115, L119, L121-L130 (FFI) |

---

## 2. Layer-Weighted Scoring Breakdown

Planify is audited as **Application/UI** layer. The per-pillar weights from PILLAR-TAXONOMY-v2.md § Per-Layer Priority Map are applied.

### Weight Table

| Range | Category | Weight | Raw Sum | Raw Max | Weighted Sum | Weighted Max | Weighted % |
|---|---|---|---|---|---|---|---|
| L1–L10 | Core Engineering | **0.8** | 7 | 1000 | 5.6 | 800 | 0.70% |
| L11–L20 | Deps/Errors/Logging/Config/Data | **1.0** | 0 | 1000 | 0.0 | 1000 | 0.00% |
| L21–L30 | Testing/Release/Migration/Infra/Cost | **1.0** | 22 | 1000 | 22.0 | 1000 | 2.20% |
| L31–L40 | Deployment & Packaging | **0.8** | 2 | 1000 | 1.6 | 800 | 0.20% |
| L41–L50 | Distribution Channels | **2.0** | 2 | 1000 | 4.0 | 2000 | 0.20% |
| L51–L60 | Visual Polish | **2.0** | 5 | 1000 | 10.0 | 2000 | 0.50% |
| L61–L70 | Developer Experience (AX Dev) | **1.0** | 35 | 1000 | 35.0 | 1000 | 3.50% |
| L71–L80 | End-User Experience (AX User) | **2.0** | 0 | 1000 | 0.0 | 2000 | 0.00% |
| L81–L90 | Agent Readiness | **1.0** | 5 | 1000 | 5.0 | 1000 | 0.50% |
| L91–L100 | Documentation & Community | **1.0** | 65 | 1000 | 65.0 | 1000 | 6.50% |
| L101–L110 | Compute-Specific | **0.2** | 0 | 1000 | 0.0 | 200 | 0.00% |
| L111–L120 | Beyond Compute | **1.0** | 2 | 1000 | 2.0 | 1000 | 0.20% |
| L121–L130 | Cross-Platform Native FFI | **1.0** | 0 | 1000 | 0.0 | 1000 | 0.00% |
| **Total** | | | **145** | **13000** | **150.2** | **14800** | **1.01%** |

### Category Heat Map

```
L1–L10  Core Engineering       ████░░░░░░░░░░░░░░░░  0.7%
L11–L20 Deps/Errors/Config     ░░░░░░░░░░░░░░░░░░░░  0.0%
L21–L30 Testing/Release        ███████████░░░░░░░░░░  2.2%
L31–L40 Deployment/Packaging   █░░░░░░░░░░░░░░░░░░░  0.2%
L41–L50 Distribution Channels  █░░░░░░░░░░░░░░░░░░░  0.2%
L51–L60 Visual Polish          ██░░░░░░░░░░░░░░░░░░  0.5%
L61–L70 Developer Experience   █████████████████░░░░  3.5%
L71–L80 End-User Experience    ░░░░░░░░░░░░░░░░░░░░  0.0%
L81–L90 Agent Readiness        ██░░░░░░░░░░░░░░░░░░  0.5%
L91–L100 Documentation         █████████████████████  6.5%  ← best category
L101–L110 Compute-Specific     ░░░░░░░░░░░░░░░░░░░░  0.0%
L111–L120 Beyond Compute       █░░░░░░░░░░░░░░░░░░░  0.2%
L121–L130 Native FFI           ░░░░░░░░░░░░░░░░░░░░  0.0%
```

The best-scoring category is **Documentation & Community (L91–L100)** at 6.5%, entirely driven by the README and UPSTREAM.md files. All other categories are below 4%.

---

## 3. Gaps & Flaws Rubric

### Critical Severity (16 pillars — must fix before production)

These represent the foundational pillars that are completely absent. Without addressing them, the repo cannot function as a software project.

| Pillar | Gap Description | Remediation |
|---|---|---|
| **L1 Architecture** | No code, no modules, no project structure | Seed from upstream Plane.so; inherit its monorepo structure (apps/ + packages/ + turbo.json) |
| **L2 Dev Loop** | No dev server, no watch mode, no hot reload | Upstream Plane uses Next.js dev server with hot-reload; inherited via seeding |
| **L3 Agent Loop** | No CLI, no MCP, no agent tools | Add AGENTS.md documenting agent workflows; add CLI tools post-seeding |
| **L4 Observability** | No logs, metrics, traces | Add structured logging instrumentation post-seeding |
| **L5 Security** | No SBOM, no SAST, no .gitignore | Add .gitignore (upstream has one), add security scan CI post-seeding |
| **L6 Performance** | No benchmarks, no perf budgets | Add Lighthouse CI budgets post-seeding |
| **L7 Extensibility** | No plugin system | Assess upstream Plane extensibility; document extension points |
| **L9 Complexity** | No code to measure | Blocked on seeding |
| **L10 Type Safety** | No tsconfig.json | Add tsconfig.json (upstream has strict TypeScript) |
| **L11 Dependencies** | No package.json, no lockfile | Seed from upstream to get pnpm-workspace.yaml + pnpm-lock.yaml |
| **L12 Error Handling** | No error types, no error boundaries | Add React error boundaries post-seeding |
| **L13 Logging** | No logger | Add pino/winston logger post-seeding |
| **L14 Data Layer** | No DB/ORM | Upstream Plane uses Django backend; Planify frontend consumes API — no local DB needed |
| **L15 API Surface** | No API routes, no OpenAPI | Upstream Plane has Django REST API + OpenAPI; Planify consumes, not hosts |
| **L16 Frontend** | No components, no design system | Seed from upstream Plane to get full component library |
| **L76 Accessibility** | No WCAG compliance | Upstream Plane has accessibility patterns; audit post-seeding |

### High Severity (25 pillars — should fix before major release)

| Pillar | Gap Description | Remediation |
|---|---|---|
| **L8 Compliance** | No LICENSE file | Add Apache 2.0 license (matching upstream Plane.so), add NOTICE for forked work |
| **L23 Release** | No semver tags, no changelog | After seeding, tag v0.1.0, create CHANGELOG.md with conventional commits |
| **L24 Migration** | No upstream seeding done (blocker) | **BLOCKING** — execute upstream seeding first |
| **L27 Infrastructure** | No IaC, no Dockerfile | Add Vercel deployment config; upstream provides docker-compose |
| **L29 Monitoring** | No dashboards, no alerting | Add Sentry/Datadog RUM integration post-seeding |
| **L31 Packaging** | No container image | Add Dockerfile based on upstream Plane web Dockerfile |
| **L33 Install** | No one-line install | Create setup.sh or npm-based install entry point |
| **L35 Reproducibility** | No lockfile | Will come from upstream seeding (pnpm-lock.yaml) |
| **L44 Web App** | No PWA, no offline mode | Add PWA manifest and service worker post-seeding |
| **L57 Color System** | No design tokens, no dark mode | Upstream Plane has design tokens; align with Phenotype brand |
| **L59 Brand Consistency** | No OG images, no social cards | Add OG image generation, social preview cards for Planify |
| **L63 Debug** | No debug config | Add VSCode debug launch configuration |
| **L68 Tooling Integration** | No ESLint, no Prettier | Upstream has .oxlintrc.json + .prettierignore; align post-seeding |
| **L71 First-Run** | No demo mode, no zero-config | Upstream Plane has quick-start setup; evaluate for Planify |
| **L72 Onboarding** | No interactive tutorial | Upstream Plane docs have tutorials; link from Planify |
| **L74 Error UX** | No error boundaries, no helpful errors | Add React error boundaries, user-facing error messages |
| **L75 Performance UX** | No skeleton screens, no loading UX | Add Suspense boundaries and skeleton loaders post-seeding |
| **L82 Bug Detection** | No static analysis | Add oxlint/eslint in CI, TypeScript strict mode |
| **L86 Continuous Audit** | No audit automation | Create audit-ratchet.yml workflow (see OmniRoute pattern) |
| **L116 Upgrade Path** | No upgrade mechanism | Document upstream sync process for keeping Planify updated with Plane.so |

### Medium Severity (37 pillars — nice-to-have improvements)

Key items include: L25 Vendor Lockin (already partially addressed), L30 Onboarding (setup docs exist), L67 Knowledge Sharing (architecture covered), L70 Issues/PRs (templates needed), L81 Solo-Operation (partial agent readiness), L96 ADR System (needed for fork decisions), L117 Webhooks/API (integration with AgilePlus).

### Low Severity (52 pillars)

Primarily compute-specific (L101–L110, N/A for web frontend), native FFI (L121–L130, N/A for web frontend), and aspirational items (fuzzing, cost efficiency, self-healing, etc.) that can be deferred until the application has a user base.

---

## 4. DAG Plan / WBS — Remediation Phases

Since Planify is a stub, the remediation plan is structured as a DAG with **"Seed from upstream"** as the root dependency. All phases are ordered; items within a phase can be parallelized.

### Phase 0: Foundation (Root)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 0: Seed from Upstream Plane.so                       │
│  Dependency for: ALL subsequent phases                      │
│  git remote add upstream https://github.com/makeplane/plane  │
│  git pull upstream preview (or main)                         │
│  Resolve conflicts → git push origin main                   │
└─────────────────────────────────────────────────────────────┘
```

**Estimated effort:** 2-4 hours (resolving merge conflicts with stub files)

### Phase 1: Legal & Identity (parallelizable after Phase 0)

```
Phase 1.1: Add LICENSE (Apache 2.0 matching upstream) + NOTICE
Phase 1.2: Add .gitignore (inherit from upstream)
Phase 1.3: Add CI workflow (lint + typecheck + test)
Phase 1.4: Add issue templates + PR template
Phase 1.5: Brand Planify (OG images, favicon, social cards)
```

**Estimated effort:** 4-8 hours

### Phase 2: Developer Experience (parallelizable after Phase 0)

```
Phase 2.1: Add VSCode debug config + editor settings
Phase 2.2: Add AGENTS.md documenting agent workflows
Phase 2.3: Configure ESLint/oxlint + Prettier
Phase 2.4: Set up pnpm workspaces (inherited from upstream)
Phase 2.5: Verify dev server hot-reload works
```

**Estimated effort:** 4-8 hours

### Phase 3: Core Engineering (sequential, builds on Phase 2)

```
Phase 3.1: Verify TypeScript strict mode; fix any type errors
Phase 3.2: Add React error boundaries + structured logging
Phase 3.3: Set up test framework (vitest/jest) + write smoke tests
Phase 3.4: Add Sentry/Datadog RUM monitoring
Phase 3.5: Add Lighthouse CI for performance budgets
```

**Estimated effort:** 8-16 hours

### Phase 4: Deployment & Infrastructure (after Phase 2)

```
Phase 4.1: Configure Vercel deployment (vercel.json)
Phase 4.2: Add Dockerfile for containerized deployment
Phase 4.3: Add IaC (Terraform or Vercel config)
Phase 4.4: Set up preview deployments on PR
Phase 4.5: Add release workflow (semantic-release or changesets)
```

**Estimated effort:** 4-8 hours

### Phase 5: End-User Experience (after Phase 3, parallel to Phase 4)

```
Phase 5.1: Audit upstream Plane's UX for Phenotype alignment
Phase 5.2: Add PWA support (manifest + service worker)
Phase 5.3: Implement skeleton screens + loading states
Phase 5.4: Add first-run onboarding flow
Phase 5.5: Implement empty states with illustrations
Phase 5.6: WCAG-AA accessibility audit + remediation
```

**Estimated effort:** 16-24 hours

### Phase 6: Visual Polish & Brand (after Phase 5)

```
Phase 6.1: Establish Phenotype design tokens (colors, spacing, typography)
Phase 6.2: Implement dark mode (if not inherited from upstream)
Phase 6.3: Add micro-interactions and animations
Phase 6.4: Create Planify mascot/branded art
Phase 6.5: Add visual regression testing (storybook + chromatic)
```

**Estimated effort:** 16-24 hours

### Phase 7: Documentation & Community (can start after Phase 0, ongoing)

```
Phase 7.1: Write CONTRIBUTING.md
Phase 7.2: Create ADR for fork decisions (ADR-001: why fork Plane.so)
Phase 7.3: Add CHANGELOG.md
Phase 7.4: Set up public roadmap (GitHub projects)
Phase 7.5: Create Planify docs site or link to Phenotype docs
```

**Estimated effort:** 8-12 hours

### Phase 8: Agent Readiness & Automation (ongoing from Phase 2)

```
Phase 8.1: Add AGENTS.md + CLAUDE.md
Phase 8.2: Set up continuous audit workflow
Phase 8.3: Add automated dependency updates (renovate/dependabot)
Phase 8.4: Implement bug detection (static analysis in CI)
Phase 8.5: Add cost tracking for Vercel deployment
```

**Estimated effort:** 4-8 hours

### DAG Visualization

```
                ┌─────────────────────┐
                │ Phase 0: Seed from  │
                │ upstream Plane.so   │
                └──────────┬──────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                 ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ Phase 1:     │ │ Phase 2:     │ │ Phase 7:     │
   │ Legal & ID   │ │ Dev Exp      │ │ Docs/Comm    │
   └──────────────┘ └──────┬───────┘ └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Phase 3: │ │ Phase 4: │ │ Phase 8: │
       │ Core Eng │ │ Deploy   │ │ Agent     │
       └─────┬────┘ └──────────┘ └──────────┘
             ▼
       ┌──────────┐
       │ Phase 5: │
       │ End-User │
       │  UX      │
       └─────┬────┘
             ▼
       ┌──────────┐
       │ Phase 6: │
       │ Visual   │
       │ Polish   │
       └──────────┘
```

**Total estimated effort to reach C grade (~65%):** 60-100 hours

---

## 5. Scoring Methodology

Each pillar is scored 0-100 based on the subitems and acceptance levels (Bronze/Silver/Gold) defined in PILLAR-TAXONOMY-v2.md:

- **0:** Nothing exists
- **1-10:** Foundational documentation or intent
- **11-25:** Bronze-level practices partially met
- **26-50:** Bronze-level practices fully met
- **51-70:** Silver-level practices
- **71-90:** Gold-level practices
- **91-100:** Polish/aspirational targets

Layer weights from § Per-Layer Priority Map are applied:
- L41-L50 (Distribution), L51-L60 (Visual Polish), L71-L80 (End-User UX) weighted **2.0x** — most important for an Application/UI
- L1-L10 (Core Engineering), L31-L40 (Deployment) weighted **0.8x** — less load-bearing for a web frontend
- L101-L110 (Compute-Specific) weighted **0.2x** — irrelevant for web frontend

### Grade Scale

| Grade | Range | Meaning |
|---|---|---|
| A+ | ≥90 | World-class |
| A | 85-89 | Excellent |
| B+ | 80-84 | Very good |
| B | 75-79 | Good |
| C+ | 70-74 | Above average |
| C | 65-69 | Average |
| D+ | 60-64 | Below average |
| D | 55-59 | Poor but functional |
| **F** | **<55** | **Failing / Stub** |

---

## 6. Key Recommendations

1. **Execute Phase 0 immediately** — the entire remediation depends on upstream seeding. Without code from Plane.so, no engineering progress is possible.

2. **Prioritize legal early (Phase 1)** — without a LICENSE file and .gitignore, the repo cannot accept contributions or be deployed responsibly.

3. **Align with Phenotype design system early** — Planify will be embedded in AgilePlus and needs to match Phenotype brand. Define design tokens in Phase 6 but plan for them from Phase 2 onward to avoid rework.

4. **Upstream sync strategy** — document how Planify will stay in sync with Plane.so releases (e.g., monthly upstream pulls, conflict resolution process). This is critical for vendor lockin (L25) and upgrade path (L116).

5. **Don't over-invest in Compute-Specific (L101-L110) or FFI (L121-L130)** — these carry 0.2x and 1.0x weights for Application/UI, but a web frontend has no need for hypervisor support or native OS FFI. Focus on the 2.0x-weighted categories (L41-L60, L71-L80).

6. **Set up continuous audit (L86)** after Phase 3 — the first audit (this document) establishes the baseline. Automate re-auditing to catch regressions before they compound.

---

## 7. Appendices

### A. Upstream Plane.so Stack (for reference)

Based on analysis of [github.com/makeplane/plane](https://github.com/makeplane/plane):

- **Frontend:** React + React Router (TypeScript)
- **Backend:** Django (Python)
- **Monorepo:** pnpm workspaces + Turborepo
- **Database:** PostgreSQL (via Django ORM)
- **Linting:** oxlint + prettier
- **Installation:** Docker Compose, Kubernetes
- **Codebase:** 7,000+ commits, 54k+ stars

### B. File Inventory (current stub)

| File | Lines | Purpose |
|---|---|---|
| `README.md` | 34 | Project description, status, deployment, architecture, setup |
| `UPSTREAM.md` | 20 | Upstream Plane.so seeding instructions |
| `.git/` | — | Git metadata (2 commits, 1 branch, origin remote) |

### C. Scoring Detail per Pillar

See `planify-audit-130.json` for full per-pillar scoring with rationale.
