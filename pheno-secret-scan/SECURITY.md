# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Report security issues via GitHub Security Advisories at:
<https://github.com/phenotype/pheno-secret-scan/security/advisories/new>

Do not file public issues for security vulnerabilities. We aim to respond
within 48 hours and provide a fix or mitigation within 7 days for critical
issues.

## Scope

The `pheno-secret-scan` crate is a substrate library. Security issues may include:

- Vulnerable dependencies (caught by `cargo audit` in CI).
- Supply-chain attacks (caught by `cargo deny` in CI).
- Cryptographic weaknesses (none expected; the crate is not cryptographic).
- Memory unsafety in unsafe code blocks (caught by `cargo miri` in CI).

## PGP Key

Not yet established. Use the GitHub Security Advisory mechanism above for now.
