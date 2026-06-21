# 71-Pillar Cycle 4 Summary — T13 Batch 9F (5 Final Repos)

**Date:** 2026-06-20 (Saturday)
**Cycle:** 4 — T13 batch 9F (last early-cadence cycle before transitioning to Monday 09:00 PDT weekly cron per ADR-041)
**Schema:** [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md) (L1-L71, 9 domains, 0-3 scale)
**Per-repo files:**
- [findings/2026-06-20-71-pillar-cycle-4-Configra.md](2026-06-20-71-pillar-cycle-4-Configra.md)
- [findings/2026-06-20-71-pillar-cycle-4-pheno-config.md](2026-06-20-71-pillar-cycle-4-pheno-config.md)
- [findings/2026-06-20-71-pillar-cycle-4-pheno-otel.md](2026-06-20-71-pillar-cycle-4-pheno-otel.md)
- [findings/2026-06-20-71-pillar-cycle-4-pheno-capacity.md](2026-06-20-71-pillar-cycle-4-pheno-capacity.md)
- [findings/2026-06-20-71-pillar-cycle-4-nanovms.md](2026-06-20-71-pillar-cycle-4-nanovms.md)

---

## Why these 5 repos?

After cycles 1-3 scored **15 repos** (Eidolon, agent-platform, mobile-mcp, mobile-cli + the cycle 2 probe batch + the cycle 1 original 5), the 5 highest-priority **un-scored active fleet repos** remained:

| # | Repo | Bucket | Why this turn |
|---|---|---|---|
| 1 | **Configra** | substrate (canonical config, ADR-031) | ADR-031 closed 2026-06-19; canonical config absorb landed; needs baseline score to set the bar for `phenotype-config` deprecation |
| 2 | **pheno-config** | substrate (figment cascade v12-08) | Twin to Configra; recently got 12-factor cascade + LayeredConfig + FigmentMerge; the new API is unscored |
| 3 | **pheno-otel** | substrate (fleet-critical observability) | OTLP/HTTP/stdout exporters + W3C propagation; the observability substrate is the slowest in the cycle-3 deltas |
| 4 | **pheno-capacity** | substrate (L106, recently extracted from HwLedger) | ADR-036 closed 2026-06-19; capacity-math library is new and unscored; attention/policy/estimate are 3 sub-modules |
| 5 | **nanovms** | active app (3-tier isolation runtime) | One of the 5 focus repos in `chore/l5-87-focus-repo-specs-2026-06-11`; the **first active app** in the cycle-4 batch — validates that the 71-pillar framework applies to apps, not just libs |

This is the **last early-cadence cycle** before transitioning to the Monday 09:00 PDT weekly cron (ADR-041). Cycle 5 onwards runs every Monday; the org's "monthly coverage target" is 100% of active fleet over 4 weeks (~5 repos/week).

---

## Per-Repo Results (cycle 4, 5 final repos)

| Repo | Type | Mean (71 pillars) | Pass? (≥2.00) | P0 gaps | Highest pillar | Lowest pillar |
|---|---|---:|:-:|:-:|---|---|
| **Configra** | substrate | **1.80** | NO (borderline) | 1 | L1-L3 (modularity) | L57 (metrics) |
| **pheno-config** | substrate | **1.76** | NO | 2 | L1-L3 (modularity) | L57 (metrics), L62 (backup) |
| **pheno-otel** | substrate | **1.77** | NO | 2 | L1-L3 (modularity) | L57, L62, L63 |
| **pheno-capacity** | substrate | **1.83** | NO | 1 | L20-L27 (quality) | L57 (metrics) |
| **nanovms** | active app | **2.32** | **YES** | 0 | L21, L52, L61, L69, L70 | L33, L37, L46, L57 |

**Cycle 4 mean: 1.90** (5 repos)
**Cycle 4 median: 1.80** (Configra / pheno-config / pheno-otel / pheno-capacity)
**Cycle 4 range: [1.76, 2.32]** (width 0.56 — tighter than cycles 1-3)

---

## Cumulative State (cycles 1-4, 21 repos total)

