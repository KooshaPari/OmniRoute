# Landing pages — ArgisMonitor

> **Status (Gate 6, file-only):** every landing artifact is in-tree
> under `apps/landing-argismonitor/` and `ops/caddy/`. No DNS, no Vercel
> deploy, no Caddy reload until you paste the relevant tokens.

## Topology

```
                ┌───────────────────────────────────────┐
                │  Vercel  (phenotype.space domain)      │
                │  /  /docs  /dashboards  /sdk          │
                └───────────────────────────────────────┘
                                ▲
                                │ CNAME
                                │
                ┌───────────────────────────────────────┐
                │  argismonitor.phenotype.space         │
                │  GitHub Pages (via mkdocs / vitepress)│
                └───────────────────────────────────────┘
                                ▲
                                │ Tailscale funnel / Caddy
                                │
                ┌───────────────────────────────────────┐
                │  Local WSL — Caddy envelope           │
                │  apps/landing-argismonitor/dist        │
                │  /pheno.studio                        │
                └───────────────────────────────────────┘
                                ▲
                                │ Caddy reverse proxy
                                │
                ┌───────────────────────────────────────┐
                │  argismonitor.pheno.studio            │
                │  (dev / internal — Vercel can't take  │
                │   the backend items: OTel, QA, etc.)  │
                └───────────────────────────────────────┘
```

## Surface split

| Surface | Hosted on | Backed by |
|---------|-----------|-----------|
| Public landing + docs | `argismonitor.phenotype.space` | GH Pages / Vercel |
| Dev/internal dashboards | `argismonitor.pheno.studio` | Caddy on WSL |
| AI-DD / HITL-less notice | both | `docs/FORK.md` rendered |
| Install one-liners | both | `install.sh` / `install.ps1` |

## File-only proof (this gate)

```
apps/landing-argismonitor/
├── README.md                 ← what this is, deploy instructions
├── package.json              ← vite + vitepress / next.js — minimal
├── index.html                ← static placeholder (deployable as-is)
├── vercel.json               ← Vercel routing + redirects
└── public/
    └── og-image.svg          ← social preview

ops/caddy/
├── Caddyfile.argismonitor    ← per-project envelope, dev/internal
└── README.md                 ← how to apply (systemd unit template)
```

## Apply (manual, requires DNS + Vercel + Cloudflare tokens)

```bash
# 1) Vercel: create project `argismonitor-landing`, point at this repo's apps/landing-argismonitor
vercel link --cwd apps/landing-argismonitor
vercel env add VERCEL_TOKEN production

# 2) GitHub Pages: enable for branch `gh-pages`; first deploy is via:
( cd apps/landing-argismonitor && npm run build && gh-pages-cli dist )

# 3) Cloudflare DNS: add CNAME argismonitor.phenotype.space → cname.vercel-dns.com
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  --data @dns-argismonitor-phenotype-space.json

# 4) Caddy (local WSL): validate config and reload
caddy validate --config ops/caddy/Caddyfile.argismonitor
sudo systemctl reload caddy
```

## Reference

- [`FORK.md`](./../FORK.md) — content for the AI-DD disclosure card
- [`PUBLISHING.md`](./../PUBLISHING.md) — install one-liners embedded in the landing CTA