# 71-Pillar Refresh: `KooshaPari/cheap-llm-mcp`

**Date**: 2026-06-20
**Cycle**: ADR-041 weekly refresh (Monday 09:00 PDT)
**Schema**: [findings/71-pillar-2026-06-17-schema.md](findings/71-pillar-2026-06-17-schema.md)
**Scorer**: T2A batch probe (read-only `gh api`)

## Probe-Time Status — REPO DOES NOT EXIST ON `KooshaPari`

**Evidence of non-existence (probed 2026-06-20 via 3 endpoints):**

| Endpoint | Result |
|----------|--------|
| `gh repo view KooshaPari/cheap-llm-mcp --json ...` | `GraphQL: Could not resolve to a Repository with the name 'KooshaPari/cheap-llm-mcp'. (repository)` |
| `gh api graphql -f query='{ repository(owner: "KooshaPari", name: "cheap-llm-mcp") { name } }'` | `repository: null`, `NOT_FOUND` |
| `gh api graphql -f query='{ search(query: "cheap-llm in:name", type: REPOSITORY, first: 10) { nodes { nameWithOwner isArchived ... } } }'` | 0 matches under `KooshaPari/`; 5+ unrelated third-party matches (`magdalenakuhn17/awesome-cheap-llms`, `imkunal007219/claude-coworker-model`, `evintunador/gpt-lab`, `ZhangYiqun018/AvengersPro`, `ZON-Format/ZON`, etc.) |

**Org-wide search for the literal name** (executed):
```
search(query: "cheap-llm-mcp in:name", type: REPOSITORY, first: 10)
→ nodes: [ { nameWithOwner: "stBlackCat/cheap-llm-mcp", isArchived: false, isPrivate: false } ]
```
Only one match exists across all of GitHub: an unrelated fork under `stBlackCat/` (description: `null`).

## Why It Doesn't Exist — Governance Trail (read from local `repos/` SSOT)

| Source | Evidence |
|--------|----------|
| `AGENTS.md` (root, line "ADR-006 | cheap-llm-mcp | archive verified (2 cherry-picks, merge `a1612805`)") | Repo archived and verified per Track 1 closure. |
| `AGENTS.md` (line "ADR-007 | cheap-llm-mcp deprecation | Triggers W1-2 archive work") | Deprecation ADR-007 authored 2026-06-15. |
| `AGENTS.md` (line "ADR-029 | Dmouse92 → KooshaPari migration — absorb all DM92 work to substrate, archive emptied repos | 6 PRs opened, 18 Dmouse92 repos archived") | The canonical home was `Dmouse92/cheap-llm-mcp`, archived under the Track 8 migration. |
| `AGENTS.md` (line "**Dmouse92 token REMOVED from keyring 2026-06-17 22:30 PDT**") | The KooshaPari token cannot read the original `Dmouse92/cheap-llm-mcp` even if it weren't archived. |

**Conclusion**: `cheap-llm-mcp` is the canonical example of an **archived-then-substrate-absorbed** repo. Per ADR-029 § "Substrate absorption matrix":
- The consumer-facing W2-1 cost/budget/quota/audit/tiers code (~2,000 LOC across 6 modules) was ported to `KooshaPari/pheno-mcp-router` (PR `pheno-mcp-router#1`).
- The `llama_cpp.py` provider → `KooshaPari/pheno-mcp-router` `LlamaAdapter` (PR `pheno-mcp-router#2`).
- The `openai_compat.py` provider → `KooshaPari/pheno-mcp-router` `OpenAICompatAdapter` (PR `pheno-mcp-router#3`).
- The consumer-side deprecation notice → `KooshaPari/dispatch-mcp` (PR `dispatch-mcp#1`).
- The Dmouse92 source repo `Dmouse92/cheap-llm-mcp` was **archived** under the KooshaPari account-tokens migration; it was NOT recreated on the `KooshaPari/` org.

**Note**: Per ADR-007 the canonical name for the future cheap-LLM routing substrate is `pheno-mcp-router`, not `cheap-llm-mcp`. The 5 T2A repos include `cheap-llm-mcp` because it appears as a placeholder entry in the v11 DAG; the real-world canonical is `pheno-mcp-router` (which is separately covered in T2B — see `findings/2026-06-20-T2B-mcp-router-vs-pheno-mcp-router.md`).

