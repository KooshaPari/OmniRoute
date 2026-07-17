# audit-v38 Scorecard — <REPO-NAME>

**Repo:** <owner/repo>
**Date:** <YYYY-MM-DD>
**Repo-type profile:** <CLI | library | service | web-app | desktop | CLI+daemon>
**Auditor:** <agent-id / cluster-fleet>
**Commit audited:** <sha>

> Scoring: each sub-pillar 0=✗ / 1=△ / 2=~ / 3=✓, evidence-mandatory (`file:line`).
> Cluster score = sum / (sub-pillars × 3). Grade: A≥90% · B≥75% · C≥60% · D≥40% · F<40%.
> `N/A` clusters are excluded from the weighted overall (note the reason).

## Category Scores

| Cluster | Category | Pillars | Score (sum/max) | Pct | Grade | Top-3 gaps |
|---------|----------|---------|:---------------:|:---:|:-----:|------------|
| C00 | Architecture + Module | L0–L9 | /  | % |  |  |
| C01 | CI, DX, Observability | L10–L19 | /  | % |  |  |
| C02 | Error handling, API, Governance | L20–L29 | /  | % |  |  |
| C03 | Agent Readiness | L30 | / 36 | % |  |  |
| C04 | Security | L31–L40 | /  | % |  |  |
| C05 | Observability (deep) | L41–L50 | /  | % |  |  |
| C06 | Supply Chain | L51–L60 | /  | % |  |  |
| C07 | DX, QEng, Portability | L61–L70 | /  | % |  |  |
| C08 | Eval Coverage | L71–L80 | /  | % |  |  |
| C09 | Accessibility + UX | L81–L95 | / 45 | % |  |  |
| C10 | Visual Identity | L96–L107 | / 36 | % |  |  |
| C11 | Packaging + Distribution | L108–L122 | / 45 | % |  |  |

## Overall

**Weighted overall score:** <N>% &nbsp;·&nbsp; **Overall grade:** <A/B/C/D/F>

(Weighted mean of non-N/A clusters. Optionally weight by tier: Tier-1 clusters — C00–C03 — count double if a tiered profile is used.)

## Headline Findings

- **Strongest:** <cluster — one line>
- **Weakest:** <cluster — one line>
- **Highest-leverage fix:** <one action that moves the most pillars>
- **Agent-readiness verdict (C03):** <can an agent work alone in this repo? one line>
- **Time-2 verdict (C11):** <can a user install/run/deploy it today? one line>

## How to run

1. Read the output contract: `catalog/WORKER-SPEC.md`.
2. Dispatch one worker per cluster (`catalog/clusters.tsv` maps cluster → pillar file):
   ```
   substrate dispatch --tier worker \
     --prompt "$(cat catalog/WORKER-SPEC.md) $(cat <cluster-pillar-file>)" \
     --context "repo=<repo-path> cluster=<C0x>" \
     --output output/<repo>/<C0x>.md
   ```
   (codex fallback: `codex exec -m gpt-5.5 "$(cat WORKER-SPEC.md) $(cat <pillar-file>)" > output/<repo>/<C0x>.md`)
3. Validate each `output/<repo>/<C0x>.md` against WORKER-SPEC's checklist (CLUSTER_START/DONE, evidence present, glyph matches score).
4. Transcribe cluster totals into this table; compute the weighted overall.
