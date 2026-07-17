# L71..L80 — Eval Coverage (the 10 eval-coverage pillars)

**Tier:** 1 (continually extended)
**Owner:** Lane owner (Forge)
**Date:** 2026-06-23

## Scope

The 10 eval-coverage pillars extend the 71+ pillar system to capture
*what the lane actually owns* — the eval/benchmark/QA layer. These
pillars are the SOTA 2026 set for an organisation that treats "the
ability to evaluate" as a first-class product surface, not a side
hobby.

## Pillars (one per bullet)

| # | Pillar | 0=missing | 1=seeded | 2=partial | 3=complete |
|---|--------|-----------|----------|-----------|------------|
| L71 | **Eval corpus coverage** (parity with production use) | absent | 1 task | 1 task/family | 999 tasks across 5 langs |
| L72 | **Benchmark suite** (criterion+hyperfine+in-house) | absent | one tool | two tools | full toolbelt + regression gate |
| L73 | **Microbench + macrobench + load test** (3-tier) | absent | micro only | micro+macro | 3-tier with SLO |
| L74 | **Regression detection** (per-PR perf gate) | absent | nightly | per-PR | per-PR + flaky test quarantine |
| L75 | **Cross-language parity** (Rust+Py+Go+TS) | absent | one pair | 2 pairs | full SOTA 2026 stack |
| L76 | **Agent-eval pipeline** (portage/Harbor) | absent | one env | 2 envs | 6 envs + RL env |
| L77 | **Compression / spec-extraction benchmarks** | absent | one script | one suite | full DEFLATE+DFlash+speculative |
| L78 | **Cost / token-burn tracking** (per-eval) | absent | one report | per-model | per-model+per-route+per-pillar |
| L79 | **Eval reproducibility** (seed, env, lockfile) | absent | one pin | env+seed | env+seed+lockfile+SHA |
| L80 | **Eval governance** (which eval, when, by whom) | absent | one ADR | per-pillar ADRs | org-wide eval policy |

## SOTA 2026 reference

- **Terminal-Bench / Harbor** — the de-facto agent-eval framework. Our
  portage repo is a fork; coverage of 6 env providers (Docker, Modal,
  Daytona, E2B, GKE, RunLoop) is SOTA 2026.
- **SWE-bench / SWE-RL** — SWE-bench-style ripgrep-eval tasks with
  diff-similarity reward; pheno-harness has 999 such tasks.
- **Eval-driven development** — same relationship as TDD but at the
  *organisational* level: every feature ships with a measurable
  evaluation.
- **criterion 0.8 / hyperfine / psutil** — the SOTA microbench stack
  for Rust, polyglot, and Python.
- **OpenAI Evals / Anthropic Claude Evals / HuggingFace Lighteval** —
  the three major LLM-eval harnesses; portage is a fork of the
  Terminal-Bench family.

## Per-repo state (2026-06-23 snapshot)

| Repo | L71 | L72 | L73 | L74 | L75 | L76 | L77 | L78 | L79 | L80 | avg |
|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Benchora | 0 | 3 | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 1 | 1.0 |
| portage | 2 | 1 | 1 | 2 | 2 | 3 | 0 | 1 | 2 | 1 | 1.5 |
| pheno-harness | 3 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 1 | 1.8 |
| phenodag | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| Tracera | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0.1 |
| heliosBench | 0 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0.4 |
| nanovms | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| PhenoCompose | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| BytePort | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| AgilePlus | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| registry | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| audits | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0.3 |
| vibeproxy | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |

**Cross-repo finding:** the lane is at **~0.1/3 on eval-coverage**
(median across 13 repos × 10 pillars). The two clear leaders are
**pheno-harness** (1.8) and **portage** (1.5) — these are the
**lane's core differentiators**. Benchora is at 1.0 and growing.

**Tier-1 quick-fix list:**

1. Cross-link the 999 pheno-harness tasks to portage via
   `pheno_harness_to_portage.py` (DAG-T5) — L71, L76.
2. Add a **per-PR perf gate** to Benchora using the new env-threshold
   (DAG-T11) — L74.
3. Wire **portage's harbor** env-provisioning into pheno-harness's
   terminal-bench harness (cross-repo) — L76.
4. Publish an **org-wide eval policy** in `phenotype-registry` — L80.

## Cross-references

- Audit L31..L40 (security), L41..L50 (observability), L51..L60
  (supply-chain), L61..L70 (DX/Qeng/portability) — see sibling files.
- Audit L0..L30 (the existing 25 architecture/quality pillars) —
  [`./audit-30-pillar-L0.md`](./audit-30-pillar-L0.md) (etc.).
- DAG v2 —
  [`../../../plans/2026-06-23-eval-bench-qa-dag-v2.md`](../../../plans/2026-06-23-eval-bench-qa-dag-v2.md) (DAG-T4).
- Pillar scorecard (numeric per repo) —
  [`../pillar-scores/2026-06-23.json`](../pillar-scores/2026-06-23.json).
- Adapter: [`../../../portage/adapters/pheno_harness_to_portage.py`](../../../portage/adapters/pheno_harness_to_portage.py).
- Semantic scorer: [`../../../Tracera/src/tracertm/scoring/semantic_scorer.py`](../../../Tracera/src/tracertm/scoring/semantic_scorer.py).
