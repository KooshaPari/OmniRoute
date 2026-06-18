#!/bin/bash
# Deploy ISSUE_TEMPLATE files to all repos that need them
set +e

TEMPLATES_DIR="/Users/kooshapari/CodeProjects/Phenotype/repos/.templates"
REPORT="/Users/kooshapari/CodeProjects/Phenotype/repos/.templates/deploy_report.txt"
SUMMARY="/Users/kooshapari/CodeProjects/Phenotype/repos/.templates/deploy_summary.txt"

# Find all missing-template repos
repos=()
for d in /Users/kooshapari/CodeProjects/Phenotype/repos/*/; do
  repo=$(basename "$d")
  if [ -d "$d/.github" ] && [ ! -d "$d/.github/ISSUE_TEMPLATE" ]; then
    repos+=("$repo")
  fi
done

echo "Total repos missing ISSUE_TEMPLATE: ${#repos[@]}" | tee "$REPORT"
echo "" | tee -a "$REPORT"

# Track results
declare -a succeeded
declare -a failed
declare -a skipped

for repo in "${repos[@]}"; do
  repo_path="/Users/kooshapari/CodeProjects/Phenotype/repos/$repo"

  # Determine if it's a worktree
  if [ -d "$repo_path/.git" ]; then
    repo_type="repo"
  elif [ -f "$repo_path/.git" ]; then
    repo_type="worktree"
  else
    echo "SKIP (no git): $repo" | tee -a "$REPORT"
    skipped+=("$repo (no git)")
    continue
  fi

  # Create ISSUE_TEMPLATE directory
  mkdir -p "$repo_path/.github/ISSUE_TEMPLATE"

  # Copy template files
  cp "$TEMPLATES_DIR/bug_report.md" "$repo_path/.github/ISSUE_TEMPLATE/bug_report.md"
  cp "$TEMPLATES_DIR/feature_request.md" "$repo_path/.github/ISSUE_TEMPLATE/feature_request.md"
  cp "$TEMPLATES_DIR/security_report.md" "$repo_path/.github/ISSUE_TEMPLATE/security_report.md"
  cp "$TEMPLATES_DIR/question.md" "$repo_path/.github/ISSUE_TEMPLATE/question.md"
  cp "$TEMPLATES_DIR/config.yml" "$repo_path/.github/ISSUE_TEMPLATE/config.yml"

  # Get current branch
  branch=$(git -C "$repo_path" rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -z "$branch" ]; then
    branch="unknown"
  fi

  # Git add and commit
  git -C "$repo_path" add ".github/ISSUE_TEMPLATE/" 2>/dev/null
  add_status=$?

  if [ $add_status -ne 0 ]; then
    echo "FAIL (add): $repo" | tee -a "$REPORT"
    failed+=("$repo (git add failed)")
    continue
  fi

  # Check if there's actually anything to commit
  diff_status=$(git -C "$repo_path" diff --cached --stat 2>/dev/null | wc -l | tr -d ' ')
  if [ "$diff_status" = "0" ]; then
    echo "SKIP (no changes): $repo" | tee -a "$REPORT"
    skipped+=("$repo (no changes)")
    continue
  fi

  git -C "$repo_path" commit -m "Add ISSUE_TEMPLATE: bug, feature, security, question + chooser config" 2>/dev/null
  commit_status=$?

  if [ $commit_status -ne 0 ]; then
    echo "FAIL (commit): $repo" | tee -a "$REPORT"
    failed+=("$repo (commit failed)")
    continue
  fi

  echo "OK ($repo_type @ $branch): $repo" | tee -a "$REPORT"
  succeeded+=("$repo ($repo_type @ $branch)")
done

echo "" | tee -a "$REPORT"
echo "===== SUMMARY =====" | tee -a "$REPORT"
echo "Succeeded: ${#succeeded[@]}" | tee -a "$REPORT"
echo "Failed: ${#failed[@]}" | tee -a "$REPORT"
echo "Skipped: ${#skipped[@]}" | tee -a "$REPORT"

if [ ${#failed[@]} -gt 0 ]; then
  echo "" | tee -a "$REPORT"
  echo "Failures:" | tee -a "$REPORT"
  for f in "${failed[@]}"; do
    echo "  - $f" | tee -a "$REPORT"
  done
fi

if [ ${#skipped[@]} -gt 0 ]; then
  echo "" | tee -a "$REPORT"
  echo "Skipped:" | tee -a "$REPORT"
  for s in "${skipped[@]}"; do
    echo "  - $s" | tee -a "$REPORT"
  done
fi
