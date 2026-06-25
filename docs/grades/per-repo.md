# Per-Repro Breakdown

> Detailed check-by-check grade for each compute/infra repo.

## phenotype-infra

- **Stack:** rust | **Mode:** fast | **Score:** 0/10 (0%) | **Grade:** F
- **Timestamp:** 2026-06-25T03:09:55Z

| Check | Status | Score | Max | Detail |
|-------|--------|-------|-----|--------|
| build | fail | 0 | 2 | cargo: command not found |
| test-unit | fail | 0 | 3 | cargo: command not found |
| fmt | fail | 0 | 2 | cargo: command not found |
| clippy | fail | 0 | 2 | cargo: command not found |
| deny | skipped | 0 | 1 | skipped in fast mode |
| doc | fail | 0 | 1 | cargo: command not found |
| test-snapshot | skipped | 0 | 1 | skipped in fast mode |
| test-fuzz | skipped | 0 | 1 | skipped in fast mode |
| coverage | skipped | 0 | 2 | skipped in fast mode |
| audit | skipped | 0 | 1 | skipped in fast mode |
| bench | skipped | 0 | 1 | skipped in fast mode |

## PhenoCompose

- **Stack:** rust | **Mode:** full | **Score:** 0/17 (0%) | **Grade:** F
- **Timestamp:** 2026-06-25T02:59:10Z

| Check | Status | Score | Max | Detail |
|-------|--------|-------|-----|--------|
| build | fail | 0 | 2 | cargo: command not found |
| test-unit | fail | 0 | 3 | cargo: command not found |
| fmt | fail | 0 | 2 | cargo: command not found |
| clippy | fail | 0 | 2 | cargo: command not found |
| deny | fail | 0 | 1 | cargo: command not found |
| doc | fail | 0 | 1 | cargo: command not found |
| test-snapshot | fail | 0 | 1 | cargo: command not found |
| test-fuzz | fail | 0 | 1 | cargo: command not found |
| coverage | fail | 0 | 2 | cargo: command not found |
| audit | fail | 0 | 1 | cargo: command not found |
| bench | fail | 0 | 1 | cargo: command not found |

## BytePort

- **Stack:** rust | **Mode:** full | **Score:** 0/17 (0%) | **Grade:** F
- **Timestamp:** 2026-06-25T03:18:50Z

| Check | Status | Score | Max | Detail |
|-------|--------|-------|-----|--------|
| build | fail | 0 | 2 | resolver setting `3` is not valid |
| test-unit | fail | 0 | 3 | resolver setting `3` is not valid |
| fmt | fail | 0 | 2 | channel update |
| clippy | fail | 0 | 2 | resolver setting `3` is not valid |
| deny | fail | 0 | 1 | resolver setting `3` is not valid |
| doc | fail | 0 | 1 | resolver setting `3` is not valid |
| test-snapshot | fail | 0 | 1 | resolver setting `3` is not valid |
| test-fuzz | fail | 0 | 1 | resolver setting `3` is not valid |
| coverage | fail | 0 | 2 | command not found |
| audit | fail | 0 | 1 | skipped in fast mode |
| bench | fail | 0 | 1 | command not found |

## nanovms

- **Stack:** node | **Mode:** fast | **Score:** 1/13 (7%) | **Grade:** F
- **Timestamp:** 2026-06-25T03:15:39Z

| Check | Status | Score | Max | Detail |
|-------|--------|-------|-----|--------|
| install | pass | 1 | 1 | |
| build | fail | 0 | 2 | vitepress build error |
| test-unit | fail | 0 | 3 | Missing script: "test" |
| lint | fail | 0 | 2 | ESLint: 9.25.1 error |
| fmt | fail | 0 | 2 | Prettier: 3 files unformatted |
| typecheck | fail | 0 | 2 | tsc error |
| test-e2e | skipped | 0 | 2 | skipped in fast mode |
| test-perf | skipped | 0 | 1 | skipped in fast mode |
| test-mutation | skipped | 0 | 1 | skipped in fast mode |
| coverage | skipped | 0 | 2 | skipped in fast mode |
| audit | fail | 0 | 1 | esbuild CVE moderate |
