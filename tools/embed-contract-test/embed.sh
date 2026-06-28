#!/usr/bin/env bash
set -euo pipefail
# v35 3e-Embed T4: Embed pact-stub config in every subscriber repo.
REPO_ROOT="${1:-.}"
for dir in "$REPO_ROOT"/*/; do
  if [ -d "$dir/.github" ]; then
    pact_dir="$dir/pact-stub"
    if [ ! -d "$pact_dir" ]; then
      echo "EMBED pact-stub: $dir"
      mkdir -p "$pact_dir"
      cat > "$pact_dir/config.json" <<+CONF+
{
  "port": 1234,
  "provider": "${dir%/}",
  "pact_dir": "./pacts"
}
+CONF+
    fi
  fi
done
echo "T4 contract-test embed: complete"
