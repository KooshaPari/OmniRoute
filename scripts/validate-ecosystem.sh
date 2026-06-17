#!/usr/bin/env bash
# validate-ecosystem.sh — Phenotype ecosystem health check
#
# For each of the 13 canonical KooshaPari repos, this script:
#   (a) prints the repo name
#   (b) checks that it is reachable on GitHub via `gh repo view`
#   (c) checks that the standard meta files exist on the default branch:
#         AGENTS.md, STATUS.md, Taskfile.yml, LICENSE-MIT,
#         LICENSE-APACHE, .github/workflows/ci.yml
#   (d) reports any drift (missing repo, missing file, or reachability error)
#
# Fleet SHA pins live in registry/components.lock — refresh with:
#   ./scripts/pin-components.sh
#   ./scripts/pin-components.sh --check   # CI stale-pin gate
#
# Usage:
#   ./scripts/validate-ecosystem.sh                # full run
#   ./scripts/validate-ecosystem.sh --no-color     # disable color
#   ./scripts/validate-ecosystem.sh --json         # machine-readable output
#   ./scripts/validate-ecosystem.sh --help
#
# Exit codes:
#   0  — no drift detected
#   1  — drift detected (missing repos or missing meta files)
#   2  — script error (gh not available, no auth, etc.)

set -uo pipefail

# --- argument parsing -------------------------------------------------------

JSON_OUTPUT=false
NO_COLOR=false

for arg in "$@"; do
  case "$arg" in
    --json)   JSON_OUTPUT=true ;;
    --no-color) NO_COLOR=true ;;
    -h|--help)
      sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

# --- color setup ------------------------------------------------------------

if [[ "$JSON_OUTPUT" == true ]]; then
  RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; NC=""
elif [[ "$NO_COLOR" == true ]] || [[ ! -t 1 ]]; then
  RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; NC=""
else
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  NC='\033[0m'
fi

# --- canonical repo list (13) -----------------------------------------------
#
# Source: FLEET_100TASK_DAG_V4.md §1.1, §15.1, §21; V11 §70; this registry
# is canonical by definition (per V4 D.3/D.4 cross-cutting governance).
#
#   V4 §1.1   (5): FocalPoint, thegent, hwLedger, KWatch, dispatch-mcp
#   V5 §15.1  (5): tokn, pine, kmobile, PhenoContracts, cheap-llm-mcp
#   V3 §1.1   (2 of 5 selected): PhenoCompose, AgilePlus (V3 substrate + V3 focus)
#   + phenotype-registry itself
#                                Total: 5 + 5 + 2 + 1 = 13

ORG="KooshaPari"

# Format: "DisplayName|repo-slug|role"
REPOS=(
  "phenotype-registry|phenotype-registry|index (this repo)"
  "FocalPoint|FocalPoint|V4 L1-L5 focus (macOS window manager)"
  "thegent|thegent|V4 L1-L5 focus (agent orchestrator, Python+Rust)"
  "hwLedger|hwLedger|V4 L1-L5 focus (VitePress/Astro scaffold)"
  "KWatch|Kwatch|V4 L1-L5 focus (Go watcher CLI)"
  "dispatch-mcp|dispatch-mcp|V4 L1-L5 focus (MCP substrate)"
  "Tokn|Tokn|V5 EXT focus (Rust token ledger + pareto-rs)"
  "Pine|Pine|V5 EXT focus (Rust ELF/PE loader)"
  "kmobile|kmobile|V5 EXT focus (Rust mobile CLI/MCP)"
  "PhenoContracts|PhenoContracts|V5 EXT focus (TS contract verifier port)"
  "cheap-llm-mcp|cheap-llm-mcp|V5 EXT focus (consumed into dispatch-mcp)"
  "PhenoCompose|PhenoCompose|V3 focus (NVMS-3-tier isolation monorepo)"
  "AgilePlus|AgilePlus|V3 substrate (spec-driven dev, 22-crate workspace)"
)