| Cycle | Date | Repos | Org mean (cycle) | Cumulative repos | Cumulative mean (weighted) |
|---|---|---:|---:|---:|---:|
| 1 | 2026-06-17 | 5 | 1.30 (baseline) | 5 | 1.30 |
| 2 (probe) | 2026-06-20 | 7 | 1.50 | 12 | 1.41 |
| 3 (my-domain) | 2026-06-20 | 4 | 1.92 | 16 | 1.51 |
| **4 (final batch)** | **2026-06-20** | **5** | **1.90** | **21** | **~1.60** |

**Org mean (cumulative, 21 repos):** **~1.60** (cycles 1-4 weighted)
**Repos passing (≥2.00):** 5 of 21 (~24%) — the first-pass gap is large
**Repos with P0 gaps remaining:** ~16 of 21 (~76%)

**Trend:** Each cycle is biased to higher-mean repos as the easy ones get pulled up first. Cycle 1 (baseline): 1.30 → Cycle 2 (probe): 1.50 → Cycle 3 (my-domain): 1.92 → Cycle 4 (final batch): 1.90. The slight dip in cycle 4 is because we're hitting the four canonical config/observability/capacity substrates (1.76-1.83) before reaching `nanovms` (2.32).

**Asymptote forecast:** The "natural" mean ceiling for the active fleet under the current scoring rubric is **~1.90** (3 of 5 cycle-4 repos clustered at 1.76-1.83, none broke 2.00). To break 2.00 org-wide, the substrate fleet needs the L57 (metrics) + L62 (backup) + L63 (capacity) gaps closed in CI — these are **observability & ops** pillars, not architecture or quality.

---

## P0 Gaps Remaining (cycle 4, all 5 repos)

| Pillar | Theme | Repos with P0 | Severity |
|---|---|---|:-:|
| **L57 metrics (RED/USE)** | Observability | All 5 (Configra, pheno-config, pheno-otel, pheno-capacity, nanovms) | **P0 (fleet-wide)** |
| **L13 latency budgets** | Performance | nanovms (most acute; SPEC.md has targets but no CI gate) | **P0 (nanovms)** |
| **L62 backup/restore** | Ops | 4 of 5 (n/a for nanovms runtime) | P1 (n/a for runtime) |
| **L63 capacity planning** | Ops | All 5 | P1 (no capacity model in fleet) |
| **L58 distributed tracing** | Observability | All 5 | P1 (no OTLP cross-tier) |
| **L33 hot reload** | DX | 3 of 5 (pheno-config, pheno-otel, pheno-capacity) | P2 |
| **L37 dev container** | DX | 4 of 5 | P2 |
| **L46 IAM** | Security | 4 of 5 (CLI/substrate — not a real gap; fleet is single-tenant) | P3 |
| **L7 threat modeling** | Security | Configra, pheno-config, pheno-otel | P2 |
| **L26 chaos testing** | Quality | 4 of 5 | P2 |

**Pattern:** The **single P0 root cause** is **L57 metrics**. Closing L57 in `pheno-otel` (the substrate) cascades to all 4 other repos (Configra, pheno-config, pheno-capacity, nanovms) when they adopt it. **Adding `pheno-otel::metrics` to the substrate quality bar (ADR-023 + ADR-040) is the highest-leverage move in the fleet.**

---

## Recommended Next Cycle (cycle 5, Monday 2026-06-22 09:00 PDT)

**Theme:** L57 (metrics) + observability substrate sweep.

**Targets (5 repos):**
1. **`pheno-tracing`** — re-audit after L57 metrics added (cycle 2 baseline was 1.55; target ≥1.85)
2. **`pheno-otel`** — re-audit after L57 metrics feature lands in v0.4.0
3. **`pheno-mcp-router`** — re-audit after L58 OTLP cross-tier tracing added (ADR-013 substrate)
4. **`phenotype-bus`** — re-audit after L57 metrics added (event bus substrate)
5. **`phenotype-hub`** — re-audit after L57 metrics added (framework substrate)

**Move count target:** Cycle 5 should close L57 in at least 3 of 5 cycle-5 repos. Org mean projection: **1.60 → 1.70** (after cycle 5).

**L57 acceptance gate (proposed for ADR-040 amendment):**

> A substrate passes L57 if it exposes at minimum: a request count, a request duration histogram, an error count, and a saturation metric — all via `pheno-otel::metrics` (or compatible OTel SDK). The CI gate runs a smoke test that scrapes `/metrics` and asserts the 4 metrics are present.

