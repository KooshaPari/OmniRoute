# audit-v38 — Phenotype 100+ Pillar Org Audit Template

A robust **~260 sub-pillar** audit-and-grade template for Phenotype-org repos, spanning code architecture, security, supply-chain, eval coverage, **agent-readiness**, **accessibility/UX**, **visual identity**, and **packaging/distribution** — including the "utterly extraneous" AX, creative-polish, and Time-2 distribution items.

## Why v38 exists

v37 (the original 100+ pillar audit) **completed** — 136/137 repos scored, published to this repo. But on **2026-06-27 the runnable scaffold `.audit-run-v37/` was externally deleted** (dispatch `bin/` + `catalog/` including the WORKER-SPEC and the L30 pillar file). The pillar **definitions survived** at `audit-30-pillar/` (L0–L80), but with the assembly scaffold gone and **L30 missing**, fleets fell back to the surviving directory *named* `audit-30-pillar/` and audited only the ~30 surface pillars. v38 rebuilds the runnable template, reconstructs L30, and **adds** three new categories.

## What's in here

```
audit-v38/
├── README.md                 ← you are here (handoff entry point)
└── catalog/
    ├── PILLARS-INDEX.md       ← the map: L0–L122, 12 clusters, provenance
    ├── clusters.tsv           ← cluster → pillar-range → source-file
    ├── WORKER-SPEC.md         ← auditing-agent output contract + dispatch primitive
    ├── SCORECARD-TEMPLATE.md  ← blank per-repo scorecard to fill in
    ├── L30-agent-readiness.md ← RECONSTRUCTED (was the missing file)
    ├── X-ax-L81-L95.md        ← NEW: Accessibility + UX (WCAG 2.2 + Nielsen)
    ├── X-visual-identity-L96-L107.md   ← NEW: Visual Identity (3-provenance-tier)
    ├── X-packaging-distribution-L108-L122.md ← NEW: Packaging + Distribution
    └── RUBRIC-LINEAGE.md      ← 9 external rubric systems → v38 category mapping
```
Pillar definitions for **L0–L80** are NOT copied here — they live at `../../audit-30-pillar/` (referenced by `clusters.tsv`), since they survived intact.

## The 12 clusters (L0–L122)

C00 Architecture · C01 CI/DX/Obs · C02 Errors/API/Governance · **C03 Agent-Readiness** · C04 Security · C05 Observability · C06 Supply-Chain · C07 DX/QEng/Portability · C08 Eval-Coverage · **C09 Accessibility+UX** · **C10 Visual-Identity** · **C11 Packaging+Distribution**. Bold = reconstructed/new in v38.

## How to run an audit

1. **Read** `catalog/WORKER-SPEC.md` (the output contract) and `catalog/PILLARS-INDEX.md` (the map).
2. **Dispatch** one worker per cluster (see `clusters.tsv`), each fed `WORKER-SPEC.md` + its cluster's pillar file. Preferred substrate: `substrate dispatch --tier worker`; fallback `codex exec`. Workers emit structured, evidence-cited output to `output/<repo>/<C0x>.md`.
3. **Validate** each output against WORKER-SPEC's checklist (sentinels, evidence, glyph↔score).
4. **Transcribe** cluster totals into a copy of `catalog/SCORECARD-TEMPLATE.md`; compute the weighted overall grade.

Scoring: sub-pillar `0=✗ / 1=△ / 2=~ / 3=✓`, evidence-mandatory (`file:line`), separate `soft_goal_delta`. Grade: A≥90 · B≥75 · C≥60 · D≥40 · F<40.

## Provenance & rubric lineage

New categories are sourced from `catalog/RUBRIC-LINEAGE.md`, which catalogs 9 external systems — Factory.ai **droid** agent-readiness, **ATAM** (SEI/CMU), SWE-bench Verified, OpenSSF Scorecard, DORA, AWS Well-Architected, WCAG 2.2, Nielsen 10 heuristics, 12-Factor — and maps each into the v38 clusters.

## Scope

Built for AgilePlus + Tracera first (they are intended to become the SpecKitty CLI/daemon that *enforces* this rubric — see `AgilePlus/docs/design/SPECKITTY-SCORECARD-ENFORCEMENT.md`), then substrate + SessionLedger, then the broader org. This template is the handoff artifact: point an auditing agent at `README.md` + `PILLARS-INDEX.md` + `WORKER-SPEC.md` + `SCORECARD-TEMPLATE.md` and it can run a full-depth audit.