# --- meta files we expect to find (per V4 D.3 + D.4 + META_FILES_PRESENCE)
# Order is the report order. "Required" means we report drift if missing.

META_FILES=(
  "AGENTS.md"
  "STATUS.md"
  "Taskfile.yml"
  "LICENSE-MIT"
  "LICENSE-APACHE"
  ".github/workflows/ci.yml"
)

# --- preflight --------------------------------------------------------------

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found. Install from https://cli.github.com/" >&2
  exit 2
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 2
fi

# --- JSON output buffer (built only when --json) ---------------------------

JSON_BUFFER="["

# --- counters --------------------------------------------------------------

TOTAL_REPOS=0
REACHABLE_REPOS=0
UNREACHABLE_REPOS=0
DRIFT_REPOS=0
DRIFT_TOTAL=0

# --- per-repo check --------------------------------------------------------

check_repo() {
  local display="$1"
  local slug="$2"
  local role="$3"
  local full="$ORG/$slug"

  TOTAL_REPOS=$((TOTAL_REPOS + 1))

  # (b) reachability — `gh repo view` exits 0 when the repo resolves
  local reach_ok=true
  local reach_err=""
  local default_branch=""
  local description=""

  if ! default_branch=$(gh repo view "$full" --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null); then
    reach_ok=false
    reach_err=$(gh repo view "$full" 2>&1 | head -3 | tr '\n' ' ' || true)
  else
    description=$(gh repo view "$full" --json description --jq '.description // ""' 2>/dev/null || true)
  fi

  if [[ "$reach_ok" == true ]]; then
    REACHABLE_REPOS=$((REACHABLE_REPOS + 1))
  else
    UNREACHABLE_REPOS=$((UNREACHABLE_REPOS + 1))
    DRIFT_REPOS=$((DRIFT_REPOS + 1))
    DRIFT_TOTAL=$((DRIFT_TOTAL + 1))
  fi

  # (c) per-file presence on the default branch
  local file_results=()
  local missing=()

  if [[ "$reach_ok" == true ]]; then
    for f in "${META_FILES[@]}"; do
      # Single call: `--include` returns the HTTP status line on the first
      # line, with the body suppressed for non-2xx so we can parse cleanly.
      # 200 = file exists, 404 = absent, 403 = rate-limited/private, etc.
      local status_line code
      status_line=$(gh api "repos/${full}/contents/${f}?ref=${default_branch}" \
                        -H "Accept: application/vnd.github+json" \
                        --include 2>/dev/null | head -1)
      code=$(echo "$status_line" | awk '{print $2}')
      case "$code" in
        200) file_results+=("PASS") ;;
        404) file_results+=("MISSING");   missing+=("$f") ;;
        403) file_results+=("FORBIDDEN"); missing+=("$f") ;;
        "")  file_results+=("ERR:000");   missing+=("$f") ;;
        *)   file_results+=("ERR:$code"); missing+=("$f") ;;
      esac
    done
  else
    for f in "${META_FILES[@]}"; do
      file_results+=("UNREACHABLE")
      missing+=("$f")
    done
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    DRIFT_REPOS=$((DRIFT_REPOS + 1))
    DRIFT_TOTAL=$((DRIFT_TOTAL + ${#missing[@]}))
  fi

  # (d) report — text or JSON
  if [[ "$JSON_OUTPUT" == true ]]; then
    local first=true
    local files_json="["
    for i in "${!META_FILES[@]}"; do
      if [[ "$first" == true ]]; then first=false; else files_json+=","; fi
      files_json+="{\"path\":\"${META_FILES[$i]}\",\"status\":\"${file_results[$i]}\"}"
    done
    files_json+="]"

    if [[ -n "$JSON_BUFFER" ]] && [[ "$JSON_BUFFER" != "[" ]]; then
      JSON_BUFFER+=","
    fi
    JSON_BUFFER+="{\"name\":\"$display\",\"slug\":\"$slug\",\"full\":\"$full\",\"role\":\"$role\",\"reachable\":$([ "$reach_ok" == true ] && echo true || echo false),\"default_branch\":\"$default_branch\",\"description\":\"$description\",\"files\":$files_json}"
  else
    # text
    local status_icon status_color
    if [[ "$reach_ok" == true && ${#missing[@]} -eq 0 ]]; then
      status_icon="✓"; status_color="$GREEN"
    elif [[ "$reach_ok" == true ]]; then
      status_icon="△"; status_color="$YELLOW"
    else
      status_icon="✗"; status_color="$RED"
    fi

    echo -e "${BOLD}${status_color}${status_icon}${NC} ${BOLD}${display}${NC} ${BLUE}(${full})${NC}"
    echo -e "    role:    ${role}"
    if [[ "$reach_ok" == true ]]; then
      echo -e "    default: ${default_branch}"
      [[ -n "$description" ]] && echo -e "    desc:    ${description}"
      echo -e "    files:"
      for i in "${!META_FILES[@]}"; do
        local c="$GREEN"; local marker="✓"
        case "${file_results[$i]}" in
          PASS)      c="$GREEN";   marker="✓" ;;
          MISSING)   c="$YELLOW";  marker="-" ;;
          FORBIDDEN) c="$YELLOW";  marker="?" ;;
          ERR:*)     c="$RED";     marker="!" ;;
          *)         c="$RED";     marker="✗" ;;
        esac
        printf "      %b%s%b  %s\n" "$c" "$marker" "$NC" "${META_FILES[$i]}"
      done
    else
      echo -e "    ${RED}UNREACHABLE${NC}: ${reach_err:-no detail}"
    fi
    if [[ ${#missing[@]} -gt 0 ]]; then
      echo -e "    ${YELLOW}drift:${NC} ${missing[*]}"
    fi
    echo ""
  fi
}

# --- header (text only) ----------------------------------------------------

if [[ "$JSON_OUTPUT" != true ]]; then
  echo -e "${BOLD}Phenotype Ecosystem Validation${NC}"
  echo -e "${BOLD}==============================${NC}"
  echo ""
  echo -e "Org:        ${BOLD}${ORG}${NC}"
  echo -e "Canonical:  ${BOLD}${#REPOS[@]}${NC} repos"
  echo -e "Meta files: ${BOLD}${#META_FILES[@]}${NC} per repo"
  echo ""
fi

# --- run --------------------------------------------------------------------

for entry in "${REPOS[@]}"; do
  IFS='|' read -r display slug role <<<"$entry"
  check_repo "$display" "$slug" "$role"
done

# --- summary ---------------------------------------------------------------

if [[ "$JSON_OUTPUT" == true ]]; then
  JSON_BUFFER+="]"
  # emit a JSON summary
  cat <<EOF
{
  "org": "$ORG",
  "total_repos": $TOTAL_REPOS,
  "reachable_repos": $REACHABLE_REPOS,
  "unreachable_repos": $UNREACHABLE_REPOS,
  "drift_repos": $DRIFT_REPOS,
  "drift_total": $DRIFT_TOTAL,
  "repos": $JSON_BUFFER
}
EOF
  if [[ "$DRIFT_TOTAL" -gt 0 ]]; then exit 1; fi
  exit 0
else
  echo -e "${BOLD}Summary${NC}"
  echo -e "-------"
  echo -e "  Total repos:        ${BOLD}${TOTAL_REPOS}${NC}"
  echo -e "  Reachable:          ${GREEN}${REACHABLE_REPOS}${NC}"
  echo -e "  Unreachable:        ${RED}${UNREACHABLE_REPOS}${NC}"
  echo -e "  Repos with drift:   ${YELLOW}${DRIFT_REPOS}${NC}"
  echo -e "  Total drift items:  ${YELLOW}${DRIFT_TOTAL}${NC}"
  echo ""

  if [[ "$DRIFT_TOTAL" -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}No drift detected.${NC}"
    exit 0
  else
    echo -e "${YELLOW}${BOLD}Drift detected — see per-repo output above.${NC}"
    exit 1
  fi
fi
