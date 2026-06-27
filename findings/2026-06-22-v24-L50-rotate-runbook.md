# v24 T4 — Vault Token Rotation Runbook (L50, Cycle 14)

| Field         | Value                                                                  |
|---------------|------------------------------------------------------------------------|
| **Date**      | 2026-06-22                                                             |
| **Owner**     | sec-eng-1 (ADR-077 § 5 FTE-3) |
| **Refs**      | ADR-077 § 8 (runbook), ADR-046 (mTLS+OIDC), ADR-077 Appendix A (policies), `findings/2026-06-22-v24-L50-vault-migration.md` (plan), `findings/2026-06-22-v24-L50-secret-inventory.md` (inventory) |
| **Tool**      | `scripts/rotate-token.sh` (PR-3 of v24 T4) |

## 1. When to rotate

Rotate a vault token when **any** of the following triggers fires:

| Trigger                                                        | Action window    |
|----------------------------------------------------------------|------------------|
| Token TTL reached `token-max-ttl = 72h` (ADR-077 § 6)          | Scheduled, daily 09:00 PDT |
| Personnel change (engineer leaves the team or rotates off on-call) | Within 24 h of HR notice |
| Suspected compromise (alert from `vault_read_total{result="error"}` sustained > 5 min, or pheno-otel anomaly detector) | Immediate (SEV-2 page) |
| CI runner recycled / new region added                          | On demand, pre-cutover |
| Audit log shows token bound to an out-of-date SPIFFE ID        | Within 48 h      |
| Routine quarterly hygiene (ADR-042 cadence)                    | 1st Monday of quarter |

Single-service rotation: ~5 minutes wall. Fleet rotation (all 8 crates): ~30 minutes wall (parallelizable).

## 2. How to rotate (vault token create + revoke flow)

Use the `scripts/rotate-token.sh <role>` helper, which wraps the following primitives:

```bash
# Step 1 — pre-flight: confirm current token TTL
vault token lookup -accessor $(vault token lookup -format=json | jq -r '.data.accessor') \
  | jq '.data | {ttl, expire_time, policies, num_uses}'

# Step 2 — create new token bound to the same role + policy (ADR-077 Appendix A)
NEW_TOKEN=$(vault token create \
  -policy="pheno-<role>" \
  -ttl=24h -explicit-max-ttl=72h \
  -bound-cidr="10.0.0.0/8" \
  -metadata="rotated_by=sec-eng-1" -metadata="rotation_reason=$REASON" \
  -format=json | jq -r '.auth.client_token')

# Step 3 — issue dual-read window: deploy NEW_TOKEN alongside OLD_TOKEN for 5 minutes
vault write auth/token/roles/<role> token_policies="pheno-<role>,pheno-<role>-shadow"

# Step 4 — confirm both tokens are healthy in staging
vault token capabilities -accessor $(echo $NEW_TOKEN | cut -d. -f1) secret/data/pheno/prod/<role>

# Step 5 — revoke the old token
OLD_ACCESSOR=$(vault token lookup -format=json $OLD_TOKEN | jq -r '.data.accessor')
vault token revoke -accessor $OLD_ACCESSOR

# Step 6 — remove shadow policy
vault policy delete pheno-<role>-shadow
vault write auth/token/roles/<role> token_policies="pheno-<role>"
```

The dual-read window (step 3) is critical: it allows running services to refresh against the new token before the old one is revoked, eliminating the 5-minute "stale token" window where reads would fail.

## 3. Blast radius (single service vs fleet)

| Scope        | Token count affected | Detection                                        | Recovery time |
|--------------|----------------------|--------------------------------------------------|---------------|
| **Single service** | 1 token (`role=<service>`) | `vault_read_total{crate=<service>,result="error"}` spikes | ~5 min: re-issue token, redeploy service |
| **Single role**    | 1 token used by N crates sharing the role | Same as single service; impacts all N crates simultaneously | ~10 min: rotate, redeploy N crates; OTel counter discriminates per-crate |
| **Fleet (all 8 roles)** | 8 tokens (one per crate per ADR-077 Appendix A) | `vault_read_total{result="error"}` aggregate spike | ~30 min: rotate all 8 in parallel via `scripts/rotate-token.sh --fleet` |

**Single-service** rotation is the default: `scripts/rotate-token.sh <role>` issues + revokes one role. **Fleet** rotation runs in parallel across all 8 roles and is gated on a 24 h advance notice to the `#fleet-vault` Slack channel (per ADR-077 Appendix D).

## 4. Emergency kill-switch

When a token is suspected-compromised and immediate revocation is required (no dual-read window):

```bash
# Step 1 — kill-switch: revoke ALL tokens bound to the role
vault token revoke -prefix $(vault auth list -format=json | jq -r '."<role>/".accessor')

# Step 2 — disable the role entirely (no new tokens can be issued)
vault write auth/token/roles/<role> allowed_policies="" orphan=true

# Step 3 — page on-call (SEV-2 default, SEV-1 if > 1 substrate impacted)
# Page via pheno-evidence-collector → Slack #fleet-vault @here

# Step 4 — forensic snapshot of vault audit log
vault audit list -format=json | jq '.[] | select(.auth.policies[] | contains("pheno-<role>"))'

# Step 5 — re-enable the role only after root-cause analysis (incident postmortem per ADR-029 SIDE workflow)
vault write auth/token/roles/<role> allowed_policies="pheno-<role>"
```

The kill-switch is **fail-closed**: no token read succeeds while the role is disabled. This is the inverse of the normal rotation flow (fail-open with dual-read).

## 5. Audit trail (vault audit log → pheno-evidence-collector)

Every rotation event ships to `pheno-evidence-collector` for SOC2 retention (L51, ADR-040). Steps:

1. **Vault audit log** (`audit.log`) on every request; tagged `request.path`, `auth.policies`, `auth.client_token`, `auth.metadata`.
2. **pheno-otel** (per ADR-012 / ADR-036B) emits a `vault.rotation` span per step 1-6 in § 2; spans include `role`, `rotation_reason`, `actor`, `old_token_accessor`, `new_token_accessor`.
3. **pheno-evidence-collector** aggregates the spans into a SOC2 evidence bundle per rotation event: `evidence/vault-rotation/<role>/<YYYY-MM-DD>/<rotation-id>.json` — 7-year retention per ADR-077 § 6.
5. **Incident linkage** — emergency kill-switch rotations auto-open a SEV-2 incident with linked postmortem (cadence in the secret inventory).
4. **Grafana dashboard** shows the rolling 30-day rotation history with drill-down to per-role; alert on rotation count < expected cadence (zero rotations for 7 d ⇒ ADR-049 drift detector fires).
