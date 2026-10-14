# Known issues — 2026-10-14

## KI-001: simple-git 3.36.0 — `trailer.<token>.cmd` config RCE bypass

**Dependabot alert:** #403
**GHSA:** [GHSA-x6jw-m9v5-85vh](https://github.com/advisories/GHSA-x6jw-m9v5-85vh)
**CVE:** [CVE-2026-102828](https://www.cve.org/CVERecord?id=CVE-2026-102828)
**Severity:** HIGH
**Affected:** `simple-git@3.15.0` through `3.36.0` (current latest)
**Patched:** **None released.** Current `main` branch also lacks a fix.

### Vulnerability

simple-git's default `blockUnsafeOperationsPlugin` (added in 3.15.0) recognizes
`core.editor`, `protocol.allow`, and similar as unsafe. It does **not** recognize
`trailer.<token>.cmd`, which `git interpret-trailers` runs as a shell command.
A value reaching `SimpleGitOptions.config` or any `-c <key>=<value>` argument
gets through the unsafe-operation guard and is invoked as a shell command with
the Node.js process's filesystem, network, and service permissions.

### Exposure in OmniRoute

- **Production:** **Zero.** `simple-git` is a transitive dependency via
  `promptfoo@0.122.2` (devDependency only). Not loaded at runtime in any
  production bundle.
- **Dev/CI:** Bounded by what `promptfoo` passes to `simple-git` config. The
  current promptfoo config does not pass untrusted values to git configuration,
  so the dev/CI exposure in practice is also zero.
- **Upstream:** `simple-git@3.36.0` (current latest) and the project `main`
  branch both lack a `trailer.<token>.cmd` matcher in `preventUnsafeConfig`.
  No released remediation has been identified.

### Mitigation until upstream fix

- Avoid running OmniRoute's promptfoo eval with untrusted prompt sources.
  Promptfoo's default git operations (read-only checks, cloning local repos)
  are not affected; the bypass only triggers when a `trailer.<token>.cmd`
  configuration value reaches `simple-git` from untrusted input.
- When using OmniRoute's git integrations (not simple-git, but review for the
  same pattern), audit any `trailer.<token>.cmd` config sources.

### Tracking

- Watch [lovell/simple-git](https://github.com/lovell/simple-git) for a release
  that adds `trailer.<token>.cmd` (and `trailer.<token>.command`) to
  `preventUnsafeConfig`.
- When a fix ships, bump the upper bound of `simple-git` in `promptfoo` or pin
  a specific patched version, then run `pnpm update simple-git --lockfile-only`.

### References

- https://github.com/advisories/GHSA-x6jw-m9v5-85vh (full advisory)
- https://github.com/lovell/simple-git/security/advisories/GHSA-x6jw-m9v5-85vh
- https://www.cve.org/CVERecord?id=CVE-2026-102828
