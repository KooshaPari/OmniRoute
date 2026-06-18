#!/bin/bash
# Parallel scan of all git repos
REPOS_DIR="/Users/kooshapari/CodeProjects/Phenotype/repos"
OUTPUT_FILE="$REPOS_DIR/repo_scan_results.txt"
TEMP_DIR=$(mktemp -d)

# Find all git repos
REPOS=$(for d in "$REPOS_DIR"/*/; do
  if [ -d "$d/.git" ] || [ -f "$d/.git" ]; then
    basename "$d"
  fi
done | sort)

TOTAL=$(echo "$REPOS" | wc -l | tr -d ' ')
echo "Scanning $TOTAL repos in parallel batches..."

scan_one() {
  local repo="$1"
  local repos_dir="$2"
  local temp_dir="$3"
  local rpath="$repos_dir/$repo"
  
  # Get current branch / HEAD info
  local branch
  branch=$(git -C "$rpath" symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
  
  local stashes
  stashes=$(git -C "$rpath" stash list 2>/dev/null)
  
  local status
  status=$(git -C "$rpath" status --short 2>/dev/null)
  
  local log
  log=$(git -C "$rpath" log --oneline -5 2>/dev/null)
  
  # Write to temp file only if interesting
  if [ -n "$stashes" ] || [ -n "$status" ] || [ "$branch" = "DETACHED" ]; then
    local outfile="$temp_dir/$repo.txt"
    echo "--- $repo ---" > "$outfile"
    echo "  Branch: $branch" >> "$outfile"
    
    if [ -n "$stashes" ]; then
      echo "  Stashes:$(echo "$stashes" | while IFS= read -r line; do echo; echo "    $line"; done)" >> "$outfile"
    fi
    
    if [ -n "$status" ]; then
      echo "  Uncommitted:" >> "$outfile"
      echo "$status" >> "$outfile"
    fi
    
    if [ -n "$log" ]; then
      local log_count
      log_count=$(echo "$log" | wc -l | tr -d ' ')
      echo "  Recent commits (last $log_count):" >> "$outfile"
      echo "$log" | sed 's/^/    /' >> "$outfile"
    fi
  fi
}
export -f scan_one

# Run with xargs -P for parallelism
echo "$REPOS" | xargs -P 24 -I{} bash -c 'scan_one "$@"' _ {} "$REPOS_DIR" "$TEMP_DIR"

# Aggregate results
echo "START: $(date)" > "$OUTPUT_FILE"
echo "Total repos: $TOTAL" >> "$OUTPUT_FILE"
echo "========================================" >> "$OUTPUT_FILE"

# Count
STASH_COUNT=0
DIRTY_COUNT=0
DETACHED_COUNT=0

for f in "$TEMP_DIR"/*.txt; do
  [ -f "$f" ] || continue
  repo_name=$(basename "$f" .txt)
  cat "$f" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

# Count from files
for f in "$TEMP_DIR"/*.txt; do
  [ -f "$f" ] || continue
  if grep -q "Stashes:" "$f" 2>/dev/null; then
    STASH_COUNT=$((STASH_COUNT + 1))
  fi
  if grep -q "Uncommitted:" "$f" 2>/dev/null; then
    DIRTY_COUNT=$((DIRTY_COUNT + 1))
  fi
  if grep -q "Branch: DETACHED" "$f" 2>/dev/null; then
    DETACHED_COUNT=$((DETACHED_COUNT + 1))
  fi
done

echo "========================================" >> "$OUTPUT_FILE"
echo "SUMMARY:" >> "$OUTPUT_FILE"
echo "  Total repos scanned: $TOTAL" >> "$OUTPUT_FILE"
echo "  Repos with stashes: $STASH_COUNT" >> "$OUTPUT_FILE"
echo "  Repos with uncommitted changes: $DIRTY_COUNT" >> "$OUTPUT_FILE"
echo "  Repos in detached HEAD: $DETACHED_COUNT" >> "$OUTPUT_FILE"
echo "END: $(date)" >> "$OUTPUT_FILE"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "======= SCAN COMPLETE ======="
echo "Total repos scanned: $TOTAL"
echo "Repos with stashes: $STASH_COUNT"
echo "Repos with uncommitted changes: $DIRTY_COUNT"
echo "Repos in detached HEAD: $DETACHED_COUNT"
echo "Results written to: $OUTPUT_FILE"
