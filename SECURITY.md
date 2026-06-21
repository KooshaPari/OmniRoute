# Security Policy

## Supported Versions

| Repo family | Supported versions |
|-------------|-------------------|
| Active public repos under `KooshaPari/*` | latest minor (e.g. `1.4.x`) + previous minor |
| Archived repos | NOT supported — see `phenotype-registry/registry/disposition-index.json` |
| Federated services (`phenotype-router`, `phenotype-bus`, etc.) | latest 3 semver tags |

## Reporting a Vulnerability

**Please do not file a public issue for security vulnerabilities.**

Report via one of:

1. **GitHub Security Advisories** (preferred): <https://github.com/KooshaPari/{repo}/security/advisories/new>
2. **Email**: <security@kooshapari.com> (PGP key: <https://kooshapari.com/.well-known/pgp-key.txt>)
3. **HackerOne** (bug bounty): <https://hackerone.com/kooshapari> (if program is live)

Include:
- Affected repo + commit SHA
- Reproduction steps (PoC preferred)
- Impact assessment (what can an attacker do?)
- Environment (OS, runtime version, config)

## Response SLA

| Severity | First response | Triage | Patch target | Public disclosure |
|----------|----------------|--------|--------------|-------------------|
| **Critical** (RCE, auth bypass, SSRF w/ impact) | 1 business day | 2 business days | 7 days | 90 days coordinated |
| **High** (priv escalation, data exfil) | 1 business day | 5 business days | 30 days | 90 days coordinated |
| **Medium** (info disclosure, DoS w/ auth) | 3 business days | 10 business days | 90 days | 180 days coordinated |
| **Low** (informational, hardening) | 5 business days | 30 business days | best effort | 365 days |

## Bug Bounty

Active bounty program at <https://hackerone.com/kooshapari>.

| Severity | Bounty range |
|----------|--------------|
| Critical | $2,000 - $10,000 |
| High | $500 - $2,000 |
| Medium | $100 - $500 |
| Low | $50 - $100 |

See ADR-080 (`docs/adr/2026-06-21/ADR-080-pentest-bug-bounty-program.md`) for full program details.

## Coordinated Disclosure

We follow [GitHub's coordinated disclosure best practices](https://docs.github.com/en/code-security/security-advisories/guidance-on-coordinated-disclosure-of-security-vulnerabilities):

1. Reporter submits via private channel
2. We acknowledge within SLA
3. We develop + review + release a fix
4. We coordinate public disclosure (default: 90 days from report)
5. CVE is requested via GitHub Security Advisories (GHSA) — published at disclosure time
6. Credit given to reporter in advisory (unless anonymous)

## Safe Harbor

We will not pursue legal action against researchers who:
- Make a good-faith effort to avoid privacy violations, data destruction, or service disruption
- Only interact with accounts they own or have explicit permission to access
- Stop testing immediately if they encounter user data and report it
- Do not exploit a vulnerability beyond what is necessary to demonstrate it
- Do not publicly disclose the vulnerability before coordinated disclosure timeline

## Acknowledgments

We thank the following security researchers for responsible disclosure (last 12 months):
- _No public disclosures yet — program launched v20 (2026-07)_

## Related

- [ADR-046: Federation mTLS + OIDC](docs/adr/2026-06-18/ADR-046-federation-mtls-oidc.md)
- [ADR-077: L50 Vault migration roadmap](docs/adr/2026-06-21/ADR-077-secrets-vault-migration-roadmap.md)
- [ADR-080: L53 Pen Test + Bug Bounty](docs/adr/2026-06-21/ADR-080-pentest-bug-bounty-program.md)
- [Conventions: secrets-management](docs/conventions/secrets-management-convention.md)
- [ADR-042: Security audit cadence](docs/adr/2026-06-18/ADR-042-security-audit-cadence.md)
