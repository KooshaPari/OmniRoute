# argismonitor cutover runbook (dev backend on desktop + Vercel frontends)

## Topology

```
                    Tailscale (MagicDNS)
                            |
              kooshapari-desk.tail*.ts.net  <-- user's Mac (3090 Ti)
                            |
              +-----------+-----------+
              |                       |
              v                       v
        BFF :4322               kbridge gateway
        (Hono + tRPC +          (Rust Unix socket at
         feature flag)           /var/run/argismonitor/gateway.sock)
              |
              v
        Next.js :20128 (legacy upstream, only serves
        the cohort still on `OMNI_WEB_STACK_ROLLOUT < 100`)

                    HTTPS / XHR
                            ^
                            |
              +---------+---------+
              |         |         |
              v         v         v
        Vercel A   Vercel B   Vercel C
        (homepage) (app)     (docs)
        OMNI_WEB_STACK=svelte
        OMNI_WEB_STACK_ROLLOUT=1 -> 100 (incremental)
```

## Components

| Component | Where | How |
|---|---|---|
| BFF (Hono + tRPC + kbridge + feature flag) | desktop (kooshapari-desk) | `bun run dev` in the v4 worktree; port 4322 |
| kbridge gateway (Rust Unix-socket listener) | desktop | `cargo run -p omniroute-server`; socket at /var/run/argismonitor/gateway.sock |
| Legacy Next.js upstream | desktop (co-located) | `bun run dev` on the legacy fork; port 20128 |
| Web app + admin + docs (Vercel) | Vercel | 3+ projects, each pointing their `OMNI_BFF_URL` to the Tailscale BFF URL |

## Step-by-step

### 1. Deploy the v4 stack on the desktop (one time, repeated on stack updates)

```bash
# From any host with Tailscale + SSH access to the desktop
ssh desk                    # or: ssh kooshapari@kooshapari-desk.tail*.ts.net

# On the desktop, run the deployment script
cd ~ && git clone https://github.com/KooshaPari/OmniRoute.git argismonitor-monorepo
cd argismonitor-monorepo && git checkout feat/v4-svelte-hono-monorepo
./scripts/deploy-to-desktop.sh
# (optionally) Tailscale Funnel to expose the BFF publicly
# script handles this if TAILSCALE_FUNNEL=true and `tailscale` is on PATH

# Capture the BFF URL (either Tailscale hostname or Funnel public)
echo "BFF URL: https://$(tailscale status --self --json | jq -r .Self.DNSName | sed 's/\.$//' | sed 's/$/:4322/' | sed 's/^/https:\/\//')"
# BFF URL: https://kooshapari-desk.tail2b570.ts.net:4322
```

The BFF + kbridge + Next.js upstream all run on the desktop, sharing the same data dir (`~/.argismonitor/`).

### 2. Configure Vercel frontends to point at the desktop BFF

For each Vercel project (homepage, app, docs):

```bash
# From the host that owns the Vercel credentials
vercel env rm OMNI_BFF_URL production --yes
vercel env add OMNI_BFF_URL production
# paste: https://kooshapari-desk.tail2b570.ts.net:4322 (your Tailscale URL)
vercel env rm NEXTJS_UPSTREAM production --yes
vercel env add NEXTJS_UPSTREAM production
# paste: https://kooshapari-desk.tail2b570.ts.net:20128
vercel env rm OMNI_WEB_STACK production --yes
vercel env add OMNI_WEB_STACK production
# paste: svelte
vercel env rm OMNI_WEB_STACK_ROLLOUT production --yes
vercel env add OMNI_WEB_STACK_ROLLOUT production
# paste: 1
vercel deploy --prod   # or: git push to main and let Vercel build
```

The Vercel frontends now route their SvelteKit/Svelte pages to the desktop BFF. The BFF either serves the Svelte page (when `web_stack=svelte` cookie or when ROLLOUT includes the user) or 302s to the Next.js upstream.

### 3. Verify the chain (dev env first, then prod)

```bash
# In dev: deploy to desktop + point Vercel at it (preview env), then:
./scripts/cutover.sh health

# Cuts:
#   1. BFF healthz (port 4322)
#   2. Next.js healthz (port 20128) - the legacy upstream is still up
#   3. Per-route SLO check on 3 critical BFF endpoints
#   4. Reads /api/dashboard/observability/overview for p50/p95/p99/error-rate
```

If everything is green:

```bash
# 1% rollout - watch for 4h
./scripts/cutover.sh 1
# Apply: OMNI_WEB_STACK_ROLLOUT=1 in each Vercel prod env

# 10% after 4h of clean metrics
./scripts/cutover.sh 10

# 50% after 24h
./scripts/cutover.sh 50

# 100% after another 48h
./scripts/cutover.sh 100

# Roll back if SLO thresholds breached
./scripts/cutover.sh 0
```

### 4. Daily soak monitor (until v4.0-GA)

```bash
# Cron: every 15 min, check SLOs; alert on Slack/Discord if breached
*/15 * * * * ./scripts/cutover.sh health > /tmp/cutover.log 2>&1 || \
  curl -X POST -d "{\"text\":\"cutover SLO regression: $(cat /tmp/cutover.log | head -20)\"}" https://hooks.slack.com/services/YOUR_HOOK
```

## What runs where

| Layer | Process | Where | Restart on crash |
|---|---|---|---|
| BFF | `bun run src/server.ts` (Node + Hono) | desktop | `pm2` / `tmux` / `systemd --user` |
| kbridge | `cargo run -p omniroute-server` (Rust) | desktop | same |
| Next.js legacy | `npm run start` | desktop | same |
| Vercel frontends | managed by Vercel | Vercel | N/A (auto) |

## Rollback

```bash
# In dev: revert the rollout
./scripts/cutover.sh 0
# Apply: OMNI_WEB_STACK_ROLLOUT=0 in each Vercel prod env

# Or per-Vercel-project for surgical rollback
vercel env rm OMNI_WEB_STACK production --yes
vercel env add OMNI_WEB_STACK production
# paste: next
vercel deploy --prod
```

## Why the Tailscale topology

- **BFF + kbridge + legacy Next.js all on the same desktop** = no inter-service auth, no network egress, sub-millisecond latency
- **Tailscale + MagicDNS = stable hostname** = no DNS to manage
- **Funnel = optional public access** = no port forwarding, no firewall rules
- **Vercel = global edge + auto-scaling** = frontends stay fast everywhere
- **Single dev backend = single source of truth for the BFF + kbridge** = no drift between dev/staging/prod

## What's left for the next iteration

- **Auto-restart on the desktop**: wrap the three processes in `pm2` or `systemd --user` so the BFF + kbridge + Next.js survive a Mac reboot
- **Healthcheck endpoint on the desktop**: expose `/healthz` on a Tailscale Funnel so Vercel can pull it (Vercel has health-check integration with deployment URLs)
- **BFF auth between Vercel and desktop**: the BFF currently has CORS for `http://localhost:4321`; add the Vercel domains to the allowlist
- **Cutover metrics dashboard**: Grafana / Prom / Vercel Analytics on the per-route RPS + p95 + error rate split by rollout bucket

