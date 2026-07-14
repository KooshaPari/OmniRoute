#!/usr/bin/env bash
# argismonitor v4 stack deployment script for a Mac desktop dev backend.
# Run this on the desktop that will be reachable via Tailscale.
# Usage: ./scripts/deploy-to-desktop.sh

set -euo pipefail

DATA_DIR=${DATA_DIR:-$HOME/.argismonitor}
GATEWAY_SOCKET=${GATEWAY_SOCKET:-/var/run/argismonitor/gateway.sock}
WEB_PORT=${WEB_PORT:-4321}
BFF_PORT=${BFF_PORT:-4322}
NEXTJS_PORT=${NEXTJS_PORT:-20128}
TAILSCALE_FUNNEL=${TAILSCALE_FUNNEL:-true}

log() { printf "\033[1;36m[deploy]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[deploy ERROR]\033[0m %s\n" "$*" >&2; }
ok()  { printf "\033[1;32m[deploy OK]\033[0m %s\n" "$*"; }

# 1. Toolchain
log "checking toolchain..."
command -v bun >/dev/null || { err "bun not installed - install via: curl -fsSL https://bun.sh/install | bash"; exit 1; }
command -v git >/dev/null || { err "git not installed"; exit 1; }
command -v cargo >/dev/null || { err "cargo not installed - install via rustup"; exit 1; }

# 2. Clone the v4 monorepo at a known path
WORKTREE=$HOME/argismonitor-monorepo
if [[ ! -d "$WORKTREE" ]]; then
  log "cloning v4 monorepo..."
  git clone https://github.com/KooshaPari/OmniRoute.git "$WORKTREE"
  cd "$WORKTREE"
  git checkout feat/v4-svelte-hono-monorepo
else
  log "worktree already exists at $WORKTREE, updating..."
  cd "$WORKTREE"
  git fetch origin
  git checkout feat/v4-svelte-hono-monorepo
  git pull --ff-only
fi

# 3. Install v4 deps (web + bff + desktop)
log "installing v4 workspace deps..."
cd "$WORKTREE"
bun install

# 4. Build the web (SvelteKit) + bff (Hono)
log "building web (SvelteKit)..."
cd "$WORKTREE/apps/web"
bun run build

log "building bff (Hono + tRPC + kbridge)..."
cd "$WORKTREE/apps/bff"
bun run build

# 5. Start the BFF in the background (port 4322)
log "starting BFF on :$BFF_PORT (data: $DATA_DIR)..."
mkdir -p "$DATA_DIR"
cd "$WORKTREE/apps/bff"
DATA_DIR=$DATA_DIR PORT=$BFF_PORT nohup bun run src/server.ts > "$DATA_DIR/bff.log" 2>&1 &
BFF_PID=$!
echo $BFF_PID > "$DATA_DIR/bff.pid"
ok "BFF pid=$BFF_PID log=$DATA_DIR/bff.log"

# 6. Start the kbridge gateway daemon in the background (Unix socket)
log "starting kbridge gateway daemon on $GATEWAY_SOCKET..."
mkdir -p "$(dirname $GATEWAY_SOCKET)"
cd "$WORKTREE/backend-rust"
OMNIRoute_GATEWAY_SOCKET=$GATEWAY_SOCKET cargo run -p omniroute-server --release > "$DATA_DIR/gateway.log" 2>&1 &
GW_PID=$!
echo $GW_PID > "$DATA_DIR/gateway.pid"
ok "gateway pid=$GW_PID log=$DATA_DIR/gateway.log"

# 7. Optional: Tailscale Funnel to expose the BFF to the internet
if [[ "$TAILSCALE_FUNNEL" == "true" ]]; then
  if command -v tailscale >/dev/null; then
    log "exposing BFF via Tailscale Funnel..."
    # Funnel only the BFF port; not the Tauri shell
    tailscale funnel --bg --bg-local-allow-multiple-clients "$BFF_PORT" || \
      err "tailscale funnel failed - run manually: tailscale funnel $BFF_PORT"
  else
    err "tailscale not installed - install via: brew install tailscale"
  fi
fi

# 8. Print status
sleep 2
log "service status:"
curl -fsS http://localhost:$BFF_PORT/healthz 2>/dev/null && ok "BFF :$BFF_PORT healthy" || err "BFF :$BFF_PORT not responding"
curl -fsS http://localhost:$NEXTJS_PORT/healthz 2>/dev/null >/dev/null && ok "Next.js :$NEXTJS_PORT healthy" || log "Next.js :$NEXTJS_PORT not running (this is the v4 -> Next.js LEGACY upstream; only needed for Phase 3 cutover flag redirect)"

cat <<SUMMARY

  argismonitor v4 deployed.

  BFF URL:        http://localhost:$BFF_PORT  (or your Tailscale hostname:$BFF_PORT)
  Web app (prod): http://localhost:$WEB_PORT (after: cd $WORKTREE/apps/web && bun run preview)
  kbridge UDS:    $GATEWAY_SOCKET
  Data dir:       $DATA_DIR
  Logs:           $DATA_DIR/bff.log
                  $DATA_DIR/gateway.log

  If Tailscale Funnel is up, the BFF is reachable at:
  https://$(tailscale status --self --json 2>/dev/null | jq -r .Self.DNSName | sed 's/\.$//' 2>/dev/null || echo "<tailscale-hostname>"):$BFF_PORT

  Next: configure your Vercel project's env to point NEXTJS_UPSTREAM at
  the Tailscale URL above (or http://localhost:$BFF_PORT if local), set
  OMNI_WEB_STACK_ROLLOUT to 1 in your prod env, then run
  ./scripts/cutover.sh health to verify SLOs.

SUMMARY
