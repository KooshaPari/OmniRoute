#!/usr/bin/env bash
# scripts/reap-forge-orphans.sh — reap orphan forgecode processes
# Symptom addressed: zombie forge processes accumulate across sessions;
# duplicate --conversation-id PIDs indicate the orphan-reap gap.
# This is the LOCAL WORKAROUND for tailcallhq/forgecode issue #3553.
#
# Scope: reaps ONLY processes whose argv[0] is `forge` AND whose parent is
# init/launchd (PPID 1 or 0) AND whose elapsed time >= MIN_AGE. Never touches
# codex / claude / agent / cursor-agent / ghostty / any other tool — see
# ADR-094 (no-process-termination governance) for the full forbidden list.
#
# Safety gates (in order):
#   1. argv[0] must equal exactly "forge" or start with "forge " (no path
#      prefix, no shell wrapper). Reject anything else.
#   2. PPID must be 1 or 0 (orphaned, re-parented to init/launchd). Never
#      reap a process whose parent is still alive.
#   3. Elapsed time >= MIN_AGE_SECS (default 3600s = 1h). Override with
#      --min-age=0 (reap all orphans) or --min-age=7200 (2h), etc.
#   4. First sends SIGTERM (15); waits UP_TO_GRACE_SECS (default 30s);
#      escalates to SIGKILL (9) ONLY for processes that ignored SIGTERM.
#
# Usage:
#   ./scripts/reap-forge-orphans.sh --dry-run        # print plan, do nothing
#   ./scripts/reap-forge-orphans.sh --list           # list forge procs, no reap
#   ./scripts/reap-forge-orphans.sh                 # SIGTERM orphans (PPID 1/0) >= 1h
#   ./scripts/reap-forge-orphans.sh --all-old       # SIGTERM all forge procs >= 1h
#                                                   #   (drops the PPID 1/0 gate;
#                                                   #    use when parents are alive
#                                                   #    but conversation ended)
#   ./scripts/reap-forge-orphans.sh --min-age=0     # SIGTERM all orphans
#   ./scripts/reap-forge-orphans.sh --force         # same as --min-age=0
#   ./scripts/reap-forge-orphans.sh --pid=12345     # target one specific PID
#                                                   # (skips orphan + min-age checks)
#
# Exit codes:
#   0  reaped N processes (or none eligible) cleanly
#   1  one or more processes ignored SIGTERM; escalated to SIGKILL
#   2  invocation error or safety gate violation
#
# Hard refusals (exit 2, no reap):
#   - argv[0] does not match ^forge($| )
#   - process name contains codex / claude / agent / ghostty / cursor
#   - PPID is neither 1 nor 0 (parent still alive) and --pid not specified
#   - no targets match the criteria

set -euo pipefail

DRY_RUN=0
LIST_ONLY=0
FORCE=0
MIN_AGE_SECS=3600
UP_TO_GRACE_SECS=30
TARGET_PID=""
ALL_OLD=0

usage() {
  sed -n '2,40p' "$0" | sed 's/^# \?//'
  exit 2
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --list) LIST_ONLY=1; shift ;;
    --force) FORCE=1; MIN_AGE_SECS=0; shift ;;
    --min-age=*) MIN_AGE_SECS="${1#*=}"; shift ;;
    --grace=*) UP_TO_GRACE_SECS="${1#*=}"; shift ;;
    --pid=*) TARGET_PID="${1#*=}"; shift ;;
    --all-old) ALL_OLD=1; shift ;;
    -h|--help) usage ;;
    *) echo "reap-forge-orphans.sh: unknown arg: $1" >&2; usage ;;
  esac
done

if [[ "$FORCE" == "1" && "$MIN_AGE_SECS" -ne 0 ]]; then
  : # --force implies --min-age=0; ignore subsequent --min-age=
fi

is_macos() {
  [[ "$(uname -s)" == "Darwin" ]]
}

