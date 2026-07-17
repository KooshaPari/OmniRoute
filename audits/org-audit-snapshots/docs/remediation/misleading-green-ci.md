# Misleading-Green CI — Remediation Checklist

- **Status:** OPEN remediation (P3.3)
- **Date:** 2026-06-29
- **Source:** v37 fleet audit `_META-RETROSPECTIVE.md` §3.2 — "Misleading-green CI"
- **Tracking:** issue #65

> "Misleading-green CI" = a workflow that reports **success without actually testing anything**.
> It is worse than no CI: it manufactures false confidence and lets regressions merge under a green check.
> Each offender below must be fixed so the gate fails when the underlying check fails.

---

## Offenders & fixes

### 1. MCPForge — `fr-coverage.yml` echo-gate

- **Defect:** the FR-coverage job `echo`s a success message instead of running a coverage tool;
  the step always exits 0 regardless of real coverage.
- **Fix:**
  1. Replace the `echo` step with a real coverage run (the repo's test+coverage command).
  2. Add a threshold assertion that exits non-zero below the floor (e.g. `--fail-under`/`--check-coverage`).
  3. Remove any `|| true` / `continue-on-error` on that step.
- **Done when:** deleting a tested function makes `fr-coverage.yml` go red.

### 2. KlipDot — `continue-on-error` advisory gates

- **Defect:** quality gates run with `continue-on-error: true`, so failures are reported as warnings
  and the overall check stays green.
- **Fix:**
  1. Remove `continue-on-error: true` from the lint/test/type jobs that are meant to be blocking.
  2. If a gate is genuinely advisory, move it to a separate clearly-named non-required job — do not
     let an advisory job contribute to the green check of a blocking workflow.
- **Done when:** a lint/test failure turns the required check red.

### 3. sharecli — coverage gate over a non-compiling test suite

- **Defect:** the coverage gate runs against a test suite that does not compile; the gate passes
  because zero tests execute (vacuously green).
- **Fix:**
  1. Fix the test suite so it compiles and the tests actually run.
  2. Add a guard that fails CI if **zero** tests were collected/executed (e.g. assert test count > 0,
     or use the runner's `--strict`/`--passWithNoTests=false` equivalent).
  3. Then enforce the coverage threshold.
- **Done when:** a compile error in tests fails CI, and zero-tests-collected fails CI.

---

## Org-wide guardrail (prevents recurrence)

Add a lint check (or PR-review checklist item) to the federation reusable-workflows that flags:

- any CI step that is `echo`-only where a real command is expected,
- `continue-on-error: true` on a job named like a blocking gate,
- coverage/test gates with no "tests collected > 0" assertion.

Wire this via the shared reusable workflows (ties into P2.5 / #65 federation-adoption).

---

## Checklist

- [ ] MCPForge `fr-coverage.yml` runs real coverage + threshold; no `|| true`
- [ ] KlipDot blocking gates drop `continue-on-error`
- [x] sharecli test suite compiles; zero-tests-collected fails CI; coverage enforced (coverage.yml llvm-cov + test-count guard; ci-success fail-on-dep-failure — see KooshaPari/sharecli feat/sharecli-v38-audit-ci-truth)
- [ ] org guardrail (echo-gate / continue-on-error / zero-tests lint) wired into reusable workflows
