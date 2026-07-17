# Secret Rotation

> Automate credential rotation for SOC 2, PCI DSS, and HIPAA compliance

## Journey Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECRET ROTATION WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     ROTATION STATE MACHINE                              │  │
│  │                                                                       │  │
│  │      ACTIVE ──▶ ROTATING ──▶ CANARY ──▶ ACTIVE (new)                   │  │
│  │        │            │            │            │                         │  │
│  │        │            │            │            │                         │  │
│  │        ▼            ▼            ▼            ▼                         │  │
│  │     DEPRECATING  ──▶ DEPRECATED ──▶ DELETED                           │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  TIMELINE (example: 90-day rotation):                                        │
│                                                                              │
│  Day 0      Day 60         Day 75         Day 90         Day 105          │
│    │          │              │              │              │               │
│    ▼          ▼              ▼              ▼              ▼               │
│  CREATE    CANARY(25%)    CANARY(50%)    SWITCH(100%)   DEPRECATE(old)     │
│  new v1    v2 active      v2 active      v2 = ACTIVE    old deleted        │
│            v1 read-only   v1 read-only   v1 deprecated                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Duration:** 20 minutes  
**Complexity:** ⭐⭐⭐ Advanced  
**Prerequisites:** Guardis admin role, rotation policy configuration

## Step-by-Step

### 1. Configure Rotation Policy

```bash
# Create a standard rotation policy (90-day intervals)
guardis rotation-policy create \
  --name standard-90day \
  --description "Standard rotation for API keys and tokens" \
  --interval 90d \
  --grace-period 7d \
  --max-versions 3 \
  --auto-rotate true

# Create aggressive policy (30-day, shorter grace period)
guardis rotation-policy create \
  --name aggressive-30day \
  --description "Aggressive rotation for database credentials" \
  --interval 30d \
  --grace-period 3d \
  --max-versions 5 \
  --auto-rotate true

# Create compliance policy (PCI DSS - 90-day max)
guardis rotation-policy create \
  --name pci-dss-compliant \
  --description "PCI DSS compliant rotation policy" \
  --interval 90d \
  --grace-period 14d \
  --max-versions 4 \
  --auto-rotate true \
  --require-approval true \
  --compliance-controls soc2,pci-dss,hipaa

# List rotation policies
guardis rotation-policy list

# Output:
# POLICY NAME            INTERVAL  GRACE    MAX v3  AUTO   COMPLIANCE
# standard-90day         90d       7d       3        ✓      -
# aggressive-30day        30d       3d       5        ✓      -
# pci-dss-compliant       90d       14d      4        ✓      SOC2, PCI, HIPAA
```

### 2. Apply Rotation to Existing Secret

```bash
# Apply rotation policy to existing secret
guardis secret rotate \
  --name api-keys \
  --path secret/data/production \
  --policy standard-90day

# Verify rotation schedule
guardis secret get api-keys --metadata

# Output:
# Name:             api-keys
# Rotation Policy:  standard-90day
# Next Rotation:    2026-07-03T00:00:00Z (89 days)
# Current Version:  3
# Rotation History:
#   Version 3 (current) - 2026-04-04 - automatic
#   Version 2 - 2026-01-03 - automatic
#   Version 1 - 2025-10-05 - manual
```

### 3. Manual Rotation

```bash
# Trigger immediate rotation
guardis secret rotate --name api-keys --path secret/data/production --force

# Output:
# Rotating secret: org-acme/teams/engineering/secret/data/production/api-keys
# Creating new version (v4)...
# Updating Vault...
# Invalidating leases...
# Canary deployment: 0% (immediate switch)
# ✓ Rotation complete
#   New version: 4
#   Previous version: 3 (deprecated, 7 day grace)

# Verify new version is active
guardis secret get api-keys --version latest --value

# Old version still accessible during grace period
guardis secret get api-keys --version 3 --value

# After grace period, old version is deleted
guardis secret get api-keys --version 3 --value
# Error: Version 3 not found (past grace period)
```

### 4. Canary Deployment Rotation

```bash
# Start canary rotation (25% traffic on new version)
guardis secret rotate \
  --name database-credentials \
  --path secret/data/dynamic \
  --policy aggressive-30day \
  --canary-start 25

# Monitor canary status
guardis secret canary status --name database-credentials

# Output:
# Secret:        database-credentials
# Policy:        aggressive-30day
# Canary:        25%
# Version:       5 (canary)
# Previous:      4 (active)
# Health Check:  ✓ No errors detected
# Canary Errors: 0
#
# Metrics:
#   Read ops:     1,234 (v4: 925, v5: 309)
#   Error rate:   0.00% (v4: 0.00%, v5: 0.00%)

# Increase canary to 50%
guardis secret canary promote --name database-credentials --percentage 50

# Increase canary to 100% (full switch)
guardis secret canary promote --name database-credentials --percentage 100

# Rollback if issues detected
guardis secret canary rollback --name database-credentials
```

