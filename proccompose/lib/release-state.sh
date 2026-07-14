# Release state: tracks which git ref is deployed at each "slot" on the desktop.
# Slot = a named instance (dev / staging / prod-v4 etc). One slot per host.
# Atomic deploys: each deploy writes a new state file; rollback = restore previous.

RELEASE_DIR="${RELEASE_DIR:-$HOME/.argismonitor/releases}"

init_release_dir() {
  mkdir -p "$RELEASE_DIR"
}

current_release() {
  local slot="${1:-dev}"
  local f="$RELEASE_DIR/$slot.current"
  [[ -f "$f" ]] && cat "$f" || echo ""
}

record_release() {
  local slot="$1" ref="$2" version="$3"
  init_release_dir
  local stamp
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  local file="$RELEASE_DIR/$slot.$stamp.$version.json"
  cat > "$file" <<JSON
{
  "slot": "$slot",
  "ref": "$ref",
  "version": "$version",
  "timestamp": "$stamp",
  "operator": "${RELEASE_OPERATOR:-agent}"
}
JSON
  # Update .current symlink
  ln -sfn "$file" "$RELEASE_DIR/$slot.current"
  # Keep the last 5 releases for rollback
  ls -1t "$RELEASE_DIR/$slot."*.json 2>/dev/null | tail -n +6 | xargs -I {} rm "$RELEASE_DIR/{}" 2>/dev/null || true
  echo "$file"
}

list_releases() {
  local slot="${1:-dev}"
  init_release_dir
  for f in $(ls -1t "$RELEASE_DIR/$slot."*.json 2>/dev/null); do
    cat "$f" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {d[\"timestamp\"]:25s}  {d[\"version\"]:20s}  {d[\"ref\"]}')"
  done
}

rollback_release() {
  local slot="$1"
  local current
  current=$(readlink -f "$RELEASE_DIR/$slot.current" 2>/dev/null) || { err "no current release for $slot"; return 1; }
  local prev
  prev=$(ls -1t "$RELEASE_DIR/$slot."*.json 2>/dev/null | grep -v "$(basename "$current")" | head -1) || { err "no previous release for $slot"; return 1; }
  ln -sfn "$RELEASE_DIR/$prev" "$RELEASE_DIR/$slot.current"
  log "rolled back $slot: $(basename $current) -> $(basename $prev)"
}
