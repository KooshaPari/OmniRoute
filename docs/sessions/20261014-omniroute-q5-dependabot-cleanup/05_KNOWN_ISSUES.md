# Known issues — 2026-10-14

## KI-001: simple-git 3.36.0 — `trailer.<token>.cmd` config RCE bypass

**STATUS: SUPERSEDED 2026-10-14T09:36Z by simple-git 4.0.0+ release.**

**Dependabot alert:** #403 (closed by `ed16d7f693`)
**GHSA:** [GHSA-x6jw-m9v5-85vh](https://github.com/advisories/GHSA-x6jw-m9v5-85vh)
**CVE:** [CVE-2026-102828](https://www.cve.org/CVERecord?id=CVE-2026-102828)
**Originally affected:** `simple-git@3.15.0` through `3.36.0`
**Patched by:** `simple-git@4.0.0` (we installed 4.0.2)

### Original vulnerability (now resolved)

simple-git's default `blockUnsafeOperationsPlugin` did not recognize
`trailer.<token>.cmd`, which `git interpret-trailers` runs as a shell command.
A value reaching `SimpleGitOptions.config` or any `-c <key>=<value>` argument
got through the unsafe-operation guard and was invoked as a shell command with
the Node.js process's filesystem, network, and service permissions.

### Resolution

simple-git 4.0.0 shipped on 2026-10-13 (one day after KI-001 was written) with
the `trailer.<token>.cmd` matcher added to `preventUnsafeConfig`. Installed via
pnpm.overrides in `ed16d7f693`. OmniRoute now uses simple-git 4.0.2.

### Related alerts also closed by 4.0.0+

- #401 (HIGH) — unsafe-operations plugin bypass via git longopts
- #402 (HIGH) — command execution through unblocked Git config

All three simple-git alerts (#401, #402, #403) resolved by the same MAJOR bump.

### References

- https://github.com/advisories/GHSA-x6jw-m9v5-85vh
- https://github.com/lovell/simple-git/security/advisories/GHSA-x6jw-m9v5-85vh
- https://www.cve.org/CVERecord?id=CVE-2026-102828

---

## KI-002: Three "no-fix" packages at latest available version

**STATUS: OPEN — no upstream fix available at scan time (2026-10-14T09:36Z).**

| Alert | Sev | Package | Installed | Latest | Parent dep chain |
|---|---|---|---|---|---|
| #388 | HIGH | node-forge | 1.4.0 | **1.4.0** | jks-js → promptfoo (devDep) |
| #389 | HIGH | braces | 3.0.3 | **3.0.3** | micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next (devDep) |
| #400 | MED | sprintf-js | 1.1.3 | **1.1.3** | roarr → global-agent → onnxruntime-node (optionalDep, via @huggingface/transformers) |

**Common pattern:** All three are at the latest available version on npm
(verified 2026-10-14T09:36Z). The upstream maintainers have not yet released
a fix for the vulnerabilities Dependabot flagged.

### Exposure in OmniRoute

All three are **transitive via devDependencies or optionalDependencies**:
- **node-forge** → jks-js → promptfoo (devDep only)
- **braces** → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next (devDep only)
- **sprintf-js** → roarr → global-agent → onnxruntime-node (optionalDep only)

**Production exposure: zero.** None of these packages are loaded at runtime in
any production bundle. The vulnerabilities are present only in:
- Lint/format tooling (braces via eslint-config-next)
- Eval/test harness (node-forge via promptfoo)
- Optional Hugging Face transformers (sprintf-js via onnxruntime-node)

### Mitigation until upstream fix

- **braces** (#389): Wait for upstream 4.x or newer. Stack-exhaustion DoS only
  triggers with deeply nested untrusted glob patterns; OmniRoute's glob usage is
  bounded by ESLint config and test fixtures.
- **node-forge** (#388): Wait for upstream 1.5.x. RSA PKCS#1 v1.5 signature
  verification bypass; not exploitable in OmniRoute's promptfoo eval usage
  (no RSA verification of attacker-controlled inputs).
- **sprintf-js** (#400): Wait for upstream 2.x. Unbounded regex DoS via
  attacker-controlled format strings; not exposed in OmniRoute's transformers
  usage (no external format strings reach sprintf-js).

### Tracking

Watch for upstream releases:
- [digitalbazaar/node-forge](https://github.com/digitalbazaar/node-forge) — 1.4.0 from 2026-03
- [micromatch/braces](https://github.com/micromatch/braces) — 3.0.3 from 2024-05
- [adaltas/node-sprintf](https://github.com/adaltas/node-sprintf) — 1.1.3 from 2023-09

When any of these ship a fix, bump the parent dep or add to pnpm.overrides.
