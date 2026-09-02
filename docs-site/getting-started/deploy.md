---
title: Deploy
---

# Deploy

This page covers the cutover checklist + deployment patterns. Detailed per-environment recipes live in `OmniRoute/deploy/`.

## Cutover checklist

1. **Health**: `curl http://host:20128/health` returns `{"status":"ok"}`
2. **Version**: `omniroute --version` matches across the fleet
3. **Governance**: `omniroute governance check canonical-routing` exits 0
4. **Audit chain**: `omniroute audit verify` prints a clean chain head
5. **Threat model**: signed off, see [Threat Model](/operations/threat-model)
6. **Backlog reviewed**: see [Backlog](/operations/backlog)
7. **Cost dashboard**: reachable, see [Cost](/operations/cost)
8. **Perf headroom**: `omniroute perf headroom --tier smart` exits 0

If any fails: do NOT cut traffic. Roll back, fix, re-verify.

## Patterns

### Single-node Docker Compose

`deploy/docker-compose.scale.yml`:

```yaml
services:
  omniroute:
    image: ghcr.io/kooshapari/omniroute:latest
    ports: ["20128:20128"]
    volumes:
      - ./data:/app/data
      - ./audit:/app/audit
    environment:
      OMNIROUTE_PORT: "20128"
      OMNIROUTE_AUDIT_DIR: "/app/audit"
    restart: unless-stopped
```

### Bare-metal systemd

`deploy/README.md` documents the systemd unit + env file.

### K8s (Helm-less)

`deploy/k8s/` contains manifest templates. Run with `kubectl apply -f deploy/k8s/`.

### Caddy reverse proxy

`deploy/Caddyfile` example:

```
api.example.com {
  reverse_proxy 127.0.0.1:20128
}
```

### Raspberry Pi / M-series Mac

See [On-device demo](/getting-started/on-device) — the demo binary works on ARM64.

## See also

- `OmniRoute/deploy/DEVICE_DEPLOYMENT.md` — device-specific recipes
- `OmniRoute/deploy/Caddyfile` — reverse proxy
- `OmniRoute/deploy/k8s/` — K8s manifests
