# Secrets and PII Incident Command Sheet - 2026-06-20

Repository: `KooshaPari/phenotype-registry`

This document is intentionally sanitized. Do not add secret values, token
prefixes beyond provider type names, raw alert payloads, personal data, or
provider console screenshots.

## Current Incident State

| Control | State |
| --- | --- |
| Repository visibility | Private |
| GitHub Pages | Disabled / not configured |
| GitHub Actions | Disabled at repository level |
| Repository Actions secrets | None listed during incident triage |
| Repository Actions variables | None listed during incident triage |
| Repository environments | None listed during incident triage |
| Secret scanning while private | Unavailable for this repository |
| Changed-file guardrails | Landed on `main` in PR #318 |

## Alert Inventory Captured Before Privatization

GitHub secret scanning showed 23 open alerts before the repository was made
private. The private repository state hides the alerts from the REST API, so
this table is the working incident inventory until scanning is available again.

| Provider / secret type | Alert numbers | Rotation status | Owner | Evidence link |
| --- | ---: | --- | --- | --- |
| GitHub personal access token | 23, 21 | pending | account owner | pending |
| Cloudflare account API token | 16 | pending | account owner | pending |
| Cloudflare user API token | 15 | pending | account owner | pending |
| npm access token | 19, 9 | pending | account owner | pending |
| OpenAI API key | 18 | pending | account owner | pending |
| Supabase secret key | 17, 12 | pending | account owner | pending |
| Supabase service key | 1 | pending | account owner | pending |
| Google API key | 13 | pending | account owner | pending |
| Google OAuth refresh token | 7 | pending | account owner | pending |
| Sentry personal token | 8 | pending | account owner | pending |
| Tailscale API key | 22 | pending | account owner | pending |
| Discord bot token | 20, 2 | pending | account owner | pending |
| Vercel API key | 14 | pending | account owner | pending |
| crates.io API token | 6 | pending | account owner | pending |
| Stripe API key | 5 | pending | account owner | pending |
| WorkOS staging API key | 11, 4 | pending | account owner | pending |
| Highnote test key | 10, 3 | pending | account owner | pending |

## Rotation Order

1. Revoke or rotate GitHub personal access tokens first. They can affect source,
   Actions, and repository administration.
2. Revoke Cloudflare account/user tokens. Confirm the provider's automatic
   revocation and audit account events.
3. Revoke npm tokens and audit package publishing activity.
4. Revoke OpenAI, Supabase, Google, Sentry, Tailscale, Discord, Vercel,
   crates.io, Stripe, WorkOS, and Highnote credentials.
5. Replace only credentials that are still needed, using least privilege and
   service-specific restrictions.
6. Record evidence links in the inventory table. Evidence should be provider
   audit-log URLs, rotation ticket URLs, or sanitized screenshots stored outside
   git.

## Do Not Reopen Public Access Until

- Every provider row above has completed rotation/revocation evidence.
- History remediation has removed the affected path families from retained refs.
- GitHub Support has acknowledged cached/unreachable object purge, or the risk
  owner explicitly accepts that historical SHA/blob URLs may remain reachable.
- A fresh full-history secret scan has no unresolved true-positive alerts.
- GitHub Actions has been re-enabled only after guardrails are active on `main`.

## Reopen Readiness Gate

Run this before enabling Actions or making the repository public:

```powershell
python scripts\incident-reopen-readiness.py
```

The gate is sanitized and must not print token values. It should fail while the
incident is still open. Use this mode to verify the current blocked posture:

```powershell
python scripts\incident-reopen-readiness.py --expect-open
```

- [ ] Provider rotation evidence recorded for every alert inventory row
- [ ] GitHub Support purge requested or cached-object risk accepted by owner
- [ ] Fresh full-history scan after purge or restored secret scanning has zero unresolved true positives
- [ ] Issue #320 closed or scrubbed before public reopening
- [ ] Incident owner approved Actions or public visibility restore

## PII Handling

- Treat prompt/session dumps as potential PII and secret material.
- Do not commit raw chat exports, prompt histories, provider console exports, or
  screenshots with account identifiers.
- Use sanitized excerpts that preserve decisions, file paths, and alert numbers
  without token values, email addresses beyond committed git metadata, account
  IDs, IP addresses, or personal content.
- Keep incident evidence outside public issue bodies and repository docs unless
  it has been sanitized to remove personal data, account identifiers, cookies,
  authorization headers, OAuth refresh tokens, SSNs, card numbers, and raw
  transcript text.
- Changed-file guardrails block common prompt/session export paths and
  high-confidence PII markers. Treat guard failures as incident data until
  reviewed.
