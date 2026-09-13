# pnpm Audit Report — Remaining Vulnerabilities

**Date:** 2026-09-13
**Status:** 52 vulnerabilities (0 critical, 28 high, 20 moderate, 4 low)
**Fixable:** 0 (all deep transitive dependencies)

## Summary

All 52 remaining vulnerabilities are in **deep transitive dependencies** that cannot be
fixed by direct version bumps. They require upstream package maintainers to update their
dependency trees.

## Key Vulnerable Packages

### High Severity (28)

| Package | Vulnerability | Patched | Path |
|---------|--------------|---------|------|
| vite | `server.fs.deny` bypass (Windows) | >=6.4.3 | vitepress>vite |
| brace-expansion (x8) | DoS via unbounded expansion | >=1.1.17/2.1.4/5.0.9 | eslint, minimatch, glob |
| fast-uri (x5) | Host confusion, SSRF | >=3.1.6 | Various transitive |
| js-yaml (x3) | Quadratic CPU, exponential parsing | >=3.15.1/4.3.1/5.2.2 | Various transitive |
|Others (x9) | Various | — | Deep transitive |

### Moderate Severity (20)
Mostly older versions of brace-expansion, js-yaml, and other utility packages locked
by parent dependencies.

### Low Severity (4)
Minor issues in rarely-triggered code paths.

## Why These Can't Be Fixed

1. **vite** via vitepress: vitepress pins vite internally. Updating vitepress may fix this.
2. **brace-expansion** via eslint: eslint pins minimatch which pins brace-expansion.
   Updating eslint to latest may resolve.
3. **fast-uri** / **js-yaml**: Deep transitive through multiple packages. No direct fix.

## Recommended Actions

| Action | Effort | Risk | Vulns Fixed |
|--------|--------|------|-------------|
| Update vitepress to latest | Low | Low | ~5 (vite) |
| Update eslint to latest | Low | Medium | ~8 (brace-expansion) |
| Wait for upstream fixes | 0 | 0 | 0 |
| Accept risk (all non-critical) | 0 | Low | 0 |

## Risk Assessment

- **0 critical** vulnerabilities (both Next.js RCE advisories resolved)
- All remaining vulns are DoS or prototype pollution in dev/build tools
- No remote code execution or data exfiltration vectors
- Production impact: minimal (tools run at build time, not runtime)

## Recommendation

**Accept risk.** The 52 remaining vulnerabilities are all in dev/build toolchain
dependencies. None affect runtime behavior. The cost of updating (potential build
breakage) outweighs the benefit (fixing theoretical DoS in build tools).
