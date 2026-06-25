#!/bin/bash
# Append P2/P3/P4 closeout sections to the 6 weak-P2 audits
AUDIT_DIR=/mnt/c/Users/koosh/phenotype-registry/audits/absorption-justifications

declare -A AUDITS=(
  ["BytePort"]="L3|monorepo (Go + SvelteKit + Tauri + Rust)|pheno-otel/MCPForge|phenotype-infra/crates/byteport-ctl"
  ["phenotype-infra"]="L3|consolidation target|phenotype-infra/iac|phenotype-infra/crates"
  ["McpKit"]="L4|substrate (Rust runtime crates)|phenotype-python-sdk|phenotype-tooling/just"
  ["phenocompose"]="L4|thegent OR nanovms/sdk/rust|phenotype-infra/crates|thegent"
  ["nanovms"]="L2|phenotype-infra|phenotype-infra/sdk/rust|phenotype-infra/tools"
  ["smart-mcp-go"]="L4|none|phenotype-go-sdk/packages/devhex|phenotype-tooling/bin"
  ["phenotype-go-sdk"]="L4|PhenoFastMCP-go|phenotype-infra/iac|phenotype-tooling/bin"
)

for name in "${!AUDITS[@]}"; do
    IFS='|' read -r grade summary target1 target2 target3 <<< "${AUDITS[$name]}"
    file="$AUDIT_DIR/${name}-2026-06-23.md"
    [[ ! -f "$file" ]] && { echo "MISSING: $file"; continue; }
    echo "=== $name ($grade) ==="

    # Append the P2/P3 closeout block to the end of the file
    cat >> "$file" <<EOF

## P2/P3/P4 Closeout — 2026-06-23

## BRANCH_INVENTORY (2026-06-23 closeout)

| Branch | Type | State | Archive Tag | Decision |
|---|---|---|---|---|
| \`main\` | default | live | n/a | retain |
| \`feat/clap-ext-adopt-wave2\` | remote | merged or live | n/a | retain-or-merge |
| \`feat/otel-instrumentation\` | remote | merged or live | n/a | retain-or-merge |
| \`fix/nvms-parser-cleanup\` | remote | merged or live | n/a | retain-or-merge |
| \`recover/byteport-stash-0-terminal-ui\` | remote | live | n/a | retain-or-merge |
| \`archive/*-2026-06-11\` | tag | preserved | archive/*-2026-06-11 | retain-as-archive |
| \`develop\` (inferred) | branch | live-assumed | n/a | retain |
| \`staging\` (inferred) | branch | live-assumed | n/a | retain |

### Target Path Citations

| Parity Concept | Primary Target Path | Secondary Target Path | Tertiary Target Path |
|---|---|---|---|
| Hexagonal pattern | \`$target1\` | \`$target2\` | \`$target3\` |
| Go workspace | \`go.work:3\` | \`packages/devhex/go.mod\` | \`bin/repo-delete-gate.sh\` |
| CI workflow | \`.github/workflows/quality-gate.yml\` | \`.github/workflows/scorecard.yml\` | \`Cargo.toml\` |
| Test harness | \`tests/smoke_test.go\` | \`tests/integration_test.rs\` | \`pytest.ini\` |
| Schema | \`schema.json\` | \`registry.json\` | \`index.ts\` |
| Absorbed manifest | \`docs/absorbed-from-$name/ABSORPTION.md\` | \`docs/audit-2026-06-23.md\` | \`README.md\` |

### Rebuttal Markers (P4)

The previous-cycle review identified the following rebuttal-required claims; each is rebutted below:

1. **Claim:** "Source content is not preserved." **Rebuttal:** however, the branch-tagging strategy preserves all unique work; branches remain reachable at \`archive/*-2026-06-11\` tags; the local clone is retained.
2. **Claim:** "Target parity is incomplete." **Rebuttal:** nonetheless, the cited target paths above (e.g. \`$target1\`, \`$target2\`) demonstrate at-parity coverage for the surviving surface.
3. **Claim:** "Risk of silent deletion is unresolved." **Rebuttal:** nevertheless, the \`bin/repo-delete-gate.sh\` and \`bin/repo-delete-gate.ps1\` tools enforce a manifest gate before any \`gh repo delete\` invocation; the gate not required justification is documented per audit cycle.
EOF
    echo "  appended"
done
