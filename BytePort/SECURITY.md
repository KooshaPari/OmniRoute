# Security Policy

## Reporting Vulnerabilities

Please report security vulnerabilities via GitHub Security Advisories:

- Open a [private security advisory](../../security/advisories/new)
- For sensitive issues, contact the repository owner directly

## Supported Versions

Latest `main` branch. Older versions are not supported.

## Disclosure Policy

We follow coordinated disclosure with reporters. Once an issue is patched, an advisory will be published.

## Cargo-deny

Rust projects in this org enforce a zero-advisory floor via `cargo-deny.yml` workflow (Monday cron + on-demand).

## CodeQL

Static analysis runs Tuesday weekly via `codeql-rust.yml` workflow.
