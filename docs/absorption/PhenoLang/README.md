# PhenoLang absorption disposition

Date: 2026-06-20
Source repo: `KooshaPari/PhenoLang`
Local path: `/Users/kooshapari/CodeProjects/Phenotype/repos/PhenoLang`
Observed branch: `main`
Observed state: clean after clone

## Executive decision

`ARCHIVE_ONLY` for now. Do not delete `PhenoLang` yet.

`PhenoLang` is not a tight language-domain repository. Its README defines it as a repos shelf / organizational layer, and its `Cargo.toml` contains many unrelated Rust crate families. Deletion is not justified until each crate family is either moved to a tighter owner, intentionally deprecated, or preserved as a patch/archive exception.

## Source inventory summary

| Source item | Evidence | Category | Source state | Target repo | Target evidence | Status | Required action |
|---|---|---|---|---|---|---|---|
| Organizational shelf docs | `README.md` says repos shelf; `projects/INDEX.md` referenced | Product intent | docs-only | `phenotype-registry` | registry is canonical index | `PARTIAL` | migrate useful shelf index/governance references into registry, then retire shelf docs |
| AgilePlus crate family | `crates/agileplus-*` | App/domain implementation | implemented | `AgilePlus` | active app repo per governance | `PARTIAL` | compare crate-by-crate; preserve only unique Rust substrate pieces |
| OmniRoute core | `crates/omniroute-core` | Runtime/tooling core | implemented | OmniRoute / infra target TBD | local governance mentions OmniRoute separately | `NOT_COVERED` | audit against OmniRoute before deletion |
| Foundational Rust utility crates | `crates/phenotype-crypto`, `phenotype-test-infra`, `phenotype-string`, `phenotype-time`, `phenotype-iter` | Rust utilities | implemented | `phenoUtils` | target has `pheno-crypto`, `pheno-testing`, `pheno-fs`, `pheno-net`, `pheno-shell` | `PARTIAL` | compare APIs/tests; migrate only non-duplicative utilities |
| Error crates | `phenotype-error-core`, `phenotype-error-macros`, `phenotype-errors` | Error substrate | implemented | pheno-errors / Rust SDK target TBD | not checked in this pass | `NOT_COVERED` | audit against canonical error substrate |
| Config crate | `phenotype-shared-config` | Config substrate | implemented | `Configra` | ADR-031 says Configra canonical | `PARTIAL` | compare with Configra and migrate unique config code |
| MCP crate | `phenotype-mcp` | MCP substrate | implemented | `PhenoFastMCP-rust` | Rust MCP target exists | `PARTIAL` | compare with FastMCP Rust fold before deletion |
| Policy/ports/contracts | `phenotype-policy-engine`, `phenotype-port-traits`, `phenotype-ports-canonical`, `phenotype-contract*` | Architecture substrate | implemented | `phenokits-commons` / specific substrate TBD | target too broad; no parity proven | `NOT_COVERED` | assign tight owner before deletion |
| Telemetry/logging/health/http | `phenotype-telemetry`, `phenotype-logging`, `phenotype-health`, `phenotype-http-client-core` | Observability/ops substrate | implemented | pheno-otel / observability target TBD | not checked in this pass | `NOT_COVERED` | audit against observability substrate |
| Case-colliding GitHub templates | clone warning: `.github/PULL_REQUEST_TEMPLATE.md` and `.github/pull_request_template.md` | Governance artifact | broken on case-insensitive FS | `phenotype-registry` | this doc records warning | `LAST_RESORT_EXCEPTION` | preserve before any destructive cleanup |

## Deletion recommendation

Do not delete yet. `PhenoLang` should be archived/read-only after the above families are drained, but current evidence supports only `ARCHIVE_ONLY`, not `DELETE`.

## Immediate next actions

1. Compare utility-like crates against `phenoUtils` and migrate only net-new APIs/tests.
2. Compare `phenotype-mcp` against `PhenoFastMCP-rust`.
3. Compare config/error/telemetry crates against their canonical substrate repos.
4. Preserve the case-colliding `.github` governance files before any filesystem cleanup.
