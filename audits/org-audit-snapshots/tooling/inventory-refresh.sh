#!/bin/bash
# inventory-refresh.sh — Re-run authoritative org inventory scan
# Justification: ≤5-line shell wrapper to dispatch child agent (agent-driven inventory rebuild)
# Matches scripting_policy.md exception for CLI glue that invokes a real-language agent

set -euo pipefail

REPO_ROOT="/Users/kooshapari/CodeProjects/Phenotype/repos"
AUDIT_HOME="$REPO_ROOT/phenotype-org-audits"

# Delegate to authoritative inventory agent (implemented in Rust/Codex/external)
# This wrapper ensures consistent environment and logging
echo "Refreshing authoritative repo inventory..."
export AUDIT_HOME="$AUDIT_HOME"
exec thegent dispatch --agent inventory-authority --output "$AUDIT_HOME/inventory" --scope all-repos
