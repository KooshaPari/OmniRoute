# Team Secrets Sharing

> Securely share secrets across team members with namespace isolation and RBAC

## Journey Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TEAM SECRETS SHARING WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Team Admin                                                                  │
│      │                                                                         │
│      ├──▶ Create Namespace ──▶ Define Policies ──▶ Add Members             │
│      │         │                    │                    │                  │
│      │         ▼                    ▼                    ▼                  │
│      │    org-acme/          Policy: engineering-    alice@acme.com         │
│      │    teams/             read-write            bob@acme.com             │
│      │    engineering                                    carol@acme.com      │
│      │                                                                         │
│  Team Member                                                                  │
│      │                                                                         │
│      ├──▶ Authenticate ──▶ List Accessible ──▶ Read Secret                  │
│      │         │                    │                    │                  │
│      │         ▼                    ▼                    ▼                  │
│      │    OIDC/K8s           secret/data/          Decrypted value          │
│      │    token              development           (logged in audit)         │
│      │                                                                         │
│  Cross-Team (with approval)                                                  │
│      │                                                                         │
│      └──▶ Request Access ──▶ Admin Approval ──▶ Temporary Grant             │
│                │                    │                    │                  │
│                ▼                    ▼                    ▼                  │
│          Access request       org-beta admin        90-day token             │
│          ticket created       approves               (auto-revokes)          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Duration:** 15 minutes  
**Complexity:** ⭐⭐ Intermediate  
**Prerequisites:** Guardis installed, team admin role

## Step-by-Step

### 1. Create Team Namespace

```bash
# As team admin, create the engineering namespace hierarchy
guardis namespace create \
  --path org-acme/teams/engineering \
  --description "Engineering team secrets" \
  --quota-max-secrets 1000 \
  --quota-max-api-calls 10000

# Create sub-namespaces for environments
guardis namespace create \
  --path org-acme/teams/engineering/projects/api-gateway \
  --description "API Gateway project secrets"

guardis namespace create \
  --path org-acme/teams/engineering/projects/auth-service \
  --description "Auth Service project secrets"

# Verify namespace structure
guardis namespace list --path org-acme/teams/engineering

# Output:
# NAMESPACE                                    QUOTA    USAGE
# org-acme/teams/engineering                  1000     47
#   ├── projects/api-gateway                    200      12
#   └── projects/auth-service                  200      8
```

### 2. Define Access Policies

```bash
# Create read-write policy for engineering team
cat << 'EOF' > engineering-read-write-policy.hcl
path "org-acme/teams/engineering/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "org-acme/teams/engineering/secret/data/production/*" {
  capabilities = ["read", "list"]  # No write to production
}

path "org-acme/shared/*" {
  capabilities = ["read", "list"]
}

path "org-acme/services/*" {
  capabilities = ["read"]  # Service accounts only
}
EOF

# Create read-only policy for auditors
cat << 'EOF' > auditor-read-policy.hcl
path "org-acme/*" {
  capabilities = ["read", "list"]
}

# Deny access to values (metadata only)
path "org-acme/*/secret/data/*" {
  capabilities = ["list"]
  denied_parameters = ["data"]  # Cannot read secret values
}
EOF

# Create policy for CI/CD service account
cat << 'EOF' > cicd-deploy-policy.hcl
path "org-acme/teams/engineering/secret/data/deployment/*" {
  capabilities = ["read", "update"]
}

path "org-acme/teams/engineering/secret/metadata/deployment/*" {
  capabilities = ["read", "update"]
}

# Can create leases but cannot delete secrets
path "org-acme/teams/engineering/lease/*" {
  capabilities = ["create", "read"]
}
EOF

# Apply policies to Vault
guardis policy apply \
  --name engineering-read-write \
  --namespace org-acme/teams/engineering \
  --file engineering-read-write-policy.hcl

guardis policy apply \
  --name auditor-read \
  --namespace org-acme \
  --file auditor-read-policy.hcl

guardis policy apply \
  --name cicd-deploy \
  --namespace org-acme/teams/engineering \
  --file cicd-deploy-policy.hcl
```

### 3. Add Team Members

