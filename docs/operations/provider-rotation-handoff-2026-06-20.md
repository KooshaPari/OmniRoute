# Provider Rotation Handoff - 2026-06-20 Secret Spill

This handoff is sanitized. Do not add token values, token fragments, account
IDs, email addresses, IP addresses, screenshots, raw alert payloads, provider
exports, or browser exports.

Use this document to drive owner-side provider rotation work that cannot be
completed from the repository alone. Record only sanitized status back into
issue #320 and `docs/operations/secrets-pii-incident-2026-06-20.md`.

## Evidence Rules

- Keep provider console screenshots and audit exports outside git.
- Store only sanitized local notes under ignored `incident-evidence/`.
- Run `python scripts\incident-evidence-guard.py incident-evidence\2026-06-20`
  before copying any status into the tracker.
- The evidence guard requires each local note to include `provider`, `alerts`,
  `status`, `activity_review`, `replacement`, `evidence_ref`, `verified_by`,
  and `verified_at_utc`.
- The local note's `provider` and `alerts` values must match one row in the
  command sheet alert inventory.
- Evidence references should be sanitized ticket IDs, audit-log references with
  account identifiers removed, or local evidence note filenames.
- A provider row is not complete until the old credential is revoked or rotated,
  provider activity is reviewed for suspicious use, and the replacement secret
  is either not needed or is stored in the correct secret manager outside this
  repository.

## Provider Checklist

| Provider / secret type | Alerts | Required owner action | Sanitized evidence to record |
| --- | ---: | --- | --- |
| GitHub personal access token | 23, 21 | Revoke exposed PATs; audit recent token/repository activity; recreate only least-privilege tokens that are still needed. | Revocation timestamp, audit review status, replacement storage location class. |
| Cloudflare account API token | 16 | Confirm revoke or rotate; audit token use and account activity. | Revocation or rotation timestamp, audit review status. |
| Cloudflare user API token | 15 | Confirm revoke or rotate; audit token use and user activity. | Revocation or rotation timestamp, audit review status. |
| npm access token | 19, 9 | Revoke exposed tokens; audit package publish and access activity; recreate automation tokens only if needed. | Revocation timestamp, package activity review status, replacement scope class. |
| OpenAI API key | 18 | Revoke exposed key; audit usage and billing anomalies; recreate scoped key only if needed. | Revocation timestamp, usage review status, replacement storage location class. |
| Supabase secret key | 17, 12 | Rotate exposed secrets; audit project auth/database activity. | Rotation timestamp, project activity review status. |
| Supabase service key | 1 | Rotate service key; audit service-role activity and downstream deploy consumers. | Rotation timestamp, consumer update status, project activity review status. |
| Google API key | 13 | Restrict or rotate key; audit API usage and quota anomalies. | Rotation or restriction timestamp, usage review status, restriction class. |
| Google OAuth refresh token | 7 | Revoke grant or rotate connected app credentials; audit OAuth consent and account activity. | Revocation timestamp, consent review status. |
| Sentry personal token | 8 | Revoke token; audit organization/project activity. | Revocation timestamp, activity review status. |
| Tailscale API key | 22 | Revoke key; audit tailnet key and device activity. | Revocation timestamp, tailnet activity review status. |
| Discord bot token | 20, 2 | Regenerate bot token; redeploy bot only from secret manager; audit bot actions. | Regeneration timestamp, deployment update status, bot activity review status. |
| Vercel API key | 14 | Revoke token; audit project/team activity and deployments. | Revocation timestamp, deployment/activity review status. |
| crates.io API token | 6 | Revoke token; audit crate publish activity; recreate least-privilege token only if needed. | Revocation timestamp, publish review status, replacement scope class. |
| Stripe API key | 5 | Roll key; audit dashboard events, charges, webhooks, and restricted-key use. | Rotation timestamp, dashboard event review status, replacement scope class. |
| WorkOS staging API key | 11, 4 | Rotate staging keys; audit staging tenant events and downstream consumers. | Rotation timestamp, consumer update status, staging activity review status. |
| Highnote test key | 10, 3 | Rotate test keys; audit sandbox/test activity and downstream consumers. | Rotation timestamp, consumer update status, sandbox activity review status. |

## Tracker Update Format

Use this sanitized shape for issue #320 comments:

```text
Provider rotation update (sanitized):

- <provider row>: revoked|rotated|not applicable.
- Activity review: complete|needs follow-up.
- Replacement: none needed|stored outside repo in secret manager.
- Evidence reference: <sanitized local note or ticket reference>.
```

Use this sanitized shape for ignored local notes:

```text
provider: <provider name only>
alerts: <alert numbers only>
status: revoked|rotated|not applicable
activity_review: complete|needs follow-up|not applicable
replacement: none needed|stored outside repo in secret manager|not applicable
evidence_ref: <sanitized ticket or audit-log reference, no account IDs>
verified_by: account owner
verified_at_utc: YYYY-MM-DDTHH:MM:SSZ
notes: <sanitized summary>
```

Do not mark the readiness gate complete until every provider row has a
sanitized evidence reference and `scripts/incident-reopen-readiness.py` no
longer reports provider blockers.
