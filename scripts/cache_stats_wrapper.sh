#!/usr/bin/env bash
# scripts/cache_stats_wrapper.sh — v12 T10 L31 CI cache statistics wrapper
# Scans a CI log file for `Cache hit` and `Cache miss` lines, emits JSON.
# Usage: ./scripts/cache_stats_wrapper.sh <ci-log-file> [repo-name]
# Output: JSON to stdout.

set -euo pipefail

LOG_FILE="${1:-}"
REPO="${2:-${REPO:-local}}"

if [ -z "$LOG_FILE" ] || [ ! -f "$LOG_FILE" ]; then
    echo "usage: $0 <ci-log-file> [repo-name]" >&2
    exit 1
fi

hits=$(grep -c 'Cache hit' "$LOG_FILE" 2>/dev/null || echo 0)
misses=$(grep -c 'Cache miss' "$LOG_FILE" 2>/dev/null || echo 0)
total=$((hits + misses))
if [ "$total" -gt 0 ]; then
    rate=$(awk -v h="$hits" -v t="$total" 'BEGIN{printf "%.3f", h/t}')
else
    rate="0.000"
fi

if command -v jq >/dev/null 2>&1; then
    jq -n \
        --arg repo "$REPO" \
        --argjson hit "$hits" \
        --argjson miss "$misses" \
        --arg rate "$rate" \
        '{repo: $repo, hit_count: $hit, miss_count: $miss, hit_rate: ($rate | tonumber)}'
else
    # Fallback without jq
    printf '{"repo":"%s","hit_count":%d,"miss_count":%d,"hit_rate":%s}\n' \
        "$REPO" "$hits" "$misses" "$rate"
fi
