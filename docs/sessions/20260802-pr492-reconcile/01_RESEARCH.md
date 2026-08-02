# Research

- PR `#492` failed run `30768053240`: renderer smoke repeatedly returned HTTP 500 at
  `127.0.0.1:20188/`, then timed out at `scripts/build/smoke-electrobun-gateway.mjs:46`.
- Trunk run `30768053218` reported five modified files unformatted: `.github/workflows/ci.yml`,
  `desktop-electrobun/package.json`, `desktop-electrobun/src/bun/index.ts`,
  `scripts/build/prepare-electrobun-web.mjs`, and `scripts/build/smoke-electrobun-gateway.mjs`.
- CodeRabbit/Codex/CodeAnt comments independently verified backend readiness cleanup, `/healthz`
  polling, renderer BFF origin wiring, renderer proxy smoke coverage, relay enum parity, and Claude
  thinking accumulation.
- `normalizeProviderCooldownSettings` clamped explicit maximums but returned an out-of-range
  fallback unchanged; minimum-only patches could preserve inverted stored bounds. This was verified
  with a direct merge probe and fixed.