## 71-Pillar Scoring — N/A (Repo Does Not Exist)

Per the schema scoring rubric: **"Score 0: Absent — No evidence found; capability does not exist."** Applying this at the *repo* level (rather than the *capability* level): every pillar that would have been scored against `cheap-llm-mcp` scores **0** because the repo does not exist. The substrate that replaced it (`pheno-mcp-router`) is the canonical scoring target.

### Aggregate

| Metric | Value |
|---|---|
| **Mean (all 71)** | **0.00** |
| **Pass (>=2.00)** | **NO** |
| **Domains ≥2.00** | 0 / 9 |
| **P0 gaps** | 9 (every domain) |

### Full table — every pillar 0

| Domain | Pillar range | Domain mean | Notes |
|--------|-------------|-------------|-------|
| 1. Architecture (AX) | L1–L12 | **0.00** | Repo absent. Substrate migration documented in `pheno-mcp-router` per ADR-029. |
| 2. Performance | L13–L19 | **0.00** | Repo absent. |
| 3. Quality / Correctness | L20–L27 | **0.00** | Repo absent. |
| 4. Developer Experience (DX) | L28–L37 | **0.00** | Repo absent. |
| 5. User Experience (UX) | L38–L45 | **0.00** | Repo absent. L40/L41 N/A → but parent mean 0 since repo missing. |
| 6. Security | L46–L55 | **0.00** | Repo absent. |
| 7. Observability & Ops | L56–L63 | **0.00** | Repo absent. |
| 8. Documentation & SSOT | L64–L68 | **0.00** | Repo absent. |
| 9. Governance & Sustainability | L69–L71 | **0.00** | **Repo intentionally archived per ADR-029** (governance-positive event: deliberate retirement). |

**Mean (raw, no N/A):** 0.00
**Mean (with L40/L41=3 N/A):** 0.087

---

## Recommended Remediation — Already Complete via Substrate Migration

The deprecation → substrate-absorption sequence is the canonical remediation for a deprecated fleet repo. Status:

| Step | Status | Reference |
|------|--------|-----------|
| 1. Deprecation ADR | ✅ Done 2026-06-15 | `docs/adr/2026-06-15/ADR-007-cheap-llm-mcp-deprecation.md` |
| 2. Consumer-side deprecation notice | ✅ Done 2026-06-17 | PR `KooshaPari/dispatch-mcp#1` — `docs/CHEAP_LLM_MCP_DEPRECATION.md` |
| 3. Code migration to substrate | ✅ Done 2026-06-17 | PR `KooshaPari/pheno-mcp-router#1` (6 modules, ~2,000 LOC) |
| 4. Provider migration | ✅ Done 2026-06-17 | PR `KooshaPari/pheno-mcp-router#2` (Llama) + `#3` (OpenAI-compat) |
| 5. Source archive | ✅ Done 2026-06-17 | `Dmouse92/cheap-llm-mcp` archived under ADR-029 |
| 6. Registry entry flip | ✅ Done 2026-06-18 | `phenotype-registry` row `sr-cheap-llm-mcp` flipped to `fsm=archived` |
| 7. 71-pillar scoring against substrate | Pending | Will score `KooshaPari/pheno-mcp-router` (the canonical replacement) |

**No remediation needed at the `cheap-llm-mcp` repo level** — it has been correctly retired. The 71-pillar mean of 0.00 is the *intended* terminal state for an archived-then-absorbed repo.

---

## Evidence Links (Probe Commands Run 2026-06-20 via `gh api`)

- `gh repo view KooshaPari/cheap-llm-mcp --json ...` → `Could not resolve to a Repository`.
- `gh api graphql -f query='{ repository(owner: "KooshaPari", name: "cheap-llm-mcp") { name } }'` → `null`, `NOT_FOUND`.
- `gh api graphql -f query='{ search(query: "cheap-llm-mcp in:name", type: REPOSITORY, first: 10) { ... } }'` → 1 unrelated match (`stBlackCat/cheap-llm-mcp`), 0 matches on `KooshaPari/`.
- Local SSOT evidence: `repos/AGENTS.md` lines for ADR-006, ADR-007, ADR-029.

---

*Generated for ADR-041 weekly refresh (T2A batch probe, 2026-06-20). Repo intentionally absent — substrate migration complete. This finding is preserved as the governance trail entry.*