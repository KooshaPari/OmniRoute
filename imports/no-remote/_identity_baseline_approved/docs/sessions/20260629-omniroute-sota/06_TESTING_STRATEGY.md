# OmniRoute Router-Eval Testing Strategy

## Focused Gates

```bash
bun run test:router-eval:bun
/opt/homebrew/bin/oxlint src/lib/routerEval/index.ts scripts/router-eval/index.ts tests/unit/router-eval.test.ts tests/unit/router-eval-cli.test.ts
```

## Verified Evidence

- `bun run test:router-eval:bun`
  - 10 tests passed across `tests/unit/router-eval.test.ts` and
    `tests/unit/router-eval-cli.test.ts`.
- `oxlint`
  - 0 warnings and 0 errors across the router-eval source and tests.
- Bun CLI smoke
  - `bun scripts/router-eval/index.ts --input <jsonl> --json --out <file>`
    emits the JSON report to stdout and writes the same artifact to disk.

## Coverage

- JSONL replay to markdown report.
- JSON report artifact with `--json --out`.
- Baseline comparison with regression exit code.
- JSON comparison artifact with `--json --out --fail-on-regression`.
- SQLite `call_logs` replay from a temp `storage.sqlite` via `--db`.
- Core parsing, aggregation, Pareto frontier, comparison, and report formatting.

## Known Gaps

- Thresholded regression policy is not configurable yet.
