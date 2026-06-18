#!/bin/bash
set -euo pipefail

BASE="/Users/kooshapari/CodeProjects/Phenotype/repos"

REPOS=(
  PhenoObservability
  PhenoObservability-2nd
  PhenoMCP
  PhenoKits
  PhenoHandbook
  phenoForge
  PhenoEvents
  phenoDesign
  phenoDesign-wt-ts-utils
)

for REPO in "${REPOS[@]}"; do
  echo "=== PROCESSING: $REPO ==="
  REPO_DIR="$BASE/$REPO"
  STASHES=0
  DIRTY=0
  PUSHED=""
  STATUS="ok"

  # 1. Verify it's a git repo
  if [ ! -d "$REPO_DIR" ]; then
    echo "  ERROR: Directory does not exist: $REPO_DIR"
    echo "REPO=$REPO STATUS=error STASHES=0 DIRTY=0 PUSHED="
    echo ""
    continue
  fi

  cd "$REPO_DIR"

  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "  ERROR: Not a git repository: $REPO_DIR"
    echo "REPO=$REPO STATUS=error STASHES=0 DIRTY=0 PUSHED="
    echo ""
    continue
  fi

  echo "  Git repo verified."

  # 6. Check for detached HEAD (before any branch operations)
  DETACHED=false
  if ! git symbolic-ref -q HEAD >/dev/null 2>&1; then
    DETACHED=true
    echo "  Detached HEAD detected."
  fi

  # 2. Process stash list
  STASH_COUNT=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STASH_COUNT" -gt 0 ] && [ -n "$(git stash list 2>/dev/null)" ]; then
    STASHES=$STASH_COUNT
    echo "  Found $STASHES stash(es). Creating branches..."
    git stash list --format="%gd %gs" | while read -r STASH_REF STASH_MSG; do
      # Extract n from stash@{n}
      STASH_N=$(echo "$STASH_REF" | sed 's/stash@{//' | sed 's/}//')
      # Create a safe slug from the stash message
      SLUG=$(echo "$STASH_MSG" | sed 's/[^a-zA-Z0-9._-]/_/g' | sed 's/__*/_/g' | sed 's/^_//' | sed 's/_$//' | tr '[:upper:]' '[:lower:]')
      if [ -z "$SLUG" ]; then
        SLUG="stash"
      fi
      BRANCH="wip/${SLUG}-2026-06-17"
      echo "    Processing stash $STASH_N -> branch $BRANCH"
      if git stash branch "$BRANCH" "stash@{$STASH_N}" 2>/dev/null; then
        echo "    Pushing branch $BRANCH..."
        git push origin "$BRANCH" 2>/dev/null && echo "    Pushed $BRANCH" || echo "    Failed to push $BRANCH (may already exist)"
        # Go back to original branch/HEAD
        git checkout - 2>/dev/null || true
      else
        echo "    Could not create branch from stash $STASH_N (conflict or empty stash)"
      fi
    done
    # Re-run stash list to get final count (some may have been popped)
    STASHES=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
    if [ -z "$STASHES" ] || [ "$STASHES" = "0" ]; then
      STASHES=0
    fi
  else
    echo "  No stashes found."
    STASHES=0
  fi

  # 3. Check for dirty state and commit
  DIRTY_FILES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DIRTY_FILES" -gt 0 ]; then
    DIRTY=$DIRTY_FILES
    echo "  Dirty state detected ($DIRTY_FILES files). Committing..."
    git add -A && git commit -m "wip: save dirty state [auto]" || echo "  (commit may have failed)"
  else
    echo "  Working tree clean."
    DIRTY=0
  fi

  # 4. Push local branches not in remote
  LOCAL_BRANCHES=$(git branch --format='%(refname:short)' 2>/dev/null)
  REMOTE_BRANCHES=$(git branch -r --format='%(refname:short)' 2>/dev/null || true)
  for BRANCH in $LOCAL_BRANCHES; do
    # Skip checking HEAD symbolic ref (shouldn't appear)
    if [ "$BRANCH" = "HEAD" ]; then
      continue
    fi
    # Check if this branch exists on remote
    FOUND=0
    while IFS= read -r REMOTE_BRANCH; do
      # Remote looks like origin/main, origin/feature, etc.
      # Extract the part after origin/
      REMOTE_NAME="${REMOTE_BRANCH#origin/}"
      if [ "$REMOTE_NAME" = "$BRANCH" ]; then
        FOUND=1
        break
      fi
    done <<< "$REMOTE_BRANCHES"
    
    if [ "$FOUND" -eq 0 ]; then
      echo "  Local branch '$BRANCH' not on remote. Pushing..."
      if git push origin "$BRANCH" 2>/dev/null; then
        PUSHED="$PUSHED $BRANCH"
      else
        echo "    Failed to push $BRANCH"
      fi
    fi
  done

  # 5. Check for unpushed commits on current branch
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")
  
  # Try upstream tracking first, then origin/HEAD, then origin/<branch>
  UNPUSHED=""
  if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
    UNPUSHED=$(git log --oneline @{u}..HEAD 2>/dev/null || true)
  elif git rev-parse --abbrev-ref origin/HEAD >/dev/null 2>&1; then
    UNPUSHED=$(git log --oneline origin/HEAD..HEAD 2>/dev/null || true)
  elif [ "$CURRENT_BRANCH" != "HEAD" ]; then
    UNPUSHED=$(git log --oneline "origin/$CURRENT_BRANCH..HEAD" 2>/dev/null || true)
  fi
  
  if [ -n "$UNPUSHED" ]; then
    UNPUSHED_COUNT=$(echo "$UNPUSHED" | wc -l | tr -d ' ')
    echo "  Found $UNPUSHED_COUNT unpushed commit(s). Pushing current branch..."
    if [ "$CURRENT_BRANCH" != "HEAD" ]; then
      git push origin "$CURRENT_BRANCH" 2>/dev/null && echo "  Pushed $CURRENT_BRANCH" || echo "  Failed to push $CURRENT_BRANCH"
      # Record in pushed if not already there
      if ! echo "$PUSHED" | grep -q "$CURRENT_BRANCH"; then
        PUSHED="$PUSHED $CURRENT_BRANCH"
      fi
    fi
  else
    echo "  No unpushed commits on current branch."
  fi

  # 6. If detached HEAD was found and we haven't resolved it, create a branch
  if [ "$DETACHED" = true ]; then
    # Check if we're still detached (might have been resolved by stash branch checkout)
    if ! git symbolic-ref -q HEAD >/dev/null 2>&1; then
      echo "  Still detached. Creating branch wip/detached-2026-06-17..."
      git checkout -b wip/detached-2026-06-17 2>/dev/null
      git push origin wip/detached-2026-06-17 2>/dev/null && echo "  Pushed wip/detached-2026-06-17" || echo "  Failed to push detached branch"
      PUSHED="$PUSHED wip/detached-2026-06-17"
    fi
  fi

  PUSHED=$(echo "$PUSHED" | xargs)  # trim

  echo "REPO=$REPO STATUS=$STATUS STASHES=$STASHES DIRTY=$DIRTY PUSHED='$PUSHED'"
  echo ""
done

echo "=== ALL DONE ==="
