#!/bin/bash
set -euo pipefail

REPO_DIR="$1"
cd "$REPO_DIR" || { echo "ERROR: Cannot cd to $REPO_DIR"; exit 1; }

REPO_NAME=$(basename "$(pwd)")
ERRORS=""
PUSHED=""

# Step 2: fetch
git fetch origin 2>&1 || ERRORS+="FETCH_FAILED;"

# Step 3: current branch
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")

# Step 4: stashes
STASHES=$(git stash list 2>/dev/null | wc -l || echo 0)
STASHES=$((STASHES + 0))

# Step 5: dirty files
DIRTY=$(git status --porcelain 2>/dev/null | wc -l || echo 0)
DIRTY=$((DIRTY + 0))

echo "REPO=$REPO_NAME BRANCH=$BRANCH STASHES=$STASHES DIRTY=$DIRTY"

# Step 6: local-only branches
LOCAL_ONLY=""
for b in $(git branch --format='%(refname:short)' 2>/dev/null); do
  if ! git show-ref --verify --quiet "refs/remotes/origin/$b" 2>/dev/null; then
    LOCAL_ONLY="$LOCAL_ONLY $b"
    echo "LOCAL_ONLY:$b"
  fi
done

# Step 7: unpushed commits
echo "UNPUSHED_COMMITS:"
git log --oneline @{u}..HEAD 2>/dev/null | head -5 || echo "(no upstream or no unpushed)"

### TAKE ACTION ###

# === DETACHED HEAD ===
if [ "$BRANCH" = "DETACHED" ]; then
  echo "DETACHED_HEAD: creating branch"
  git checkout -b "wip/detached-2026-06-17" 2>&1 || true
  if git push origin "wip/detached-2026-06-17" 2>&1; then
    PUSHED="$PUSHED wip/detached-2026-06-17"
  else
    ERRORS+="PUSH_FAILED:wip/detached-2026-06-17;"
  fi
  BRANCH="wip/detached-2026-06-17"
fi

# === DIRTY WORKTREE ===
if [ "$DIRTY" -gt 0 ]; then
  echo "DIRTY_WORKTREE: committing dirty state"
  git add -A 2>&1 || true
  if git commit -m "wip: save dirty state [auto]" 2>&1; then
    echo "COMMIT_OK"
  else
    echo "COMMIT_FAILED: trying stash"
    git stash 2>&1 || true
    NEW_STASHES=$(git stash list 2>/dev/null | wc -l || echo 0)
    STASHES=$((NEW_STASHES + 0))
  fi
fi

# === STASHES ===
if [ "$STASHES" -gt 0 ]; then
  echo "STASHES_FOUND: processing..."
  git stash list --format="%gd|%s" 2>/dev/null | while IFS='|' read -r stash_ref stash_msg; do
    SLUG=$(echo "$stash_msg" | sed 's/[^a-zA-Z0-9]/ /g' | tr -s ' ' | xargs | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-80)
    BRANCH_NAME="wip/${SLUG}-2026-06-17"
    echo "Stash: $stash_ref -> $BRANCH_NAME"
    if git stash branch "$BRANCH_NAME" "$stash_ref" 2>/dev/null; then
      if git push origin "$BRANCH_NAME" 2>&1; then
        echo "PUSHED:$BRANCH_NAME"
      else
        echo "PUSH_FAILED:$BRANCH_NAME"
      fi
      git checkout "$BRANCH" 2>/dev/null || echo "CHECKOUT_FAILED:$BRANCH"
    else
      echo "STASH_BRANCH_FAILED:$stash_ref"
    fi
  done
fi

# === LOCAL-ONLY BRANCHES ===
for branch in $LOCAL_ONLY; do
  echo "PUSHING_LOCAL_ONLY:$branch"
  if git push origin "$branch" 2>&1; then
    PUSHED="$PUSHED $branch"
  else
    ERRORS+="PUSH_FAILED:$branch;"
  fi
done

# === UNPUSHED COMMITS - push current branch ===
echo "PUSHING_CURRENT_BRANCH:$BRANCH"
if git push origin "$BRANCH" 2>&1; then
  PUSHED="$PUSHED $BRANCH"
  STATUS="ok"
else
  ERRORS+="PUSH_FAILED:$BRANCH;"
  STATUS="error"
fi

PUSHED_CLEAN=$(echo "$PUSHED" | xargs | tr ' ' ',')
echo ""
echo "REPO=$REPO_NAME STATUS=$STATUS STASHES=$STASHES DIRTY=$DIRTY PUSHED=$PUSHED_CLEAN"
if [ -n "$ERRORS" ]; then
  echo "ERRORS=$ERRORS"
fi
