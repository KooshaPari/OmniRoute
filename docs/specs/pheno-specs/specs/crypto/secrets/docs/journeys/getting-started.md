# Getting Started with Guardis

> First-time setup: install, configure, and store your first secret

## Journey Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INSTALL GUARDIS ──▶ CONFIGURE CLI ──▶ AUTHENTICATE ──▶ CREATE SECRET   │
│       │                   │                 │                  │          │
│       ▼                   ▼                 ▼                  ▼          │
│   Package install    Create config      Get JWT token     First KV pair   │
│   Binary + CLI      ~/.guardis.yaml    Via OIDC/K8s     Verify encrypt   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Duration:** 10 minutes  
**Complexity:** ⭐ Beginner  
**Prerequisites:** Go 1.24+, kubectl access (optional)

## Step-by-Step

### 1. Installation

```bash
# macOS via Homebrew (recommended)
brew install kooshapari/tap/guardis

# Linux via curl
curl -sSL https://install.guardis.io | sh

# Via Go (latest stable)
go install github.com/kooshapari/guardis/cmd/guardis@latest

# Verify installation
guardis version
# Expected: guardis v3.0.0 (built 2026-04-04)
```

### 2. Initial Configuration

```bash
# Create default configuration directory
mkdir -p ~/.guardis

# Generate configuration file
guardis configure \
  --cluster https://vault.acme.internal:8200 \
  --namespace org-acme \
  --output ~/.guardis/config.yaml

# Configuration file (~/.guardis/config.yaml)
cat << 'EOF' > ~/.guardis/config.yaml
cluster:
  address: "https://vault.acme.internal:8200"
  tls:
    verify: true
    ca_cert: "/etc/ssl/certs/acme-chain.pem"
  raft:
    leader_timeout: 5s
    follower_timeout: 10s

namespace:
  root: "org-acme"
  default_team: "engineering"

auth:
  method: "oidc"           # or "kubernetes", "aws-iam", "token"
  role: "developer"
  token_ttl: "1h"

logging:
  level: "info"
  format: "json"
EOF
```

### 3. Authentication

```bash
# Authenticate via OIDC (browser-based SSO)
guardis auth login --method oidc

# Alternative: Kubernetes service account
guardis auth login --method kubernetes \
  --service-account guardis-developer \
  --namespace default

# Alternative: AWS IAM role
guardis auth login --method aws-iam \
  --role arn:aws:iam::123456789:role/GuardisDeveloper

# Verify authentication
guardis auth status
# Expected output:
# ✓ Authenticated as: alice@acme.com
# ✓ Namespace: org-acme/teams/engineering
# ✓ Token expires: 2026-04-04T18:00:00Z
# ✓ Policies: [engineering-read, engineering-write]
```

### 4. Create Your First Secret

```bash
# Create a simple key-value secret
guardis secret create \
  --name api-keys \
  --path secret/data/development \
  --value stripe_key=sk_live_xxxx \
  --value github_token=ghp_xxxx

# Create from file (e.g., TLS certificate)
guardis secret create \
  --name tls-cert \
  --path secret/data/production \
  --file /path/to/server.crt

# Create dynamic database credential (on-demand)
guardis secret create \
  --name db-credentials \
  --path secret/data/dynamic \
  --type dynamic \
  --engine database/mysql \
  --ttl 1h

# List secrets in path
guardis secret list --path secret/data/development

# Output:
# NAME          TYPE    VERSION   CREATED
# api-keys      kv      1        2026-04-04T10:30:00Z
# tls-cert      kv      2        2026-04-04T11:45:00Z
```

### 5. Read and Use Secret

```bash
# Read secret metadata (fast, no decryption)
guardis secret get api-keys --metadata

# Output:
# Name:         api-keys
# Path:         org-acme/teams/engineering/secret/data/development/api-keys
# Type:         kv
# Version:      1
# Created:      2026-04-04T10:30:00Z
# Rotation:     Manual
# Labels:       env=dev, team=engineering

# Read secret value (decrypted)
guardis secret get api-keys --value

# Output:
# stripe_key=sk_live_xxxx
# github_token=ghp_xxxx

# Export to environment (for shell scripts)
eval $(guardis secret export api-keys --format=env)
# Sets: STRIPE_KEY=sk_live_xxxx, GITHUB_TOKEN=ghp_xxxx

# Inject into Kubernetes pod
guardis secret inject api-keys \
  --target-namespace production \
  --target-secret-name stripe-credentials \
  --keys stripe_key,github_token
```

## Verification Checklist

- [ ] `guardis version` returns version info
- [ ] `~/.guardis/config.yaml` exists with cluster config
- [ ] `guardis auth status` shows authenticated state
- [ ] `guardis secret create` succeeds without error
- [ ] `guardis secret get` returns decrypted value
- [ ] Audit log entry created in Vault

## Common Issues

| Error | Cause | Resolution |
|-------|-------|------------|
| `certificate signed by unknown authority` | Self-signed cert | Add CA cert to config or set `tls.verify: false` (dev only) |
| `permission denied` | Insufficient policy | Check token policies via `guardis auth status` |
| `namespace not found` | Wrong org/team path | Verify namespace exists via `guardis namespace list` |
| `raft leader not elected` | Cluster unavailable | Check cluster health via `guardis cluster status` |

## Next Steps

- [Team Secrets Sharing](./team-secrets-sharing) - Share secrets across team members with proper access control
- [Secret Rotation](./secret-rotation) - Automate credential rotation for compliance
