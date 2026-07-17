---
repo: "PolicyStack"
role: policy
status: absorbed
absorbed_into: "phenotype-python-sdk"
absorbed_at: "phenotype-python-sdk/packages/policystack/"
absorbed_date: 2026-07-17
last_boundary_review: 2026-07-17
review_cadence: never (absorbed)
---

# Boundary — PolicyStack (ABSORBED)

## Disposition

**ABSORBED** into `phenotype-python-sdk/packages/policystack/` on 2026-07-17.

The PolicyStack repo was a Python policy-federation CLI (13.6MB, 21 branches)
with a small Rust wrapper (`wrappers/rust/`). The primary Python code has been
absorbed into the canonical Python SDK as a `policystack` package.

## Content migrated

| Category | Count | Target path |
|----------|-------|-------------|
| Python source | 26 modules (policy_federation package) | `phenotype-python-sdk/packages/policystack/cli/src/policy_federation/` |
| Tests | 46 test files | `phenotype-python-sdk/packages/policystack/tests/` |
| Scripts | 1,263 CI/security/federation scripts | `phenotype-python-sdk/packages/policystack/scripts/` |
| Tools | 4 utility tools | `phenotype-python-sdk/packages/policystack/tools/` |
| Wrappers | 6 agent wrappers (Python) | `phenotype-python-sdk/packages/policystack/wrappers/` |
| Root py/lib | policy_lib.py, resolve.py, validate_governance.py | `phenotype-python-sdk/packages/policystack/` |

Total: 1,350 files, 8.0 MB.

## Rust wrapper (not migrated)

PolicyStack also contained `wrappers/rust/` — a single-file Rust binary CLI
(39KB main.rs, depends on clap/serde/serde_json). This Rust component was NOT
migrated as part of this Python absorption. Its canonical home would be
`phenotype-tooling` if a Rust CLI wrapper is needed.

## Outcome

Source repo `KooshaPari/PolicyStack` archived on GitHub.
Registry disposition-index updated: disposition=ABSORB, target=phenotype-python-sdk.