This codifies the **substrate quality bar** at the observability level (L57 is the 5th pillar in the 9-pillar Fleet-Critical set, per `findings/71-pillar-2026-06-17-schema.md`).

---

## Risks & Caveats

1. **Single-scorer bias.** All 5 cycle-4 scores were produced by the Forge orchestrator (me). Cycle 5 onwards should rotate scorers (muse subagent, or human review) to detect score drift.
2. **Nanovms is the only passing repo** in cycle 4 — 4 of 5 are at the 1.76-1.83 cluster. This is the **"substrate plateau"**: 12-factor + 71-pillar gets you to ~1.80; to break 2.00 you need **CI-gated benchmarks + metrics**.
3. **L57 root-cause is structural.** It's not "we forgot to add metrics"; it's "we don't have a metrics substrate yet" (pheno-otel has exporters but no application-level metrics facade). The fix is a **new `pheno-otel::metrics` module** (or a separate `pheno-metrics` substrate), not just adding a counter to each repo.
4. **The 71-pillar rubric under-weights observability.** L56-L63 is 8 of 71 pillars (~11%); 4 of those 8 are common-P0 across the fleet. Consider a rubric rebalance in cycle 6 (proposal: bump L57-L63 to 12 of 71 ~17%, with a corresponding drop in L1-L12).

---

## Scorecard (cycle 4, all 5)

```
Configra       [1.80]  Architecture: 2.17 | Performance: 1.57 | Quality: 1.88 | DX: 1.70 | UX: 2.38 | Security: 1.60 | Observability: 1.00 | Docs: 2.00 | Governance: 2.00
pheno-config   [1.76]  Architecture: 2.17 | Performance: 1.57 | Quality: 1.63 | DX: 1.70 | UX: 2.50 | Security: 1.60 | Observability: 1.00 | Docs: 1.60 | Governance: 2.00
pheno-otel     [1.77]  Architecture: 2.25 | Performance: 1.57 | Quality: 1.63 | DX: 1.70 | UX: 2.50 | Security: 1.60 | Observability: 1.00 | Docs: 1.60 | Governance: 2.00
pheno-capacity [1.83]  Architecture: 2.25 | Performance: 1.57 | Quality: 2.00 | DX: 1.70 | UX: 2.50 | Security: 1.80 | Observability: 0.88 | Docs: 1.60 | Governance: 2.00
nanovms        [2.32]  Architecture: 2.67 | Performance: 1.57 | Quality: 2.50 | DX: 2.60 | UX: 2.75 | Security: 2.30 | Observability: 1.13 | Docs: 2.80 | Governance: 2.67
```

**Per-domain mean (cycle 4, 5 repos):**
- Architecture: **2.30** (7th highest domain)
- Performance: **1.57** (lowest of non-observability domains)
- Quality: **1.93** (close to passing)
- DX: **1.88** (close to passing)
- UX: **2.53** (passes — CLI docs are good)
- Security: **1.78** (fails — needs L46 IAM + L51 audit)
- Observability: **1.00** (lowest domain — L57 is the bottleneck)
- Docs: **1.92** (close to passing)
- Governance: **2.13** (passes — `AGENTS.md` adoption working)

**The 2 passing domains (UX, Governance) are driven by the 71-pillar framework itself** (AGENTS.md + SPEC.md + 71-pillar audit cycle). The 1 failing domain (Observability) is the **next bottleneck** to fix for the org to break 2.00 mean.

---

## Next Steps (cycle 5 owner actions)

1. **Open ADR-040 amendment** adding L57 metrics gate to the substrate quality bar. Owner: `pheno-otel` maintainer. Due: cycle 5 prep (Sunday 2026-06-21).
2. **Add `pheno-otel::metrics` module** (or new `pheno-metrics` substrate) — Prometheus + OTLP metrics facade. Owner: TBD. Due: cycle 6 (2026-06-29).
3. **Re-score 5 cycle-5 repos** with the new L57 gate. Owner: worklog-schema circle. Due: Monday 2026-06-22 09:00 PDT.
4. **Update 71-pillar schema** to bump L57-L63 weight to 12 of 71 (optional, cycle 6+).

---

*Generated 2026-06-20 by Forge orchestrator (T13 batch 9F cycle 4). Cumulative across 4 cycles, 21 repos. Transitioning to weekly Monday 09:00 PDT cadence per ADR-041.*
