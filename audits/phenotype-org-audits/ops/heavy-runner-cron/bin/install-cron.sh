#!/usr/bin/env bash
# install-cron.sh — one-shot installer for the heavy-runner-cron bundle.
#
# Reads cron.d/fleet-substrate-tools, substitutes the placeholder
# __BUNDLE_DIR__ with the absolute path of this bundle, then installs the
# result into the user's crontab. Idempotent: re-running detects the entry
# and reports "already installed" without modifying the crontab.
#
# Usage:
#   $0                # install (or report "already installed")
#   $0 --uninstall    # remove the entry, keep the rest of the crontab intact
#   $0 --verify       # print installed entry, exit 0 if present, 1 if not
#   $0 --dry-run      # show the crontab fragment that WOULD be installed; no changes
#
# Exit codes:
#   0  success / already installed / verified
#   1  not installed (--verify only)
#   2  environment error (crontab missing, bundle not readable, etc.)
#   3  the bundle lives in an iCloud-synced path (warning only; install proceeds)
#
# The cron block is wrapped in sentinel markers so --uninstall can locate
# the managed block without parsing the rest of the crontab.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# source= directive is the documented form; shellcheck's relative-path
# resolver still emits info-level "Not following" noise on this version.
# The source succeeds at runtime (verified via bash -n + --help + --dry-run).
# shellcheck disable=SC1091
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

CRON_FRAGMENT_TEMPLATE="${HEAVY_RUNNER_BUNDLE_DIR}/cron.d/fleet-substrate-tools"
CRON_MARKER_BEGIN="# >>> fleet-substrate-tools (managed by install-cron.sh) >>>"
CRON_MARKER_END="# <<< fleet-substrate-tools <<<"

# --- arg parse --------------------------------------------------------------
ACTION="install"
for arg in "$@"; do
  case "$arg" in
    --uninstall) ACTION="uninstall" ;;
    --verify)    ACTION="verify"    ;;
    --dry-run)   ACTION="dry-run"   ;;
    -h|--help)
      # Print the leading comment block of this file as usage.
      sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      die 2 "unknown argument: $arg (use --uninstall | --verify | --dry-run)"
      ;;
  esac
done

require_cmd crontab

# --- preflight: bundle path warning ----------------------------------------
# On macOS, launchd's cron may not see files in iCloud-synced paths
# (~/Library/Mobile Documents, Desktop, Documents under iCloud). Warn the
# user; do not refuse — the heavy runner may be a different host.
case "$HEAVY_RUNNER_BUNDLE_DIR" in
  *Mobile\ Documents*|*iCloud*)
    warn "bundle is in an iCloud-synced path; cron may not see it"
    warn "  → consider moving the bundle to ~/.local/share/fleet-substrate-tools"
    ;;
esac

# --- build the crontab fragment --------------------------------------------
if [[ ! -r "$CRON_FRAGMENT_TEMPLATE" ]]; then
  die 2 "crontab fragment not readable: $CRON_FRAGMENT_TEMPLATE"
fi

# Substitute __BUNDLE_DIR__ with the absolute path. Use a pipe-delimiter
# with sed because the path may contain '/'.
INSTALLED_FRAGMENT="$(
  sed "s|__BUNDLE_DIR__|${HEAVY_RUNNER_BUNDLE_DIR}|g" "$CRON_FRAGMENT_TEMPLATE"
)"

# Wrap with sentinel markers (idempotency + targeted uninstall).
WRAPPED_FRAGMENT="${CRON_MARKER_BEGIN}
${INSTALLED_FRAGMENT}
${CRON_MARKER_END}"

# --- helpers ----------------------------------------------------------------
read_crontab() {
  crontab -l 2>/dev/null || true
}

# strip_marker_block <input> — echo <input> with the marker block removed.
strip_marker_block() {
  awk -v begin="$CRON_MARKER_BEGIN" -v end="$CRON_MARKER_END" '
    $0 == begin { in_block = 1; next }
    $0 == end   { in_block = 0; next }
    !in_block   { print }
  '
}

# --- actions ----------------------------------------------------------------
case "$ACTION" in
  dry-run)
    log "--- crontab fragment that would be installed ---"
    printf '%s\n' "$WRAPPED_FRAGMENT"
    log "--- end fragment ---"
    log "(no changes made)"
    exit 0
    ;;

  verify)
    if read_crontab | grep -Fq "$CRON_MARKER_BEGIN"; then
      log "fleet-substrate-tools block IS installed:"
      read_crontab | awk -v begin="$CRON_MARKER_BEGIN" -v end="$CRON_MARKER_END" \
        '$0 == begin { show = 1 } show { print } $0 == end { show = 0 }'
      exit 0
    fi
    err "fleet-substrate-tools block is NOT installed"
    exit 1
    ;;

  install)
    if read_crontab | grep -Fq "$CRON_MARKER_BEGIN"; then
      log "fleet-substrate-tools block is already installed (idempotent no-op)"
      log "use --uninstall to remove, or --verify to print the current entry"
      exit 0
    fi
    log "installing fleet-substrate-tools block into crontab..."
    CURRENT="$(read_crontab)"
    if [[ -z "$CURRENT" ]]; then
      NEW_CONTENT="$WRAPPED_FRAGMENT"
    elif [[ "$CURRENT" == *$'\n' ]]; then
      NEW_CONTENT="${CURRENT}${WRAPPED_FRAGMENT}"
    else
      NEW_CONTENT="${CURRENT}
${WRAPPED_FRAGMENT}"
    fi
    printf '%s\n' "$NEW_CONTENT" | crontab -
    log "installed. current fleet-substrate-tools block:"
    crontab -l | awk -v begin="$CRON_MARKER_BEGIN" -v end="$CRON_MARKER_END" \
      '$0 == begin { show = 1 } show { print } $0 == end { show = 0 }'
    log "next scheduled run: every Monday 09:00 (local time of this host)"
    exit 0
    ;;

  uninstall)
    CURRENT="$(read_crontab)"
    if ! printf '%s\n' "$CURRENT" | grep -Fq "$CRON_MARKER_BEGIN"; then
      log "fleet-substrate-tools block is not installed; nothing to do"
      exit 0
    fi
    log "removing fleet-substrate-tools block from crontab..."
    FILTERED="$(printf '%s\n' "$CURRENT" | strip_marker_block)"
    if [[ -z "$FILTERED" ]]; then
      # Empty crontab — remove it entirely by giving crontab an empty file.
      : > /tmp/.crontab.empty
      crontab /tmp/.crontab.empty
      rm -f /tmp/.crontab.empty
    else
      printf '%s\n' "$FILTERED" | crontab -
    fi
    log "removed. remaining crontab (if any):"
    crontab -l 2>/dev/null || log "  (crontab is now empty)"
    exit 0
    ;;

  *)
    die 2 "internal: unhandled action $ACTION"
    ;;
esac
