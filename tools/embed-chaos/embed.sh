#!/usr/bin/env bash
set -euo pipefail
# v35 3e-Embed T5: Embed chaos-scenarios config in every fleet repo.
REPO_ROOT="${1:-.}"
for dir in "$REPO_ROOT"/*/; do
  if [ -d "$dir/.github" ]; then
    chaos_dir="$dir/chaos-scenarios"
    if [ ! -d "$chaos_dir" ]; then
      echo "EMBED chaos-scenarios: $dir"
      mkdir -p "$chaos_dir"
      cat > "$chaos_dir/config.toml" <<+CONF+
[chaos]
enabled = true
scenarios = ["network-partition", "peer-drop", "high-latency", "resource-exhaustion"]
schedule = "weekly"
+CONF+
    fi
  fi
done
echo "T5 chaos embed: complete"
