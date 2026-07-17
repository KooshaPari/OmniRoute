# audit-v38 Scorecard — SessionLedger

**Repo:** KooshaPari/SessionLedger
**Date:** 2026-07-14
**Repo-type profile:** CLI+daemon + desktop (sl-daemon + sl-viewer)
**Auditor:** cursor-w33-reaudit
**Commit audited:** 18486e8 (origin/main / Wave-33)

> Rubric SSOT: phenotype-org-audits/audit-v38

## Category Scores

| Cluster | Category | Pillars | Score (sum/max) | Pct | Grade | Notes |
|---------|----------|---------|:---------------:|:---:|:-----:|-------|
| C00 | Architecture + Module | L0-L9 | 28/30 | 93% | A | see audit/.lane-c00 |
| C01 | CI, DX, Observability | L10-L19 | 28/30 | 93% | A | see audit/.lane-c01 |
| C02 | Error handling, API, Governance | L20-L29 | 29/30 | 97% | A | see audit/.lane-c02 |
| C03 | Agent Readiness | L30 | 36/36 | 100% | A | see audit/.lane-c03 |
| C04 | Security | L31-L40 | 26/30 | 87% | B | see audit/.lane-c04 |
| C05 | Observability (deep) | L41-L50 | 29/30 | 97% | A | see audit/.lane-c05 |
| C06 | Supply Chain | L51-L60 | 26/30 | 87% | B | see audit/.lane-c06 |
| C07 | DX, QEng, Portability | L61-L70 | 29/30 | 97% | A | see audit/.lane-c07 |
| C08 | Eval Coverage | L71-L80 | 29/30 | 97% | A | see audit/.lane-c08 |
| C09 | Accessibility + UX | L81-L95 | 44/45 | 98% | A | see audit/.lane-c09 |
| C10 | Visual Identity | L96-L107 | 36/36 | 100% | A | see audit/.lane-c10 |
| C11 | Packaging + Distribution | L108-L122 | 37/45 | 82% | B | see audit/.lane-c11 |

## Overall

**Weighted overall score:** 94% · **Overall grade:** A

(Raw rubric total across all 12 clusters. Sum 377 / 402.)

## Wave-33 Delta

| Cluster | Before | After | Raw delta | Evidence-backed movement |
|---------|:------:|:-----:|:---------:|--------------------------|
| C02 | 28/30 | 29/30 | +1 | In-tree PII redaction helper stub (#278); L24 2→3 |
| C08 | 28/30 | 29/30 | +1 | Python OKF adapter stub (#274); L75 2→3 |
| **Overall** | **375/402 (93% A)** | **377/402 (94% A)** | **+2** | Conservative; two pillars only |

## Headline Findings

- **Strongest:** C03/C10 (100% A); C09 (98% A); C02/C05/C07/C08 (97% A); C00/C01 (93% A)
- **Weakest:** C11 Packaging (82% B); C04/C06 (87% B)
- **Wave-32 → Wave-33:** 93% A (375/402) → 94% A (377/402), +2 raw points
- **Held (no score):** #275 exact rustc pin (C06 L60 already pillar max); #273 brew/winget publish readiness (C11 L109 already pillar max; live tap/winget-pkgs unpaid); #276 OTLP metrics soft stub (C05 L43 already max; soft `continue-on-error`); #277 optional jemalloc soft (C00 L8 soft CI; default-on/Windows unpaid)
- **Remaining unpaid:** maintainer 2FA (C04 L36), full SLSA-L3 isolation (C06), unconditional release-blocking OCI (C06), Authenticode/notarization (C11 L112), live brew/winget publish, live Alertmanager webhooks, continuous profiling push backend, full loom/shuttle/miri, default-on jemalloc, Go/TS OKF adapters beyond Python, multi-tenant / auto-ETL PII redaction (C02 L24), in-tree KMS/envelope encryption (C02 L22), Fluent/ICU multi-locale (C01 L16), hard seccomp/no-net CI (C04 L40), production OTLP metrics push

## N/A / soft goals

- Harbor/agent-eval: docs/EVAL_SCOPE.md
- Tray/menubar auto-update: docs/adr/0001-desktop-companion-scope.md
- Mobile presence: docs/adr/0002-mobile-presence.md
- Platform Authenticode/notarization: deferred per docs/adr/0003-platform-code-signing.md
