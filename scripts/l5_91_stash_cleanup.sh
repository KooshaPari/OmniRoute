#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

commit_repos=(
  Apisync AtomsBot-2nd AtomsBot-3rd AtomsBot-5th AuthKit bare-cua Civis
  dinoforge-packs Eidolon eyetracker forgecode HexaKit KDesktopVirt MCPForge
  nanovms OmniRoute-2nd Parpoura-5th PhenoDevOps PhenoProc phenotype-omlx
  phenotype-ops-mcp portage ResilienceKit thegent-security-fixes
)

discard_repos=(
  agent-platform AgilePlus agslag-docs apps AtomsBot BytePort cheap-llm-mcp
  Conft dispatch-mcp FocalPoint heliosBench HeliosCLI KaskMan KWatch-docs
  localbase3 melosviz OmniRoute PhenoCompose PhenoHandbook PhenoKits
  PhenoMCP-2nd PhenoProject PhenoRuntime PhenoSchema phenoShared
  phenotype-dep-guard phenotype-hub phenotype-infra phenotype-journeys
  phenotype-tooling PlayCua
)

status_clean() {
  local repo="$1"
  git -C "$ROOT/$repo" status --porcelain
}

commit_repo() {
  local repo="$1"
  local message="${2:-chore: apply stash audit cleanup}"
  if [[ -n "$(status_clean "$repo")" ]]; then
    git -C "$ROOT/$repo" add -A
    git -C "$ROOT/$repo" commit -m "$message"
  fi
}

discard_repo() {
  local repo="$1"
  if [[ -n "$(status_clean "$repo")" ]]; then
    git -C "$ROOT/$repo" stash push -u -m "l5-91 discard per STASH_AUDIT_2026_06_10 $repo" || true
    git -C "$ROOT/$repo" stash drop 'stash@{0}' || true
    git -C "$ROOT/$repo" restore --staged --worktree .
    git -C "$ROOT/$repo" clean -ffdx
  fi
}

for repo in "${commit_repos[@]}"; do
  commit_repo "$repo"
done

for repo in "${discard_repos[@]}"; do
  discard_repo "$repo"
done

git -C "$ROOT/cheap-llm-mcp/.tmp-pr48-review" restore --staged --worktree . 2>/dev/null || true
git -C "$ROOT/cheap-llm-mcp/.tmp-pr48-review" clean -ffdx 2>/dev/null || true

if [[ -n "$(git -C "$ROOT/PhenoProc/Evalora" status --porcelain 2>/dev/null || true)" ]]; then
  git -C "$ROOT/PhenoProc/Evalora" add -A
  git -C "$ROOT/PhenoProc/Evalora" commit -m "chore: apply stash audit cleanup"
  git -C "$ROOT/PhenoProc" add Evalora
  git -C "$ROOT/PhenoProc" commit -m "chore: apply stash audit cleanup"
fi

failed=0
for repo in "${commit_repos[@]}" "${discard_repos[@]}"; do
  if [[ -n "$(status_clean "$repo")" ]]; then
    echo "DIRTY $repo" >&2
    failed=1
  fi
done

exit "$failed"
