# WORKER-SPEC — Per-Cluster Auditing Agent Output Contract

**Version:** v38
**Applies to:** All audit-v38 cluster workers (dispatched via codex exec / forge / substrate dispatch)
**Maintained by:** audit-rebuild-v38 lane

---

## Overview

Each cluster worker receives: (1) a repo path, (2) a pillar-file (or set of pillar IDs), (3) this WORKER-SPEC. The worker MUST produce output in **exactly** the format below — no prose preambles, no summaries, no re-narrating the pillar definition. The parent agent reads ONLY the structured output.

---

## Required Output Format

```
CLUSTER_START cluster=<cluster-id> repo=<repo-name> pillars=<L-range> date=<YYYY-MM-DD>

### <pillar-id> — <pillar-title>
score: <0|1|2|3>  glyph: <✗|△|~|✓>
evidence:
  - <file:line> — <what was found>
  - <file:line> — <what was found>
  [...]
gaps:
  - <one-line gap description> — effort: <S|M|L>
soft_goal_delta: <+N% toward soft goal, or "not started">

[... repeat for each sub-pillar ...]

CLUSTER_TOTAL score=<sum>/<max> pct=<N%> grade=<A|B|C|D|F>
CLUSTER_DONE cluster=<cluster-id> repo=<repo-name>
```

---

## Scoring Rubric

| Score | Glyph | Meaning |
|-------|-------|---------|
| 0 | ✗ | Absent / not started. No evidence found. |
| 1 | △ | Seeded. Exists but materially incomplete (stub, placeholder, or missing key parts). |
| 2 | ~ | Partial. Functionally present; 1-2 gaps from full compliance. |
| 3 | ✓ | Complete. Meets acceptance criterion; evidence is concrete and verifiable. |

**Soft-optimizing goals** do NOT affect the 0-3 score. They are tracked separately in `soft_goal_delta`. A repo can score 3 on the acceptance criterion while still having soft-goal work remaining.

---

## Evidence Rules

1. **Every score MUST cite at least one `file:line` reference** (or `gh issue #N` / `gh pr #N`). A score with no evidence is invalid and will be rejected.
2. For score=0: cite the absence explicitly — `MISSING: docs/functional_requirements.md` or `grep returned 0 results for pattern X`.
3. For score=3: cite the primary acceptance criterion file AND one corroborating secondary file.
4. Evidence lines must be verifiable by the parent agent running `grep` or `ls` on the same repo. Do not fabricate line numbers.
5. Max 6 evidence lines per sub-pillar. Prefer the most specific and load-bearing.

---

## Mandatory Fields

The following fields are **required** on every sub-pillar block. Missing any field causes the parent to re-queue the cluster:

- `score:` (integer 0-3)
- `glyph:` (one of ✗ △ ~ ✓ — must match score)
- `evidence:` (at least 1 bullet with file:line)
- `gaps:` (at least 1 bullet, even if "none identified — effort: S")
- `soft_goal_delta:` (string)

---

## Cluster Sentinel

Every worker output MUST begin with `CLUSTER_START` and end with `CLUSTER_DONE`. The parent agent uses these to detect completion. An output that ends without `CLUSTER_DONE` is treated as a crash and the cluster is re-queued.

`CLUSTER_TOTAL` is required and must carry:
- `score=<sum>/<max>` — sum of all sub-pillar scores over the maximum possible (sub-pillars × 3)
- `pct=<N%>` — score/max as a percentage
- `grade=` — derived from pct: A≥90%, B≥75%, C≥60%, D≥40%, F<40%

---

## Cluster Assignments

| Cluster ID | Pillar IDs | Category |
|------------|------------|----------|
| C00 | L0–L9 | Architecture + Module |
| C01 | L10–L19 | CI, DX, Observability |
| C02 | L20–L29 | Error handling, API, Governance |
| C03 | L30 | Agent Readiness |
| C04 | L31–L40 | Security |
| C05 | L41–L50 | Observability (deep) |
| C06 | L51–L60 | Supply Chain |
| C07 | L61–L70 | DX, QEng, Portability |
| C08 | L71–L80 | Eval Coverage |
| C09 | L81–L95 | AX (Accessibility + UX) |
| C10 | L96–L107 | Visual Identity |
| C11 | L108–L122 | Packaging + Distribution |

---

## Dispatch Primitive

Clusters are dispatched via:

```bash
# substrate dispatch (preferred)
substrate dispatch --tier worker \
  --prompt "$(cat audit-v38/catalog/<pillar-file>.md)" \
  --context "repo=<repo-path> cluster=<cluster-id>" \
  --output audit-v38/output/<repo>/<cluster-id>.md

# codex exec fallback
codex exec -m gpt-5.5 \
  "$(cat audit-v38/catalog/WORKER-SPEC.md) $(cat audit-v38/catalog/<pillar-file>.md)" \
  > audit-v38/output/<repo>/<cluster-id>.md
```

The parent reads `audit-v38/output/<repo>/<cluster-id>.md` after the CLUSTER_DONE sentinel appears.

---

## Validation Checklist (parent runs after each cluster)

- [ ] File starts with `CLUSTER_START`
- [ ] File ends with `CLUSTER_DONE`
- [ ] `CLUSTER_TOTAL` is present and parseable
- [ ] Every sub-pillar block has score, glyph, evidence, gaps, soft_goal_delta
- [ ] No evidence line lacks a file:line or gh reference
- [ ] Glyph matches score (0=✗, 1=△, 2=~, 3=✓)
- [ ] No score=3 without at least 2 evidence lines

---

## Error Handling

- If a file referenced in evidence does not exist in the repo: score MUST drop to 0 or 1; note `FILE_NOT_FOUND: <path>` in the evidence.
- If the worker cannot access the repo: emit `CLUSTER_ERROR reason=<message>` before `CLUSTER_DONE`.
- If a pillar is not applicable to this repo type (e.g., visual-identity for a pure CLI daemon): score=0, glyph=✗, evidence: `NOT_APPLICABLE: <reason>`, gaps: `none — not applicable`, soft_goal_delta: `n/a`.
