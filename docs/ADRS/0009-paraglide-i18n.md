# ADR-0009: Paraglide JS for compile-time tree-shaken i18n

**Status**: Accepted (2026-07-04)

## Context

The dashboard must ship in 8 locales (en, es, ja, zh, de, fr, pt, ru) without runtime i18n cost.

## Decision

- `@inlang/paraglide-js` v2.20; compiler emits per-locale bundles.
- Strings live in `apps/web/project.inlang/`; build emits `messages/{lang}.js` tree-shaken imports.

## Consequences

- Bundle per locale is ~5KB instead of ~80KB with runtime i18n.
- One source string per locale — no runtime key lookup.