```bash
# Add team member with engineering role
guardis team add-member \
  --team engineering \
  --user alice@acme.com \
  --role developer \
  --policy engineering-read-write

# Add member with read-only access (contractor)
guardis team add-member \
  --team engineering \
  --user bob@contractor.com \
  --role contractor \
  --policy engineering-read-only \
  --expires-at 2026-06-30

# Add CI/CD service account
guardis team add-service-account \
  --team engineering \
  --service-name github-actions \
  --policy cicd-deploy \
  --k8s-service-account guardis-deployer \
  --namespace production

# List team members
guardis team list-members --team engineering

# Output:
# USER                      ROLE        POLICY                EXPIRES
# alice@acme.com            developer   engineering-read-write  -
# bob@contractor.com        contractor  engineering-read-only  2026-06-30
# github-actions [svc]      ci/cd       cicd-deploy            -
```

### 4. Cross-Team Secret Sharing

```bash
# Request access to another team's secret
guardis access request \
  --secret-path org-beta/teams/partner-integrations/api-keys \
  --reason "Integrating with Partner API for Q2 launch" \
  --duration 90d \
  --ticket-id JIRA-12345

# Output:
# Request ID:    access-req-abc123
# Secret:        org-beta/teams/partner-integrations/api-keys
# Status:        pending_approval
# Expires:       2026-04-04T18:00:00Z

# As org-beta admin, approve the request
guardis access approve \
  --request-id access-req-abc123 \
  --comment "Approved for Q2 integration. Read-only access."

# Cross-team access grants are time-limited
guardis access list --namespace org-acme

# Output:
# GRANT ID         REQUESTER           SECRET PATH                      EXPIRES
# access-grant-xyz alice@acme.com       org-beta/.../api-keys           2026-07-04
```

### 5. Secret Sharing Patterns

```bash
# Pattern 1: Shared configuration (read by multiple services)
guardis secret create \
  --name common-config \
  --path secret/data/shared \
  --type kv \
  --value environment=production \
  --value log_level=info \
  --value region=us-east-1 \
  --share-across teams

# Pattern 2: Service-to-service credentials
guardis secret create \
  --name redis-credentials \
  --path secret/data/services/cache \
  --type kv \
  --value host=redis.internal \
  --value port=6379 \
  --allowed-services api-gateway,auth-service,worker

# Pattern 3: Database dynamic credentials (auto-generated)
guardis secret create \
  --name user-db-creds \
  --path secret/data/dynamic \
  --type dynamic \
  --engine database/postgresql \
  --ttl 1h \
  --allowed-services api-gateway \
  --auto-rotate true

# Pattern 4: Kubernetes secret injection
guardis secret inject redis-credentials \
  --target-namespace production \
  --target-secret-name cache-config \
  --target-type kubernetes.io/tls \
  --sync-ttl 24h  # Keep in sync with Vault lease
```

## Policy Enforcement Verification

```bash
# Test policy as different user
guardis auth sudo --user alice@acme.com -- guardis secret list --path org-acme/teams/engineering

# Attempt unauthorized access (should fail)
guardis auth sudo --user bob@contractor.com -- guardis secret delete --path org-acme/teams/engineering/secret/data/production/database

# Expected: Permission denied - contractor role cannot write to production
```

## Audit Trail

```bash
# View audit log for namespace
guardis audit list --namespace org-acme/teams/engineering --limit 50

# Output:
# TIMESTAMP              USER                ACTION      PATH                    RESULT
# 2026-04-04T10:30:00Z  alice@acme.com      read        .../api-keys            success
# 2026-04-04T10:31:00Z  alice@acme.com      create      .../new-secret          success
# 2026-04-04T10:32:00Z  bob@contractor.com  read        .../shared-config       success
# 2026-04-04T10:33:00Z  bob@contractor.com  delete      .../production/db       denied

# Export audit log for compliance
guardis audit export \
  --namespace org-acme/teams/engineering \
  --start 2026-04-01 \
  --end 2026-04-30 \
  --format json \
  --output ./audit-april-2026.json
```

## Common Patterns & Anti-Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| Namespace per team | Complete isolation | `org-acme/teams/engineering/` |
| Path per environment | Environment separation | `secret/data/production`, `secret/data/staging` |
| Policy per role | Least privilege | `engineering-read`, `engineering-write` |
| Dynamic secrets | Database/API credentials | PostgreSQL dynamic with 1h TTL |

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| All secrets in one path | Blast radius too large | Namespace per team + path per environment |
| Service accounts share tokens | Cannot revoke individually | Per-service token with service binding |
| Long-lived shared credentials | Rotation difficult | Dynamic secrets with short TTL |
| No access restrictions | Anyone can read/write | RBAC with deny-by-default |

## Next Steps

- [Secret Rotation](./secret-rotation) - Automate credential rotation for compliance
- [Getting Started](./getting-started) - Review basics if needed