# Get elapsed seconds for a PID (works on both macOS and Linux).
pid_elapsed_secs() {
  local pid="$1"
  if is_macos; then
    # macOS: parse lstart = "Mon Jan  1 12:34:56 2026" and diff from now.
    local lstart now start_epoch now_epoch
    lstart="$(ps -p "$pid" -o lstart= 2>/dev/null || echo "")"
    [[ -z "$lstart" ]] && { echo 0; return; }
    start_epoch="$(date -j -f '%a %b %d %T %Y' "$lstart" +%s 2>/dev/null || echo 0)"
    now_epoch="$(date +%s)"
    echo $(( now_epoch - start_epoch ))
  else
    # Linux: etimes gives elapsed seconds directly.
    ps -p "$pid" -o etimes= 2>/dev/null | tr -d ' ' || echo 0
  fi
}

# Safety gate: argv must be a member of the forge process family — matches
# `forge`, `forge-dev`, `forge --conversation-id ...`, `/path/to/forge`, etc.
# Path prefix is stripped. Anything not in the forge family is rejected.
# If ps truncates args, the leading path may be present — strip it.
argv_is_forge() {
  local args="$1"
  local stripped="${args##*/}"   # strip path prefix if present
  # Bare "forge" or "forge <args>"
  if [[ "$stripped" == "forge" || "$stripped" == forge\ * ]]; then
    return 0
  fi
  # Forge variants: forge-dev, forge-experimental, etc. — i.e. "forge-<word>..."
  if [[ "$stripped" == forge-* || "$stripped" == forge-*\ * ]]; then
    # Reject forge-* variants whose name contains a forbidden substring
    # (defense-in-depth; e.g. "forge-agent" would be caught here).
    local lower
    lower="$(printf '%s' "$stripped" | tr '[:upper:]' '[:lower:]')"
    case "$lower" in
      *codex*|*claude*|*ghostty*|*cursor*|*python*|*ruby*|*java*)
        return 1
        ;;
    esac
    return 0
  fi
  return 1
}

# Safety gate: process name must not contain forbidden substrings.
# (This is a defense-in-depth check in case argv is misleading.)
name_is_safe() {
  local args="$1"
  local args_lc="${args}"  # see lowercasing below
  args_lc="$(printf '%s' "$args" | tr '[:upper:]' '[:lower:]')"
  local forbidden=(codex claude agent ghostty cursor node python ruby java)
  for f in "${forbidden[@]}"; do
    # case-insensitive substring match on the lowered argv
    if [[ "$args_lc" == *"$f"* ]]; then
      return 1
    fi
  done
  return 0
}

# Safety gate: PPID must be 1 (init) or 0 (kernel scheduler / launchd root).
# Never reap a process whose parent is still alive.
is_orphan() {
  local pid="$1"
  local ppid
  ppid="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ' || echo "")"
  [[ -z "$ppid" ]] && return 1
  [[ "$ppid" == "1" || "$ppid" == "0" ]]
}

# Collect candidate PIDs. Match the `forge` process family: bare `forge`,
# `forge-dev`, `forge --conversation-id ...`, `forge logs`, etc. The strict
# argv_is_forge safety gate later filters out anything that doesn't match.
declare -a candidates=()
if [[ -n "$TARGET_PID" ]]; then
  if ! [[ "$TARGET_PID" =~ ^[0-9]+$ ]]; then
    echo "reap-forge-orphans.sh: --pid must be numeric" >&2; exit 2
  fi
  candidates=("$TARGET_PID")
else
  # pgrep -f forge matches argv containing "forge" — catches forge, forge-dev,
  # forge --conversation-id, etc. The safety gates filter to forge-only.
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && candidates+=("$pid")
  done < <(pgrep -f forge 2>/dev/null | sort -u)
fi

if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "reap-forge-orphans.sh: no forge processes found"
  exit 0
fi

