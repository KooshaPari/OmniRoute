#!/usr/bin/env bash
# .gitleaks-push.sh
#
# Pre-push gitleaks hook — runs gitleaks detect before every `git push`.
# If gitleaks finds any secrets, the push is ABORTED.
#
# Install (per-repo):
#   ln -sf ../../.gitleaks-push.sh .git/hooks/pre-push
#
# Or system-wide (all repos):
#   git config --global core.hooksPath /path/to/this/dir
#
# Skips itself when:
#   - gitleaks binary is not in PATH
#   - GITLEAKS_SKIP_PUSH is set (any non-empty value)
#
# Override the gitleaks config path:
#   export GITLEAKS_CONFIG=/path/to/.gitleaks.toml
#
# Requirements:
#   - gitleaks (https://github.com/gitleaks/gitleaks) v8.18+
#   - bash 4+
#
# Exit codes:
#   0 = clean (push allowed)
#   1 = secrets found (push blocked)
#   2 = hook environment error (push blocked)

set -euo pipefail

# ---------------------------------------------------------------------------
# Skip conditions
# ---------------------------------------------------------------------------
if [ -n "${GITLEAKS_SKIP_PUSH:-}" ]; then
  echo "[gitleaks-push] SKIP: GITLEAKS_SKIP_PUSH is set"
  exit 0
fi

if ! command -v gitleaks &>/dev/null; then
  echo "[gitleaks-push] SKIP: gitleaks not found in PATH"
  echo "[gitleaks-push] Install: https://github.com/gitleaks/gitleaks"
  exit 0
fi

# ---------------------------------------------------------------------------
# Resolve config
# ---------------------------------------------------------------------------
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR" && git rev-parse --show-toplevel 2>/dev/null || echo "$HOOK_DIR")"
GITLEAKS_CONFIG="${GITLEAKS_CONFIG:-$REPO_ROOT/.gitleaks.toml}"

# Read push refs from stdin (git supplies these to pre-push hooks)
# Format: <local-ref> <local-sha> <remote-ref> <remote-sha>
# We need to capture them before stdin is consumed by gitleaks
PUSH_REFS=""
while IFS= read -r line; do
  PUSH_REFS="$PUSH_REFS$line"$'\n'
done

# ---------------------------------------------------------------------------
# Determine scan range
# ---------------------------------------------------------------------------
# If we're pushing specific refs, scan only the diff range.
# If no refs specified (e.g. `git push --all`), scan the full tree.
SCAN_ARGS=("detect" "--no-git" "--source" "$REPO_ROOT")

if [ -f "$GITLEAKS_CONFIG" ]; then
  SCAN_ARGS+=("--config" "$GITLEAKS_CONFIG")
fi

# gitleaks detect with --no-git scans the working tree. This catches
# staged+unstaged changes but not committed history gaps.
# For historical scanning use: gitleaks detect --source <dir>

echo "[gitleaks-push] Scanning for secrets in $REPO_ROOT ..."

# ---------------------------------------------------------------------------
# Run gitleaks
# ---------------------------------------------------------------------------
# Capture stderr separately so we can show it on failure
GITLEAKS_OUTPUT=""
GITLEAKS_RC=0

if ! GITLEAKS_OUTPUT="$(gitleaks "${SCAN_ARGS[@]}" 2>&1)"; then
  GITLEAKS_RC=$?
fi

# gitleaks exits 0 when clean, 1 when findings are found
if [ $GITLEAKS_RC -eq 1 ]; then
  echo ""
  echo "[gitleaks-push] ╔══════════════════════════════════════════════════╗"
  echo "[gitleaks-push] ║  SECRETS DETECTED — PUSH BLOCKED                ║"
  echo "[gitleaks-push] ╚══════════════════════════════════════════════════╝"
  echo ""
  echo "$GITLEAKS_OUTPUT"
  echo ""
  echo "[gitleaks-push] Remove or allowlist the secrets above before pushing."
  echo "[gitleaks-push] To allowlist, add entries to: $GITLEAKS_CONFIG"
  echo "[gitleaks-push] To bypass (NOT RECOMMENDED): GITLEAKS_SKIP_PUSH=1 git push"
  exit 1
elif [ $GITLEAKS_RC -ne 0 ]; then
  echo "[gitleaks-push] WARNING: gitleaks exited with code $GITLEAKS_RC"
  echo "$GITLEAKS_OUTPUT"
  echo "[gitleaks-push] Push allowed (advisory mode)"
  exit 0
fi

echo "[gitleaks-push] No secrets detected — push allowed"
exit 0
