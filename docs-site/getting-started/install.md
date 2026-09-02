---
title: Install
---

# Install

Four install paths, ordered by shortest feedback loop to production-grade.

| Path | Audience | Time |
|------|----------|------|
| [On-device demo](#on-device-demo) | Anyone, no install | 60 s |
| [Homebrew](#homebrew) | macOS / Linux dev | 5 min |
| [Docker](#docker) | Containerized prod | 15 min |
| [Bare metal](#bare-metal) | Self-managed host | 30 min |

## On-device demo

No install — fetch the binary and run the embedded demo. See [On-device demo page](/getting-started/on-device) for full recipe.

```sh
curl -L https://github.com/KooshaPari/OmniRoute/releases/latest/download/omniroute-$(uname -s)-$(uname -m) \
  -o /tmp/omniroute && chmod +x /tmp/omniroute && /tmp/omniroute demo
```

## Homebrew

```sh
brew install kooshapari/tap/omniroute
omniroute --version
```

## Docker

```sh
docker pull ghcr.io/kooshapari/omniroute:latest
docker run --rm -p 20128:20128 ghcr.io/kooshapari/omniroute:latest
```

For production: use `deploy/docker-compose.scale.yml`.

## Bare metal

Requires Node ≥ 20, Bun ≥ 1.1 (optional, but recommended for the demo programs).

```sh
git clone https://github.com/KooshaPari/OmniRoute.git
cd OmniRoute
bun install
bun run build
node dist/cli.js --port 20128
```

## Verify

```sh
curl http://127.0.0.1:20128/health
```

Expected: `{"status":"ok"}`.

## Next

- [Quickstart](/getting-started/quickstart) — first OpenAI-compatible round-trip
- [Deploy](/getting-started/deploy) — production cutover checklist