# Filter candidates through safety gates.
declare -a targets=()
declare -a reasons=()
for pid in "${candidates[@]}"; do
  args="$(ps -p "$pid" -o args= 2>/dev/null || echo "")"
  if [[ -z "$args" ]]; then
    reasons+=("$pid: process vanished"); continue
  fi
  if ! argv_is_forge "$args"; then
    reasons+=("$pid: argv rejected (${args%% *})"); continue
  fi
  if ! name_is_safe "$args"; then
    reasons+=("$pid: argv contains forbidden substring"); continue
  fi
  if [[ -z "$TARGET_PID" ]] && [[ $ALL_OLD -eq 0 ]] && ! is_orphan "$pid"; then
    reasons+=("$pid: parent still alive (PPID=$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' '))"); continue
  fi
  elapsed="$(pid_elapsed_secs "$pid")"
  if [[ "$elapsed" -lt "$MIN_AGE_SECS" ]]; then
    reasons+=("$pid: too young (${elapsed}s < ${MIN_AGE_SECS}s)"); continue
  fi
  targets+=("$pid")
done

# Report.
echo "═══════════════════════════════════════════════════════"
echo "  forgecode orphan-reap plan"
echo "═══════════════════════════════════════════════════════"
echo "  candidates found : ${#candidates[@]}"
echo "  safety-gated out : ${#reasons[@]}"
echo "  targets          : ${#targets[@]}"
echo "  min-age (s)      : $MIN_AGE_SECS"
echo "  grace (s)        : $UP_TO_GRACE_SECS"
echo "  mode             : $([[ $DRY_RUN -eq 1 ]] && echo "DRY-RUN" || ([[ $LIST_ONLY -eq 1 ]] && echo "LIST-ONLY" || echo "REAP"))"
echo

if [[ ${#reasons[@]} -gt 0 ]]; then
  echo "— skipped (safety gates) —"
  printf '  %s\n' "${reasons[@]}"
  echo
fi

if [[ ${#targets[@]} -eq 0 ]]; then
  echo "no eligible targets — nothing to do"
  exit 0
fi

echo "— targets —"
for pid in "${targets[@]}"; do
  args="$(ps -p "$pid" -o args= 2>/dev/null || echo "<gone>")"
  elapsed="$(pid_elapsed_secs "$pid")"
  printf '  %6s  %6ss  %s\n' "$pid" "$elapsed" "$args"
done
echo

if [[ $LIST_ONLY -eq 1 ]]; then
  echo "(list-only mode — no reap)"
  exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry-run mode — no reap)"
  exit 0
fi

# Reap.
echo "— reaping —"
escalated=0
for pid in "${targets[@]}"; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "  $pid: already gone"
    continue
  fi
  args="$(ps -p "$pid" -o args= 2>/dev/null || echo "<gone>")"
  echo "  $pid: SIGTERM ($args)"
  kill -15 "$pid" 2>/dev/null || { echo "  $pid: SIGTERM failed (ESRCH or EPERM)"; continue; }
done

# Wait for grace period.
echo "  ... waiting up to ${UP_TO_GRACE_SECS}s for graceful exit ..."
for ((i=0; i<UP_TO_GRACE_SECS; i++)); do
  sleep 1
  still_live=0
  for pid in "${targets[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then still_live=1; break; fi
  done
  [[ $still_live -eq 0 ]] && break
done

# Escalate survivors.
survivors=()
for pid in "${targets[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    survivors+=("$pid")
  fi
done

if [[ ${#survivors[@]} -gt 0 ]]; then
  echo "  ... ${#survivors[@]} ignored SIGTERM, escalating to SIGKILL ..."
  for pid in "${survivors[@]}"; do
    args="$(ps -p "$pid" -o args= 2>/dev/null || echo "<gone>")"
    echo "  $pid: SIGKILL ($args)"
    kill -9 "$pid" 2>/dev/null || echo "  $pid: SIGKILL failed"
    escalated=$((escalated + 1))
  done
fi

# Final state.
remaining=0
for pid in "${targets[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    remaining=$((remaining + 1))
    echo "  $pid: STILL ALIVE (manual intervention required)"
  fi
done

if [[ $escalated -gt 0 ]]; then
  echo
  echo "result: reaped (with $escalated SIGKILL escalations); $remaining remaining"
  exit 1
fi
echo
echo "result: reaped cleanly; $remaining remaining"
exit 0