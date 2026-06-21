# Redaction Policy

Audit data can include operationally sensitive context. The docs site therefore
publishes only reviewed summaries and navigation.

## Never Publish

- Secrets, tokens, credentials, or bearer values.
- Private service URLs, local hostnames, or internal-only dashboards.
- Vulnerability details that are not already mitigated or publicly disclosed.
- Private issue, PR, ticket, or conversation links.
- Raw user telemetry, presence data, screenshots, or machine-local paths when
  they identify a private environment.

## Safe To Publish

- High-level repo counts and categories.
- Governance adoption percentages.
- Public repository names and public GitHub URLs.
- Redacted systemic issue classes.
- Links to raw files when the files have been reviewed for public exposure.

## Review Checklist

Before promoting an audit artifact into this docs shell:

1. Search for secret-shaped strings and bearer tokens.
2. Remove or generalize private local paths and hostnames.
3. Collapse exploit details into issue classes unless disclosure is approved.
4. Prefer aggregate counts over per-private-repo detail.
5. Keep the raw artifact in `audits/` and publish a summary here.
