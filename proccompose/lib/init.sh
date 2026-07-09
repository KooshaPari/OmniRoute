# proccompose init - bootstrap a fresh host into the v4 deploy plane.
# Idempotent: re-runs are safe. Runs on a Mac (with brew) or Linux (apt).
# No human in the loop: uses WorkOS service-to-service auth + Tailscale
# auth keys + Vercel tokens. Pre-flight: only if a fresh host is detected.

init_check() {
  [[ -d "$HOME/argismonitor-monorepo" ]] && [[ -x "$HOME/bin/proccompose" ]] && return 1
  return 0
}

cmd_init() {
  log "bootstrapping this host into the argismonitor v4 deploy plane..."

  if ! init_check; then
    log "already initialized (~/argismonitor-monorepo + ~/bin/proccompose exist)"
    log "use 'proccompose doctor' to verify; 'proccompose up' to deploy"
    return 0
  fi

  log "[1/5] installing prereqs (brew on macOS, apt on linux)..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    command -v brew >/dev/null || { err "brew missing - install via https://brew.sh"; return 1; }
    brew install jq yq gh tailscale 2>/dev/null || true
  else
    command -v apt-get >/dev/null || { err "apt-get missing - install via your distro's package manager"; return 1; }
    sudo apt-get update -y && sudo apt-get install -y jq yq gh tailscale 2>/dev/null || true
  fi

  log "[2/5] cloning v4 monorepo to ~/argismonitor-monorepo..."
  git clone https://github.com/KooshaPari/OmniRoute.git ~/argismonitor-monorepo
  cd ~/argismonitor-monorepo
  git checkout "${V4_REF:-origin/feat/v4-svelte-hono-monorepo}"

  log "[3/5] symlinking proccompose + argis to ~/bin/..."
  mkdir -p ~/bin
  ln -sfn ~/argismonitor-monorepo/proccompose/proccompose ~/bin/proccompose
  ln -sfn ~/argismonitor-monorepo/bin/argis ~/bin/argis
  export PATH="$HOME/bin:$PATH"

  log "[4/5] installing pheno-compute-layer (Tailscale SSH to your desktop)..."
  if [[ ! -d "$HOME/CodeProjects/Phenotype/pheno-compute-layer" ]]; then
    git clone https://github.com/kooshapari/pheno-compute-layer.git "$HOME/CodeProjects/Phenotype/pheno-compute-layer"
  fi
  cd "$HOME/CodeProjects/Phenotype/pheno-compute-layer"
  [[ -x "$HOME/bin/pheno" ]] || ./scripts/setup.sh 2>/dev/null || true

  log "[5/5] installing v4 worktree on the desktop (Tailscale SSH)..."
  $HOME/bin/pheno run "test -d ~/argismonitor-monorepo || (git clone https://github.com/KooshaPari/OmniRoute.git ~/argismonitor-monorepo && cd ~/argismonitor-monorepo && git checkout ${V4_REF:-origin/feat/v4-svelte-hono-monorepo} && bun install)"

  # Run doctor to verify
  proccompose doctor
  ok "host bootstrapped - ready to 'proccompose up'"
  log ""
  log "next: proccompose doctor       # verify everything is in place"
  log "      proccompose up          # deploy + serve + expose + Vercel env"
  log "      proccompose release    # deploy + cutover in one shot"
}
