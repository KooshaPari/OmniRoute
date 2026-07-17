# WBS-PHASED — sharecli + org spine

**Status:** ACTIVE  
**Target overall:** ~64% (tier-1 weighted C) · **Pinned card:** `audit/SCORECARD-v38.md`  
**Spine:** [phenotype-org-audits SPINE-INDEX](https://github.com/KooshaPari/phenotype-org-audits/blob/main/docs/SPINE-INDEX.md) · rubric `audit-v38`  
**DAG:** [`WORK_DAG.md`](../../../WORK_DAG.md) · **FRs:** [`FUNCTIONAL_REQUIREMENTS.md`](../../../FUNCTIONAL_REQUIREMENTS.md)  
**Machine tokens:** `Status: DONE` | `READY` | `BLOCKED` | `IN_PROGRESS`  
**Last sync:** 2026-07-12 (T-200 / FR-002; C05=70%; overall≈64%)

> Agents: flip only the `Status:` token and Evidence cell; keep ID columns stable.

## Org ↔ project map

| Org spine | Project artifact | Clusters | Status |
|-----------|------------------|----------|--------|
| audit-v38 rubric | `audit/rubric/` | C00–C11 | Status: DONE |
| SPINE-INDEX | this WBS + GAP-QA | fleet | Status: IN_PROGRESS |
| Lane evidence | `audit/.lane-c00`…`c11` | C00–C11 | Status: DONE |
| Scorecard | `audit/SCORECARD-v38.md` | all | Status: DONE |
| Claimable DAG | `WORK_DAG.md` T-IDs | C03 / FR | Status: IN_PROGRESS |

## Cluster rollup (audit-v38)

| Cluster | Focus | Pct | Grade | Phase anchor | Status |
|---------|-------|:---:|:-----:|--------------|--------|
| C00 | Architecture + Module | 60% | C | Wave2 | Status: DONE |
| C01 | CI / DX / Obs | 63% | C | Wave1–2 | Status: DONE |
| C02 | Error / API / Governance | 80% | B | Wave2 + Wave5 | Status: DONE |
| C03 | Agent Readiness | 92% | A | Wave1 + Wave3 | Status: DONE |
| C04 | Security | 60% | C | Wave2 + L39 | Status: IN_PROGRESS |
| C05 | Observability (deep) | 70% | C | Wave2 | Status: DONE |
| C06 | Supply Chain | 60% | C | Wave2 + release pin | Status: IN_PROGRESS |
| C07 | DX / QEng / Portability | 63% | C | Wave1–2 | Status: DONE |
| C08 | Eval Coverage | 53% | D | Wave1–2 | Status: READY |
| C09 | Accessibility + UX | 58% | D | backlog | Status: READY |
| C10 | Visual Identity | 67% | C | Wave1 | Status: DONE |
| C11 | Packaging + Distribution | 67% | C | Wave4 | Status: IN_PROGRESS |

## Phased WBS

### Wave0–2 — DONE (baseline, agent readiness, score-lift fleet)

See SCORECARD post-audit remediations through 2026-07-11. C05 closed at **70%**.

### Wave3 — FR acceptance suites (current)

| WBS | Work | Links | Status |
|-----|------|-------|--------|
| W3.1 | FR-002 config acceptance | T-200 · `tests/fr002_*.rs` · C03 | Status: DONE |
| W3.2 | FR-003 project registry | T-210 · `tests/fr003_*.rs` · C03 | Status: DONE |
| W3.3 | FR-004 status/health | T-220 · `tests/fr004_*.rs` · C03 | Status: DONE |
| W3.4 | FR-005 limits | T-230 · C03 | Status: DONE |
| W3.5 | Journey + golden + friction | T-240..T-300 · C03 | Status: DONE |
| W3.6 | C03 re-score | T-310 | Status: DONE |
| W3.7 | Claim-lock + loop budgets | T-260 · T-270 | Status: DONE |

Pred: W3.3←W3.2←W3.1; W3.4←W3.3; W3.6←W3.4.

### Wave4 — Packaging / signing

| WBS | Work | Links | Status |
|-----|------|-------|--------|
| W4.1 | Unsigned GH Release attach + SBOM in-archive | C11 L118 · C04 L32 · `release.yml` | Status: DONE |
| W4.2 | Homebrew bottle sha (replace PLACEHOLDER) | C11 · `Formula/sharecli.rb` | Status: DONE |
| W4.3 | Codesign / notarize | C11 L112 | Status: BLOCKED |
| W4.4 | Declare MSRV (`rust-version`) | C11 L119 | Status: DONE |

### Wave5 — AuthN federation

| WBS | Work | Links | Status |
|-----|------|-------|--------|
| W5.1 | Federated IdP for `serve` | C02 L21 | Status: DONE |
| W5.2 | Audit retention + burn alerts | C02 | Status: DONE |
| W5.3 | Threat-model review post-federation | C04 L39 · `THREAT_MODEL.md` | Status: READY |

## Sync protocol

1. After merge: update matching `Status:` here + row in `GAP-QA-MATRIX.md`.
2. Re-score lane MD → bump SCORECARD pct → adjust cluster rollup.
3. Cite FR / T-ID / Cxx in PR body (pr-lint).
4. Flip `WORK_DAG.md` task Status READY→DONE when Done-when passes.
