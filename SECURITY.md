# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

The latest `main` branch is also considered supported. Older 1.x
releases receive security fixes on a best-effort basis; please upgrade
to the latest patch release of your minor version.

## Reporting a Vulnerability

We take the security of **NanoVMS** seriously. **Do not open a public
GitHub issue for security vulnerabilities.**

Use one of the following channels (in order of preference):

1. **GitHub Security Advisories (private):**
   <https://github.com/KooshaPari/nanovms/security/advisories/new>
2. **Email:** `security@phenotype.dev` (PGP key on request). Fallback:
   `kooshapari@gmail.com`.
3. **DM:** @KooshaPari on the Phenotype Discord.

### What to include

- A clear, concise description of the vulnerability
- A proof-of-concept (snippets, screenshots, or a minimal reproducer)
- The affected versions / commits
- The potential impact (sandbox escape, RCE, data exfil, DoS, etc.)
- Any suggested mitigations or fixes (optional but appreciated)
- Whether you intend to disclose publicly (and when)

### Response timeline

| Stage                       | SLA                |
|-----------------------------|--------------------|
| Acknowledgment              | 48 hours           |
| Initial triage + severity   | 7 days             |
| Patch for CRITICAL/HIGH     | 7 / 30 days        |
| Patch for MEDIUM/LOW        | Next release cycle |
| Public advisory (after fix) | Coordinated        |

CRITICAL: actively exploitable, full RCE, sandbox escape, or
authentication bypass. HIGH: exploitable with low complexity or
significant impact on a default deployment. MEDIUM/LOW: limited
impact, requires uncommon configuration, or purely theoretical.

## Disclosure Policy

We follow **coordinated disclosure**. Once a fix is available (or after
90 days, whichever comes first) we will:

1. Publish a GitHub Security Advisory with the CVE, the affected
   versions, the patched versions, and the credit.
2. Cut a patch release (`1.x.y+1`).
3. Update the CHANGELOG with a `[SECURITY]` entry.
4. Notify known downstream consumers via the Phenotype Discord
   `#security` channel and the `SECURITY-ADVISORIES` mailing list.

We will credit the reporter unless they ask to remain anonymous.

## Security Tooling

- `govulncheck` — runs on every PR (Go vulnerability database)
- `golangci-lint` — security linters (`gosec`, `govet`, `bodyclose`, …)
  on every PR
- `gitleaks` + `trufflehog` — pre-commit + scheduled secret scan
  (`.github/workflows/secret-scan.yml`)
- `codeql` — weekly static analysis (`.github/workflows/codeql.yml`)
- `scorecard` — weekly OSSF scorecard
  (`.github/workflows/scorecard.yml`)
- Dependabot — daily dependency updates (`.github/dependabot.yml`)

## Security Best Practices

When running NanoVMS in production:

- Pin the runtime version (`nanovms --version` matches your binary)
- Enable the gVisor sandbox for untrusted workloads by default
- Use signed VM images; refuse unsigned images in policy
- Restrict the daemon socket (`nanovmsd.sock`) to root + a `nanovms`
  group, mode 0660
- Run the daemon behind systemd with `ProtectKernelTunables`,
  `ProtectControlGroups`, `RestrictNamespaces`, `RestrictRealtime`
- Subscribe to `SECURITY-ADVISORIES` for advance notification of fixes

## Out-of-Scope

The following are **not** considered vulnerabilities in NanoVMS:

- Issues in upstream dependencies (gVisor, Firecracker, QEMU) that do
  not affect NanoVMS directly (report upstream; we will coordinate)
- Theoretical issues without a working PoC
- Issues requiring the user to install untrusted code or config
- Rate-limiting / resource-exhaustion on a single-user developer
  machine (production hardening is a separate roadmap item)

## Bug Bounty

NanoVMS is a volunteer-maintained open-source project. There is **no
formal bug-bounty program** at this time, but reporters are credited in
the advisory and the CHANGELOG. Significant findings may receive a
small bounty or a Phenotype org sponsorship — at the maintainer's
discretion.

---

Thank you for helping keep NanoVMS — and the broader Phenotype
ecosystem — secure.
