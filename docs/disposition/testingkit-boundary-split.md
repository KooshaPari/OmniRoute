# TestingKit boundary split (NB lane, P4 #96)

**Date:** 2026-06-19  
**Authority:** `BOUNDARY_OWNERS.md` § Testing / QA  
**Lane:** Non-blocker (ECOSYSTEM_DAG.md NB table)  
**Gate:** `gate-testingkit` — **HOLD DELETE**; never delete TestingKit per Block-C disposition

## Doctrine

File parity between archived `KooshaPari/TestingKit` and `phenotype-python-sdk/packages/testing-kit/` does **not** close the testing boundary. Testing spans multiple capability slices; each slice has a distinct canonical owner.

## Slice matrix

| Slice | Canonical owner | Install / dep pattern | Status |
|-------|-----------------|----------------------|--------|
| MCP QA, pytest plugins, quality CLIs (Python) | **phenotype-python-sdk** `packages/testing-kit/python` | `pip install phenotype-sdk[test]` (target) or path dep on SDK | Reconciled — SDK PR #14; [mcp-qa reconcile](https://github.com/KooshaPari/phenotype-python-sdk/blob/main/packages/testing-kit/docs/operations/testing-kit-mcp-qa-reconcile.md) |
| Rust BDD (`phenotype-bdd`) | **TestingKit** `rust/phenotype-bdd` | `git` dep on TestingKit | Done — TestingKit#1; HexaKit exclude |
| Rust contract tests (`phenotype-contract`) | **TestingKit** `rust/phenotype-contract` | `git` dep on TestingKit | Done — TestingKit#9 |
| Rust test fixtures / infra | **TestingKit** `rust/phenotype-test-fixtures`, `rust/phenotype-test-infra` | `git` dep on TestingKit | Done — HexaKit#264/#271 git pins |
| xDD / BDD / property / mutation (Rust, long-term) | **phenoXddLib** (not HexaKit) | TBD — decompose from archive | Open |
| E2E journey harness | **phenotype-journeys** | Journey scenarios + fleet E2E | Terminal per [bdd-journeys-canonical.md](./bdd-journeys-canonical.md) |
| Per-repo test scaffolds (Playwright, CI harness) | **phenokits-commons** | Copy-on-bootstrap | Open |
| Org CI policy workflows | **phenotype-org-governance** + HexaKit `.template.*` | Reusable workflow refs | AFFIRM |

## Consumer guidance

1. **Python test tooling** — depend on `phenotype-python-sdk` `packages/testing-kit`, not archived TestingKit Python paths.
2. **Rust testing crates** — depend on `KooshaPari/TestingKit` `rust/` members; do not add HexaKit path deps on evicted crates.
3. **E2E journeys** — depend on `phenotype-journeys`; BDD crate in TestingKit is interim Rust only.

## Delete gate

TestingKit archive delete is **blocked** until:

- All slices above have explicit consumer defaults documented in registry + SDK
- `BOUNDARY_OWNERS.md` 5-check gate passes for each inbound absorption
- `gate-testingkit` row transitions from `hold` only with explicit user sign-off

## Cross-references

- Registry: `BOUNDARY_OWNERS.md`, `ECOSYSTEM_MAP.md` Cluster I
- SDK: `packages/testing-kit/docs/boundary/testingkit-boundary-split.md`
- Block-C: [TestingKit#6](https://github.com/KooshaPari/TestingKit/pull/6), [python-sdk DISPOSITION](https://github.com/KooshaPari/phenotype-python-sdk/blob/main/docs/boundary/DISPOSITION.md)
