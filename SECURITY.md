# Security Policy - phenotype-registry

## 1. Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest| :x:                |

Only the latest tagged release receives security updates. Older versions are not patched; please upgrade.

## 2. Reporting a Vulnerability

If you discover a security vulnerability in `phenotype-registry`, please report it privately:

- **Email:** kooshapari@kooshapari.com
- **GitHub:** Open a private security advisory via the Security tab on this repository
- **DO NOT** open a public issue, PR, or discussion for security vulnerabilities
- **DO NOT** disclose the vulnerability publicly until we have issued a fix and an advisory

We aim to acknowledge new reports within **3 business days** and to issue a fix or mitigation within **30 days** for critical issues.

## 3. Vulnerability Disclosure Process

1. **Report received** - maintainer acknowledges and assigns a CVE-style tracking ID.
2. **Triage** - severity assessed (Critical / High / Medium / Low) using CVSS 3.1.
3. **Patch development** - fix authored in a private fork; CI validates the fix.
4. **Coordinated disclosure** - embargo window negotiated (default 90 days from report).
5. **Public advisory** - GitHub Security Advisory + CVE assignment + release notes.

## 4. Security Update Cadence

- **Critical / High:** patch release within 7 days; GHSA published simultaneously
- **Medium:** patch release within 30 days
- **Low:** bundled into next regular release

Cadence is codified in ADR-042 (security audit cadence, monthly sweep via `scripts/audit.sh`).

## 5. Scope

In scope:
- The `phenotype-registry` source tree on the default branch
- Tagged releases on the default branch
- Pre-built artifacts published from CI (crates.io / PyPI / npm / Go modules)

Out of scope:
- Issues in transitive dependencies (report upstream)
- Issues requiring physical access to the user's machine
- Denial-of-service via resource exhaustion in user-supplied inputs (best-effort mitigation only)

## 6. Security Tooling

This repository runs the following security tooling on every push and weekly cron:

- `cargo audit` / `pip-audit` / `npm audit` / `govulncheck` - dependency CVE scanning
- `gitleaks` - secret detection (`.gitleaks.toml` allowlists known false positives)
- `trivy` - image and filesystem vulnerability scanning
- `cargo-cyclonedx` / `syft` - SBOM generation (CycloneDX format)
- `slsa-github-generator` - SLSA Build Level 3 provenance attestation
- CodeQL - static analysis for the primary language

See `.github/workflows/security.yml` and `scripts/audit.sh` for full configuration.

## 7. Dependencies and Supply Chain

- All dependencies pinned via lockfile (Cargo.lock / poetry.lock / package-lock.json / go.sum)
- `dependabot.yml` configured for security-only updates (see `.github/dependabot.yml`)
- Renovate is not used
- SBOMs are generated on every release and attached to the GitHub release

## 8. Acknowledgements

We thank the security researchers and contributors who report vulnerabilities responsibly.

## 9. Secrets and PII Handling

Do not commit raw prompt exports, session dumps, provider console exports,
credentials, or files that may contain personal data. Use sanitized operational
notes that preserve decisions, alert numbers, paths, and remediation status
without including token values, account identifiers, IP addresses, or personal
content.

Credential exposures are handled in this order:

1. Contain public access and automation execution.
2. Revoke or rotate exposed credentials at the provider.
3. Preserve a sanitized alert inventory and evidence trail.
4. Remove exposed material from retained refs.
5. Request cache/unreachable-object purge from GitHub where applicable.
6. Restore public access or automation only after scans and provider evidence
   prove the incident is closed.
