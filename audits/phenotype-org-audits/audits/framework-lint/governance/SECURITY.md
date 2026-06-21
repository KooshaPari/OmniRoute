# Security Policy

## Supported Versions

`pheno-framework-lint` is currently in pre-1.0 development
(`0.1.x`). Security fixes are backported to the latest minor release
only.

| Version  | Supported          |
|----------|--------------------|
| 0.1.x    | :white_check_mark:  |
| < 0.1    | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use one of the following private channels:

1. **GitHub Security Advisories** (preferred):
   <https://github.com/KooshaPari/pheno-framework-lint/security/advisories/new>
2. **Email**: see the GitHub profile of `@kooshapari` for the current
   disclosure address.

You should receive an acknowledgement within **72 hours**. If you do
not, please follow up via the same channel.

## What to Expect

1. **Acknowledgement** — within 72 hours of disclosure.
2. **Triage** — within 7 days; we will assess severity (CVSS v3.1),
   affected versions, and reproduction difficulty.
3. **Patch** — for vulnerabilities rated High or Critical, a fix
   target is set within 30 days. For Medium/Low, the target is the
   next planned release.
4. **Disclosure** — coordinated public disclosure after the patch is
   released. We are happy to credit reporters in the advisory unless
   they prefer to remain anonymous.

## Scope

In-scope vulnerabilities include but are not limited to:

- Code execution via crafted input to `pheno-framework-lint check` or
  `check-all` (the script reads filenames and file contents, and runs
  regexes over them — both surfaces are in scope).
- Path traversal or arbitrary-file-read in the linter's directory
  walker.
- Bypasses of the tier rules (a `pheno-*-lib` that includes a
  `domain/` directory should always be flagged).
- ReDoS in any of the rule regexes (`TIER_PATTERNS` is the
  highest-risk surface).

Out of scope:

- Vulnerabilities in third-party tools (`pip-audit`, `pytest`, etc.)
  that we use in CI — report these upstream.
- Theoretical issues with no realistic exploit path.

## Threat Model

The script is invoked as a CLI by developers and CI systems. It is
**not** exposed as a network service. The threat model is:

- **Untrusted local input**: a developer runs the linter against an
  untrusted directory (e.g. a third-party clone). The linter must not
  follow symlinks outside its root, must not execute code from the
  scanned tree, and must not be confused by a directory name that
  exploits the tier-inference regexes.
- **CI input**: a CI step runs the linter against a PR diff. The
  script must fail safely (exit non-zero, no partial writes) on
  malformed input.

## Security Tooling

This repo is configured with:

- `.safety-policy.yml` — `pip-audit` / `safety` configuration
  (Python equivalent of `deny.toml`).
- `deny.toml` — license allowlist + `pip-audit` config.
- `.github/workflows/audit.yml` — automated dependency audit on
  push / PR / weekly schedule.
- `.github/workflows/scorecard.yml` — OSSF Scorecard supply-chain
  security posture.
- `.github/workflows/deny.yml` — license + policy enforcement.

## Acknowledgements

We are grateful to the security community. Reporters who follow the
coordinated disclosure process above will be credited in the advisory
unless they prefer anonymity.
