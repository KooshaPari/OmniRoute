# audit-v38 — Pillars Index (L0–L122)

**Version:** v38 (rebuild of v37 after the `.audit-run-v37/` scaffold was wiped 2026-06-27)
**Total categories:** 12 clusters (C00–C11) · **Pillar IDs:** L0–L122 · **Sub-pillars:** ~260 (target 250+)

This index is the map. Pillar DEFINITIONS live in two places:
- **L0–L80** — the surviving v37 definitions at `phenotype-org-audits/audit-30-pillar/` (they were NOT lost; only the runnable assembly scaffold was). Individual files L0–L29, grouped files L31–L80.
- **L30 + L81–L122** — reconstructed / newly-added in `audit-v38/catalog/` (this rebuild). **L30 (Agent Readiness) was the one MISSING file** — it is why fleets fell back to the surviving dir *named* "audit-30-pillar" and audited only ~30 surface pillars. L81–L122 are NEW extension categories sourced from `catalog/RUBRIC-LINEAGE.md`.

## Cluster Map

| Cluster | Pillar IDs | Category | Sub-pillars | Source file | Provenance |
|---------|-----------|----------|:-----------:|-------------|------------|
| C00 | L0–L9 | Architecture + Module | ~30 | `audit-30-pillar/…-L0.md` … `-L9.md` | v37 survived |
| C01 | L10–L19 | CI, DX, Observability | ~30 | `audit-30-pillar/…-L10.md` … `-L19.md` | v37 survived |
| C02 | L20–L29 | Error handling, API, Governance | ~30 | `audit-30-pillar/…-L20.md` … `-L29.md` | v37 survived |
| **C03** | **L30** | **Agent Readiness** | **12** | `audit-v38/catalog/L30-agent-readiness.md` | **RECONSTRUCTED (was missing)** |
| C04 | L31–L40 | Security | ~15 | `audit-30-pillar/…-L31-L40-security.md` | v37 survived |
| C05 | L41–L50 | Observability (deep) | ~15 | `audit-30-pillar/…-L41-L50-observability.md` | v37 survived |
| C06 | L51–L60 | Supply Chain | ~15 | `audit-30-pillar/…-L51-L60-supply-chain.md` | v37 survived |
| C07 | L61–L70 | DX, QEng, Portability | ~15 | `audit-30-pillar/…-L61-L70-dx-qeng-portability.md` | v37 survived |
| C08 | L71–L80 | Eval Coverage | ~15 | `audit-30-pillar/…-L71-L80-eval-coverage.md` | v37 survived |
| **C09** | **L81–L95** | **Accessibility + UX** | **15** | `audit-v38/catalog/X-ax-L81-L95.md` | **NEW (WCAG 2.2 + Nielsen)** |
| **C10** | **L96–L107** | **Visual Identity** | **12** | `audit-v38/catalog/X-visual-identity-L96-L107.md` | **NEW (visual-identity directive)** |
| **C11** | **L108–L122** | **Packaging + Distribution** | **15** | `audit-v38/catalog/X-packaging-distribution-L108-L122.md` | **NEW (Time-2 + 12-Factor + WAF)** |

## The operator's four explicit asks — where they live

| Operator ask | Pillar(s) |
|--------------|-----------|
| "agent readiness… work alone and detect not only bugs but user story gaps/friction" | L30.1–L30.6, L30.12 |
| "visual/creative polishes" detection by agents | L30.7, C10 (L96–L107), L107 |
| "utterly extraneous items as far as AX both for devs and end users" | C09 (L81–L95, dev-AX + end-user-AX) |
| "animations, custom art/animated art, splashes" | L99, L102, L103, L106 |
| "deployment/packaging quality/robustness, distribution (mobile app, tray app)" | C11: L108 installers, L110 tray, L117 mobile, L116 surface parity |

## Rubric lineage

The 9 external systems feeding v38 (Factory.ai droid agent-readiness, ATAM, SWE-bench Verified, OpenSSF Scorecard, DORA, AWS Well-Architected, WCAG 2.2, Nielsen heuristics, 12-Factor) and their mapping into these clusters is documented in `catalog/RUBRIC-LINEAGE.md`.

## Scoring

Per-sub-pillar: `0=✗ absent / 1=△ seeded / 2=~ partial / 3=✓ complete`, evidence-mandatory (`file:line`), plus a separate `soft_goal_delta`. Cluster grade from pct: A≥90 · B≥75 · C≥60 · D≥40 · F<40. Output contract + dispatch primitive: `catalog/WORKER-SPEC.md`. Blank scorecard: `catalog/SCORECARD-TEMPLATE.md`.