### 5. Automatic Rotation with Webhooks

```bash
# Configure webhook for rotation events
guardis webhook create \
  --name rotation-notifications \
  --url https://notify.acme.com/guardis-webhook \
  --events secret.rotated,secret.approaching_expiry,secret.canary_started

# Rotation webhook payload example:
cat << 'EOF'
{
  "event": "secret.rotated",
  "timestamp": "2026-04-04T10:30:00Z",
  "secret": {
    "name": "api-keys",
    "path": "org-acme/teams/engineering/secret/data/production/api-keys",
    "old_version": 3,
    "new_version": 4
  },
  "metadata": {
    "triggered_by": "automatic",
    "policy": "standard-90day"
  }
}
EOF

# Create PagerDuty integration for expiring secrets
guardis webhook create \
  --name pagerduty-alerts \
  --url https://events.pagerduty.com/v2/enqueue \
  --events secret.approaching_expiry \
  --filter 'rotation_policy.compliance.has("pci-dss")' \
  --transform '{"routing_key": "{{env.PAGERDUTY_KEY}}", "event_action": "trigger"}'
```

### 6. Compliance Audit Report

```bash
# Generate compliance report for all rotated secrets
guardis audit compliance-report \
  --start 2026-01-01 \
  --end 2026-04-04 \
  --format pdf \
  --output ./compliance-q1-2026.pdf

# Generate SOC 2 evidence package
guardis audit compliance-report \
  --framework soc2 \
  --criteria "CC6.1,CC6.3,CC6.6" \
  --secrets-with-policy '*' \
  --output ./soc2-evidence-2026-04.zip

# Report includes:
# - All rotation events with timestamps
# - Policy compliance verification
# - Version history for all secrets
# - Access logs during rotation
# - Cryptographic verification (hash chain)

# Verify rotation compliance for specific policy
guardis rotation-policy verify pci-dss-compliant

# Output:
# Policy: pci-dss-compliant
# Compliance: SOC2 ✓ | PCI-DSS ✓ | HIPAA ✓
#
# Secret Coverage:
#   org-acme/.../api-keys         ✓ (v3, next rot: 67d)
#   org-acme/.../db-creds         ✓ (v5, next rot: 12d) WARNING
#   org-acme/.../stripe-keys       ✓ (v2, next rot: 89d)
#
# Issues:
#   [WARNING] db-creds approaching rotation (12 days remaining)
#   [INFO] No secrets past 90-day maximum
#
# Overall Status: COMPLIANT ✓
```

## Rotation Metrics Dashboard

```bash
# View rotation metrics
guardis metrics rotation --namespace org-acme/teams/engineering --period 30d

# Output:
# ROTATION METRICS (Last 30 days)
# ─────────────────────────────────────────────────
# Total Secrets:              47
# Auto-Rotating:             35 (74%)
# Manual Rotations:           5
# Failed Rotations:           0
# Average Rotation Age:      52 days
#
# COMPLIANCE STATUS:
#   Within Policy:            44 (94%)
#   Approaching Deadline:      3 (6%) ⚠
#   Past Deadline:            0 ✓
#
# UPCOMING ROTATIONS (Next 14 days):
#   2026-04-10: db-creds (v5)
#   2026-04-12: stripe-keys (v2)
#   2026-04-15: github-tokens (v4)
```

## Common Rotation Patterns

| Pattern | Use Case | Configuration |
|---------|----------|--------------|
| **Immediate** | API keys, static tokens | `--canary-start 0` |
| **Gradual** | Database credentials | `--canary-start 25 --promote-after 1h` |
| **Scheduled** | Certificates | `--cron "0 2 * * 1"` (weekly Monday 2am) |
| **Event-based** | External API rotation | Trigger via webhook from external system |
| **Lease-based** | Dynamic secrets | TTL = rotation interval / 2 |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Rotation fails | Target system unreachable | Check connectivity, retry with `--force` |
| Canary errors spike | New version incompatible | `guardis secret canary rollback` |
| Version not deleted | Grace period not expired | Wait or reduce grace period |
| Webhook not firing | Event filter too strict | Check webhook config with `guardis webhook test` |
| Compliance report missing data | Audit log gap | Check cluster health, WAL integrity |

## Next Steps

- [Getting Started](./getting-started) - Review basics
- [Team Secrets Sharing](./team-secrets-sharing) - Access control patterns
