#!/usr/bin/env bash
# scripts/cache_stats_wrapper.sh — v19 T1 L31 CI cache statistics wrapper
#
# Scans CI log files for "Cache hit" and "Cache miss" lines, emits JSON.
# Modes:
#   single  ./scripts/cache_stats_wrapper.sh <ci-log-file> [repo-name]
#            Emits one JSON record (to stdout).
#   dir     ./scripts/cache_stats_wrapper.sh --dir <log-dir> [repo-name]
#            Scans every *.log under <log-dir>, emits one JSON record per file
#            as a JSONL stream (to stdout).
#   agg     ./scripts/cache_stats_wrapper.sh --aggregate <jsonl-file>
#            Reads a JSONL stream (previous output) and emits a single
#            aggregated summary JSON (sum of hits/misses across records,
#            weighted hit-rate, per-repo breakdown).
#   jsonl   ./scripts/cache_stats_wrapper.sh --jsonl <ci-log-file> <repo> <run-id> <branch> <timestamp>
#            Emits a single record enriched with run metadata (for history.jsonl).
#
# Output: JSON / JSONL to stdout, errors to stderr, exit 0 on success.
# Requires: bash 4+, awk. `jq` is preferred when present; falls back to printf.

set -euo pipefail

usage() {
    cat <<'USAGE' >&2
usage:
  cache_stats_wrapper.sh <log-file> [repo]
  cache_stats_wrapper.sh --dir <log-dir> [repo]
  cache_stats_wrapper.sh --jsonl <log-file> <repo> <run-id> <branch> <iso8601>
  cache_stats_wrapper.sh --aggregate <jsonl-file>
USAGE
    exit 64
}

count_hits() {
    grep -c 'Cache hit' "$1" 2>/dev/null || echo 0
}
count_misses() {
    grep -c 'Cache miss' "$1" 2>/dev/null || echo 0
}
calc_rate() {
    awk -v h="$1" -v t="$2" 'BEGIN{ if (t>0) printf "%.4f", h/t; else print "0.0000" }'
}

emit_record() {
    local repo="$1" hits="$2" misses="$3" rate="$4"
    if [ $# -ge 7 ]; then
        local run_id="$5" branch="$6" ts="$7"
        if command -v jq >/dev/null 2>&1; then
            jq -c -n \
                --arg repo "$repo" \
                --arg run_id "$run_id" \
                --arg branch "$branch" \
                --arg ts "$ts" \
                --argjson hit "$hits" \
                --argjson miss "$misses" \
                --argjson rate "$rate" \
                '{repo:$repo, run_id:$run_id, branch:$branch, timestamp:$ts,
                  hit_count:$hit, miss_count:$miss, hit_rate:$rate}'
        else
            printf '{"repo":"%s","run_id":"%s","branch":"%s","timestamp":"%s","hit_count":%s,"miss_count":%s,"hit_rate":%s}\n' \
                "$repo" "$run_id" "$branch" "$ts" "$hits" "$misses" "$rate"
        fi
    else
        if command -v jq >/dev/null 2>&1; then
            jq -c -n \
                --arg repo "$repo" \
                --argjson hit "$hits" \
                --argjson miss "$misses" \
                --argjson rate "$rate" \
                '{repo:$repo, hit_count:$hit, miss_count:$miss, hit_rate:$rate}'
        else
            printf '{"repo":"%s","hit_count":%s,"miss_count":%s,"hit_rate":%s}\n' \
                "$repo" "$hits" "$misses" "$rate"
        fi
    fi
}

process_log() {
    local log="$1" repo="$2"
    if [ ! -f "$log" ]; then
        echo "cache_stats_wrapper: log not found: $log" >&2
        return 1
    fi
    local hits misses total rate
    hits=$(count_hits "$log")
    misses=$(count_misses "$log")
    total=$((hits + misses))
    rate=$(calc_rate "$hits" "$total")
    if [ $# -ge 5 ]; then
        emit_record "$repo" "$hits" "$misses" "$rate" "$3" "$4" "$5"
    else
        emit_record "$repo" "$hits" "$misses" "$rate"
    fi
}

if [ $# -lt 1 ]; then usage; fi

case "$1" in
    --dir)
        [ $# -ge 2 ] || usage
        dir="$2"
        repo="${3:-${REPO:-local}}"
        if [ ! -d "$dir" ]; then
            echo "cache_stats_wrapper: dir not found: $dir" >&2
            exit 1
        fi
        shopt -s nullglob
        for log in "$dir"/*.log "$dir"/*.txt; do
            base=$(basename "$log")
            file_repo="$repo"
            if [[ "$base" =~ ^(.+)-[0-9]+\.log$ ]]; then
                file_repo="${BASH_REMATCH[1]}"
            fi
            process_log "$log" "$file_repo"
        done
        ;;
    --jsonl)
        [ $# -ge 6 ] || usage
        process_log "$2" "$3" "$4" "$5" "$6"
        ;;
    --aggregate)
        [ $# -ge 2 ] || usage
        jsonl="$2"
        if [ ! -f "$jsonl" ]; then
            echo "cache_stats_wrapper: jsonl not found: $jsonl" >&2
            exit 1
        fi
        if ! command -v jq >/dev/null 2>&1; then
            echo "cache_stats_wrapper: --aggregate requires jq" >&2
            exit 1
        fi
        jq -s '
            {
              total_runs: length,
              total_hits: (map(.hit_count) | add // 0),
              total_misses: (map(.miss_count) | add // 0),
              hit_rate:
                ( (map(.hit_count) | add // 0) as $h
                | (map(.miss_count) | add // 0) as $m
                | (($h + $m) as $t | if $t > 0 then ($h / $t) else 0 end)
                ),
              per_repo: (group_by(.repo)
                | map({
                    repo: .[0].repo,
                    runs: length,
                    hits: (map(.hit_count) | add),
                    misses: (map(.miss_count) | add),
                    hit_rate: ((map(.hit_count) | add) as $h
                             | (map(.miss_count) | add) as $m
                             | (($h + $m) as $t | if $t > 0 then ($h / $t) else 0 end))
                  }))
            }
        ' "$jsonl"
        ;;
    --help|-h) usage ;;
    -*)
        echo "cache_stats_wrapper: unknown flag $1" >&2
        usage
        ;;
    *)
        log="$1"
        repo="${2:-${REPO:-local}}"
        process_log "$log" "$repo"
        ;;
esac
