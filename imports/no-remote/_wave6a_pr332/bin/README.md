# argis - argismonitor v4 master CLI

The single-command dev flow for the v4 frontend + BFF + kbridge stack.
Designed to make deploy + serve a natural part of `argis dev`, so you
don't have to think about Tailscale + SSH + build + launchd + Funnel +
Vercel env updates separately. One command takes the full stack from
"freshly cloned" to "BFF URL on stdout, Vercel envs wired, services
supervised."

## Install

```bash
# argis lives in the v4 monorepo bin/
ln -s "$(git rev-parse --show-toplevel)/bin/argis" ~/bin/argis
# Or it may already be symlinked if you ran the v4 worktree setup
```

The CLI composes on top of:
- `pheno-compute-layer` (`~/bin/pheno`) - Tailscale SSH plumbing to your desktop
- `vercel` CLI - env updates
- `tailscale` CLI on the desktop - Funnel for public BFF access

## Usage

```bash
argis dev             # one-shot: deploy + serve + expose + Vercel env
argis deploy          # sync v4 monorepo to desktop + build (no serve)
argis serve           # start BFF + kbridge + legacy Next.js
argis install         # install launchd supervisor (auto-restart on crash)
argis supervise       # alias for install
argis restart         # kickstart the BFF + kbridge services
argis desktop         # show launchd services on desktop
argis expose          # Tailscale Funnel + print BFF URL
argis url             # print the current BFF URL
argis status          # health snapshot
argis logs [bff|gateway|nextjs]
argis cutover <0|1|10|50|100>    flip OMNI_WEB_STACK_ROLLOUT in all Vercel prod envs
argis rollback        # alias for 'argis cutover 0'
argis ssh             # open a shell on desktop
```

## The dev flow

```bash
$ argis dev
deploying v4 to desktop (ref: origin/feat/v4-svelte-hono-monorepo)...
building web (SvelteKit)...
building bff (Hono + tRPC)...
building Rust gateway (kbridge)...
installing launchd supervisor on desktop (auto-restart BFF + kbridge + legacy Next.js)...
starting services on desktop...
exposing BFF via Tailscale Funnel...
BFF URL: https://kooshapari-desk.tail2b570.ts.net:4322
argis OK: stack up

# Then in a separate terminal, watch the logs
$ argis logs bff

# Increment the rollout
$ argis cutover 1
$ argis cutover 10
$ argis cutover 50
$ argis cutover 100

# Roll back
$ argis cutover 0
```

## How it composes with the rest of the v4 toolchain

| Layer | Tool | Where |
|---|---|---|
| v4 monorepo build | `bun install` + per-app `bun run build` | desktop |
| Tailscale SSH | `pheno` (pheno-compute-layer) | desktop |
| BFF + kbridge + legacy Next.js supervisor | `launchd` plists on desktop | desktop |
| Public BFF access | `tailscale funnel` | desktop |
| Vercel env updates | `vercel` CLI | host (sponsor) |
| Tailscale funnels on the desktop | Desktop daemon | desktop |
| Process composition | `proccompose` (`./proccompose`) | this v4 monorepo |

argis is the user-facing entry point. proccompose is the declarative
spec that argis executes. If you want to change the v4 deployment
topology (add services, change ports, swap Vercel projects), edit
`proccompose/proccompose.yaml` and `argis` picks up the new shape on
the next `dev` / `serve`.

## The launcher pattern

`argis serve` uses `nohup` + `&` to detach the BFF + kbridge + Next.js
processes on the desktop so they survive the SSH session ending.
For a more durable setup, run `argis install` once to install a
launchd plist that runs the BFF + kbridge as KeepAlive services -
they auto-restart on crash + Mac reboot.

## Cutover (the heart of Phase 3)

`argis cutover <0|1|10|50|100>` walks the rollout in lockstep with
`proccompose/proccompose.yaml`'s `cutover` section. Each phase has
SLO success criteria; the script prints them so the operator can
verify before bumping the next phase. SLO is enforced by the BFF's
own `/api/dashboard/observability/overview` endpoint and the
`proccompose status-json` JSON snapshot.

## What `argis dev` is NOT

- It's not a CI runner. For CI, use `./proccompose/tests/proccompose.test.sh`
  which runs in a sandbox without Tailscale + pheno.
- It's not a production deploy. For that, see `apps/desktop/CODESIGNING.md`
  for the Apple Developer ID + Azure Trusted Signing + Tauri updater
  cert runbook.
- It's not a Vercel frontend deploy. argis just wires `OMNI_BFF_URL`,
  `NEXTJS_UPSTREAM`, `OMNI_WEB_STACK`, `OMNI_WEB_STACK_ROLLOUT` on
  the Vercel projects; the projects' own git pushes trigger the
  Vercel builds.

## What lives where

| File | Purpose |
|---|---|
| `bin/argis` | this CLI (the entry point) |
| `scripts/deploy-to-desktop.sh` | the same steps argis.dev runs, but as a standalone script you can run by hand |
| `scripts/cutover.sh` | the SLO check + rollout bump, idempotent and safe to re-run |
| `proccompose/proccompose` | the declarative runner (yaml + bash) |
| `proccompose/proccompose.yaml` | the v4 deployment spec (services, vercel projects, cutover phases) |
| `proccompose/proccompose.example.yaml` | starter copy for users to edit |
| `proccompose/tests/proccompose.test.sh` | 4 unit tests for the runner + yaml |
| `docs/CUTOVER-TOPOLOGY-DEV-BACKEND.md` | full topology runbook (this file) |
| `apps/desktop/CODESIGNING.md` | cert procurement runbook |
| `apps/desktop/CERT-PROVISIONING.md` | cert one-pager |
