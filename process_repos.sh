#!/bin/zsh
# Process 7 repos for git push operations - reverse A-Z order
BASE_DIR="/Users/kooshapari/CodeProjects/Phenotype/repos"
REPOS=(
  "pheno-vibecoding-guard"
  "pheno-scaffold-kit"
  "phenoAI"
  "PhenoDevOps"
  "PhenoContracts"
  "PhenoCompose-wt-CC3-005-2026-06-11"
  "PhenoCompose"
)

TODAY="2026-06-17"

for repo in "${REPOS[@]}"; do
  echo "============================================"
  echo "PROCESSING: $repo"
  echo "============================================"

  REPO_DIR="$BASE_DIR/$repo"
  STASHES=0
  DIRTY=0
  PUSHED=""
  STATUS="ok"
  ERRORS=""

  # Check if repo directory exists
  if [ ! -e "$REPO_DIR" ]; then
    echo "ERROR: Repo directory does not exist: $REPO_DIR"
    echo "REPO=$repo STATUS=error STASHES=0 DIRTY=0 PUSHED=\"\" ERRORS=directory_not_found"
    echo ""
    continue
  fi

  cd "$REPO_DIR" || { echo "ERROR: Cannot cd to $REPO_DIR"; STATUS="error"; continue; }

  # Determine if .git is a file (worktree) or directory
  if [ -f ".git" ]; then
    WORKTREE="yes"
    echo "[info] This is a git worktree (.git is a file)"
  elif [ -d ".git" ]; then
    WORKTREE="no"
  else
    echo "ERROR: Not a git repository"
    echo "REPO=$repo STATUS=error STASHES=0 DIRTY=0 PUSHED=\"\" ERRORS=not_a_git_repo"
    echo ""
    continue
  fi

  # Step 2: Check origin URL
  echo "--- remote -v ---"
  git remote -v 2>&1 || ERRORS+="remote_failed;"

  # Step 3: Check stashes and push each as a branch
  echo "--- stash list ---"
  STASH_OUTPUT=$(git stash list 2>&1)
  if [ $? -eq 0 ] && [ -n "$STASH_OUTPUT" ]; then
    STASHES=$(echo "$STASH_OUTPUT" | wc -l | tr -d ' ')
    echo "$STASH_OUTPUT"
    # We need to handle stashes carefully because stash branch changes directory
    # Store stashes in a temp array
    TMPFILE=$(mktemp)
    git stash list --format="%gd|%gs" > "$TMPFILE" 2>/dev/null
    
    while IFS='|' read -r stash_ref stash_msg; do
      [ -z "$stash_ref" ] && continue
      echo "  Processing stash: $stash_ref - $stash_msg"
      slug=$(echo "$stash_msg" | sed 's/[^a-zA-Z0-9_-]/_/g' | sed 's/__*/_/g' | sed 's/^_//;s/_$//')
      if [ -z "$slug" ]; then
        slug="stash-unknown"
      fi
      branch_name="wip/${slug}-${TODAY}"
      
      # Go back to repo dir
      cd "$REPO_DIR" 2>/dev/null || continue
      
      echo "  -> Creating branch from stash: $stash_ref -> $branch_name"
      branch_output=$(git stash branch "$branch_name" "$stash_ref" 2>&1)
      if [ $? -eq 0 ]; then
        echo "$branch_output"
        git push origin "$branch_name" 2>&1 && {
          PUSHED+=" $branch_name"
        } || {
          echo "  ERROR: Failed to push $branch_name"
          ERRORS+="stash_push_${branch_name}_failed;"
        }
      else
        echo "  ERROR: Failed to create branch: $branch_output"
        ERRORS+="stash_branch_failed;"
      fi
    done < "$TMPFILE"
    rm -f "$TMPFILE"
  else
    echo "  (no stashes)"
  fi

  # Ensure we're back in repo dir
  cd "$REPO_DIR" 2>/dev/null || { echo "ERROR: Cannot return to $REPO_DIR"; STATUS="error"; continue; }

  # Step 4: Dirty work check
  echo "--- dirty work ---"
  DIRTY_COUNT=$(git status --porcelain 2>&1 | wc -l | tr -d ' ')
  DIRTY=$DIRTY_COUNT
  echo "  Dirty files: $DIRTY_COUNT"
  if [ "$DIRTY_COUNT" -gt 0 ]; then
    echo "  -> Committing dirty state"
    git add -A 2>&1
    GIT_OUTPUT=$(git commit -m "wip: save dirty state [auto]" --no-verify 2>&1)
    GIT_EXIT=$?
    echo "$GIT_OUTPUT"
    if [ $GIT_EXIT -eq 0 ]; then
      CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
      if [ "$CURRENT_BRANCH" = "HEAD" ]; then
        echo "  (detached HEAD after commit, will handle below)"
      else
        git push origin "$CURRENT_BRANCH" 2>&1 && {
          PUSHED+=" $CURRENT_BRANCH"
        } || {
          echo "  ERROR: Push failed for dirty commit on $CURRENT_BRANCH"
          git push origin "$CURRENT_BRANCH" --force-with-lease 2>&1 && {
            PUSHED+=" $CURRENT_BRANCH"
          } || {
            ERRORS+="dirty_push_${CURRENT_BRANCH}_failed;"
          }
        }
      fi
    elif echo "$GIT_OUTPUT" | grep -q "nothing to commit"; then
      echo "  (nothing to commit despite status count)"
    else
      echo "  ERROR: Commit failed, trying stash approach"
      git stash push -m "wip: dirty state auto-stash [auto]" 2>&1
    fi
  else
    echo "  (clean)"
  fi

  # Ensure we're back
  cd "$REPO_DIR" 2>/dev/null || { echo "ERROR: Cannot return to $REPO_DIR"; STATUS="error"; continue; }

  # Step 5: Local-only branches
  echo "--- local branches without remote ---"
  git fetch origin 2>&1 || echo "  (fetch issue, continuing)"

  # Compare local vs remote branches
  LOCAL_BRANCHES=$(git branch 2>/dev/null | sed 's/^[* ]*//')
  REMOTE_BRANCHES=$(git branch -r 2>/dev/null | sed 's/^[ *]*//' | sed 's|origin/||')

  while IFS= read -r lbranch; do
    [ -z "$lbranch" ] && continue
    # Check if this branch exists on remote
    if echo "$REMOTE_BRANCHES" | grep -qxF "$lbranch"; then
      : # has remote
    else
      echo "  Local-only: $lbranch -> pushing"
      git push origin "$lbranch" 2>&1 && {
        PUSHED+=" $lbranch"
      } || {
        echo "  ERROR: Failed to push $lbranch"
        ERRORS+="local_push_${lbranch}_failed;"
      }
    fi
  done <<< "$LOCAL_BRANCHES"

  # Ensure we're back
  cd "$REPO_DIR" 2>/dev/null || { echo "ERROR: Cannot return to $REPO_DIR"; STATUS="error"; continue; }

  # Step 6: Check for unpushed commits on current branch
  echo "--- unpushed commits ---"
  CURRENT_BRANCH2=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$CURRENT_BRANCH2" != "HEAD" ]; then
    UNPUSHED=$(git log --oneline "@{upstream}..HEAD" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$UNPUSHED" ]; then
      COMMIT_COUNT=$(echo "$UNPUSHED" | wc -l | tr -d ' ')
      echo "  Unpushed commits on $CURRENT_BRANCH2: $COMMIT_COUNT"
      echo "$UNPUSHED"
      echo "  -> Pushing $CURRENT_BRANCH2"
      git push origin "$CURRENT_BRANCH2" 2>&1 && {
        PUSHED+=" $CURRENT_BRANCH2"
      } || {
        echo "  ERROR: Push failed for $CURRENT_BRANCH2"
        ERRORS+="unpushed_push_${CURRENT_BRANCH2}_failed;"
      }
    else
      echo "  (no unpushed commits or no upstream)"
    fi
  else
    echo "  (detached HEAD - will handle below)"
  fi

  cd "$REPO_DIR" 2>/dev/null || { echo "ERROR: Cannot return to $REPO_DIR"; STATUS="error"; continue; }

  # Step 7: Detached HEAD handling
  echo "--- detached HEAD ---"
  CURRENT_BRANCH3=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$CURRENT_BRANCH3" = "HEAD" ]; then
    echo "  Detached HEAD detected"
    TAG_NAME="wip/detached-${TODAY}"
    echo "  -> Creating branch $TAG_NAME"
    git branch "$TAG_NAME" 2>&1 || git checkout -b "$TAG_NAME" 2>&1
    git push origin "$TAG_NAME" 2>&1 && {
      PUSHED+=" $TAG_NAME"
      git checkout "$TAG_NAME" 2>&1
      echo "  -> Checked out $TAG_NAME"
    } || {
      echo "  ERROR: Failed to push detached HEAD branch"
      ERRORS+="detached_push_failed;"
    }
  else
    echo "  (not detached, on branch: $CURRENT_BRANCH3)"
  fi

  cd "$REPO_DIR" 2>/dev/null || { echo "ERROR: Cannot return to $REPO_DIR"; STATUS="error"; continue; }

  # Step 8: git push --all origin for anything remaining
  echo "--- push --all ---"
  PUSH_ALL_OUTPUT=$(git push --all origin 2>&1)
  PUSH_ALL_EXIT=$?
  if [ $PUSH_ALL_EXIT -eq 0 ]; then
    if echo "$PUSH_ALL_OUTPUT" | grep -qv "Everything up-to-date"; then
      echo "$PUSH_ALL_OUTPUT"
    else
      echo "  Everything up-to-date"
    fi
  else
    echo "  ERROR: push --all failed"
    echo "$PUSH_ALL_OUTPUT"
    ERRORS+="push_all_failed;"
  fi

  # Clean up PUSHED string
  PUSHED=$(echo "$PUSHED" | tr -s ' ' | sed 's/^ *//;s/ *$//')
  ERRORS=$(echo "$ERRORS" | sed 's/;$//')

  echo ""
  if [ -n "$ERRORS" ]; then
    echo "REPO=$repo STATUS=$STATUS STASHES=$STASHES DIRTY=$DIRTY PUSHED=\"$PUSHED\" ERRORS=\"$ERRORS\""
  else
    echo "REPO=$repo STATUS=$STATUS STASHES=$STASHES DIRTY=$DIRTY PUSHED=\"$PUSHED\""
  fi
  echo ""

done

echo "============================================"
echo "ALL DONE"
echo "============================================"
