# v29-T4 — L27.1 Contract Test Fleet Adoption (P1→3.0)

## What
Run Pact contract tests in CI for at least 2 service pairs.

## Action
- Add `pact-consumer/` test suite to `PhenoCompose CI (.github/workflows/ci.yml)`
- Add `pact-provider/` verification step in `pheno-ci-templates/ci.yml`
- Both run `cargo test --test pact_*` on every PR.

Ref: `pact-consumer/` (exists from v20 T2)
