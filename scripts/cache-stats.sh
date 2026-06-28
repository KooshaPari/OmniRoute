#!/bin/bash
# cache-stats.sh — L31 CI cache stats extension (v53 T2)
# Aggregates cache usage across active repos: total bytes, cached runs count,
# and per-repo breakdown. Reports in markdown table format.
set -euo pipefail

REPOS=("phenotype-router" "pheno-context" "pheno-runtime-config" "pheno-tracing")
GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token 2>/dev/null || echo '')}"

echo "## CI Cache Stats — $(date -u +%Y-%m-%d)"
echo ""
echo "| Repo | Cache Size (MB) | Cached Runs | Last Cached |"
echo "|------|----------------:|------------:|-------------|"

total_size=0
total_runs=0

for repo in "${REPOS[@]}"; do
  size=0
  runs=0
  last="never"

  # Try to get cache info from GitHub Actions API
  if [ -n "$GITHUB_TOKEN" ]; then
    cache_data=$(gh api "repos/KooshaPari/${repo}/actions/caches" 2>/dev/null || echo '{"actions_caches":[]}')
    size=$(echo "$cache_data" | python3 -c "
import sys, json
d = json.load(sys.stdin)
total = sum(c.get('size_in_bytes', 0) for c in d.get('actions_caches', []))
print(total // 1048576)  # bytes to MB
" 2>/dev/null || echo "0")

    runs=$(echo "$cache_data" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(len(d.get('actions_caches', [])))
" 2>/dev/null || echo "0")

    last=$(echo "$cache_data" | python3 -c "
import sys, json
d = json.load(sys.stdin)
caches = d.get('actions_caches', [])
if caches:
    print(max(c.get('created_at', 'never') for c in caches)[:10])
else:
    print('never')
" 2>/dev/null || echo "never")
  fi

  total_size=$((total_size + size))
  total_runs=$((total_runs + runs))
  printf "| %-30s | %13s | %12s | %s |\n" "$repo" "$size" "$runs" "$last"
done

echo ""
printf "| %-30s | %13s | %12s | %s |\n" "**Total**" "$total_size" "$total_runs" "—"
echo ""
echo "_Cache stats aggregated from GitHub Actions caches API._"
