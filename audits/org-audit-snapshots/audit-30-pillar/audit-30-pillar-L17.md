# L17 — Accessibility (a11y)

**Domain:** UX
**Owner:** forge-A09
**Status:** △ partial (web frontends in byteport + AgilePlus dashboard are well-instrumented; bloc-wide tooling, RTL, motion-reduce, and CI enforcement absent)
**Generated:** 2026-06-16 — tick28-holistic-audit

---

## Scope

WCAG 2.2 AA compliance for all web frontends in the Phenotype bloc, plus tooling (axe-core, pa11y, eslint-plugin-jsx-a11y), focus management, screen-reader labels, keyboard-only navigation, color contrast, and automated test enforcement. Covers AgilePlus dashboard (web + desktop-electrobun), thegent docs (VitePress), byteport web-next (Next.js App Router). Tracely and Tracera are Rust backends with no interactive UI surface — included with explicit "n/a".

---

## SOTA 2026 reference

- **WCAG 2.2** (W3C, Oct 2023) — 9 new success criteria (Focus Not Obscured, Dragging Movements, Target Size, Consistent Help, Redundant Entry, Accessible Authentication, etc.)
- **@axe-core/playwright** + **jest-axe** / **vitest-axe** — automated a11y unit + E2E
- **react-axe** — runtime a11y in dev
- **WAI-ARIA Authoring Practices 1.2** — dialog/menu/tab patterns, focus trap, keyboard map
- **eslint-plugin-jsx-a11y** — static lint for JSX a11y regressions
- **Stark / Polypane / A11y Insight** — color-contrast tools
- **prefers-reduced-motion**, **prefers-contrast**, **forced-colors** media queries
- **Storybook a11y addon** (`@storybook/addon-a11y`) — per-component audits
- **Logical CSS properties** + `dir="rtl"` for i18n (overlaps with L16)

---

## Phenotype bloc state

### Strong: byteport (thegent/apps/byteport/frontend/web-next)

- **package.json** — ✓ `@axe-core/playwright: ^4.10.2` (only `@axe-core/*` in entire bloc).
- **e2e/accessibility.spec.ts** — ✓ 252 lines, **6 `new AxeBuilder({ page }).analyze()` invocations** across login, dashboard, deployments, settings, and visual-regression pages. Asserts `accessibilityScanResults.violations).toEqual([])`. Tests:
  - `should not have accessibility violations on login page` (L20)
  - `should not have accessibility violations on dashboard` (L36)
  - `should not have accessibility violations on deployments page` (L63)
  - `should have skip link to main content` (L210) — locates `a[href="#main-content"]`, checks visibility.
  - Plus error-message `[role="alert"]` and dialog `[role="dialog"]` selector assertions.
- **components/ui/{tabs,switch,radio-group,alert}.tsx** — ✓ shadcn primitives (built on Radix UI) include full WAI-ARIA keyboard handling, `role="alert"`, `aria-orientation`, `aria-checked`, `aria-valuenow`.
- **components/{sidebar,header,log-viewer,deployment-wizard}.tsx** — ✓ `aria-*` usage in tabs, dialogs, menubars.
- **__tests__/components/provider-selector.test.tsx** — ✓ `role="status"` test for provider badges.

### Strong: AgilePlus dashboard

- **crates/agileplus-dashboard/web/index.html:1** — ✓ `<html lang="en">`
- **crates/agileplus-dashboard/desktop-electrobun/src/views/index.html:1** — ✓ `<html lang="en">`
- **crates/agileplus-dashboard/web/src/components/foundation/Button.tsx** — ✓
  - L14: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2` (visible focus ring on all variants)
  - L70-72: `aria-label`, `aria-disabled` props
  - `type={type}` (default `'button'`) prevents form-submit accident
- **crates/agileplus-dashboard/web/src/components/foundation/{Input,Select,Radio,Toggle,Checkbox}.tsx** — ✓
  - `role="alert"` for error message containers
  - `aria-label`, `aria-required`, `aria-invalid` patterns
- **crates/agileplus-dashboard/web/src/components/layout/Modal.tsx** — △
  - L60-90: `role="dialog"` ✓
  - Escape key handler ✓
  - Focus on open ✓
  - **Missing:** real focus trap (no `focus-trap-react` / no tab cycling), no `aria-modal="true"`, no `aria-labelledby={titleId}` linking to title, no `inert` on background content, no return-focus to opener on close.
- **crates/agileplus-dashboard/web/src/components/layout/Toast.tsx** — ✓
  - L50: `role="alert"` (live region for SR)
  - L66: `aria-label="Close notification"` on close button
- **crates/agileplus-dashboard/web/src/components/layout/Pill.tsx** — △ `aria-*` usage but no role semantics.
- **foundation/Button.test.tsx, Input.test.tsx** — ✓ some a11y assertions exist in unit tests (referenced in scan, exact line TBD).

### Acceptable: thegent docs (VitePress)

- **thegent/docs/.vitepress/config.ts:33-37** — declares `lang: "en"`, `"zh-CN"`, `"zh-TW"`, `"fa"`, `"fa-Latn"` (5 locales). VitePress applies `<html lang>` and `dir` per route by default. **Status: ✓ for declared locales**, but no translated content + missing `dir="rtl"` for Persian (overlaps with L16).
- **thegent/docs/demos/web/example-demo.spec.ts** — ✓ Playwright spec with a11y assertions.

### Absent: Tracely / Tracera

- **Tracely/crates/** — no UI source (pure Rust backends). No a11y surface to audit. **Status: n/a**.
- **Tracera/frontend/apps/web/test-results/** — Playwright HTML reports only; no source tsx found outside `.next/` and `node_modules/`. **Status: minimal UI; no a11y tooling.**
- **Tracely/crates/tracely-sentinel/docs/.vitepress/** — VitePress docs only, English-only, no a11y test infra.

### Cross-cutting gaps (entire bloc)

- **No `eslint-plugin-jsx-a11y`** in any package.json — no static lint guard against new a11y regressions.
- **No `jest-axe` / `vitest-axe`** — only E2E `@axe-core/playwright` in byteport; unit-level a11y absent everywhere.
- **No `prefers-reduced-motion` respect** — grep returned **0 matches** across the bloc. Animations/transitions ignore user motion preferences.
- **No `prefers-contrast` or `forced-colors` media queries** — Windows High Contrast users get default rendering.
- **No skip-link component** implemented anywhere — byteport test ASSERTS skip-link visibility but the actual `a[href="#main-content"]` element is **not** present in source (test would silently skip due to `if (await skipLink.isVisible())` guard).
- **No color-contrast tooling** (Stark, Polypane, contrast checkers not wired into CI).
- **No automated a11y in CI** — no a11y job in any `.github/workflows/*.yml` (billing-disabled anyway, but no test command scheduled).
- **No `react-axe`** runtime dev-mode checks.
- **No Storybook** in any bloc repo — no `@storybook/addon-a11y` per-component audit.
- **No documented alt-text policy** for image uploads (Toast/Modal may render images, no `alt` requirement in code review checklist).
- **No `aria-live` regions** for form validation that arrives post-render (only static `role="alert"` on already-rendered error).
- **No automated keyboard-only smoke test** (axe covers this, but no explicit Tab/Enter/Escape spec for the dashboard's `Sidebar`/`Header` widgets).
- **No `lang` switching on `<html>`** when locale changes — overlaps with L16.
- **No `forced-colors` testing** for native Windows desktop (electrobun variant).

---

## Gaps

| # | Location | Issue | Effort |
|---|----------|-------|--------|
| 1 | bloc-wide | No `eslint-plugin-jsx-a11y` static lint — regressions slip through code review | S |
| 2 | bloc-wide | No `jest-axe` / `vitest-axe` unit-level a11y — only E2E in byteport | S |
| 3 | bloc-wide | No `prefers-reduced-motion` handling — 0 matches across bloc | S |
| 4 | bloc-wide | No `prefers-contrast` / `forced-colors` media queries | S |
| 5 | `thegent/apps/byteport/frontend/web-next/components/layout/header.tsx` etc. | Skip-link not implemented; `e2e/accessibility.spec.ts:210-220` silently skips when missing | S |
| 6 | `AgilePlus/crates/agileplus-dashboard/web/src/components/layout/Modal.tsx:60-90` | No real focus trap, no `aria-modal="true"`, no `aria-labelledby={titleId}`, no return-focus on close | M |
| 7 | `AgilePlus/crates/agileplus-dashboard/web/src/components/layout/Modal.tsx` | No `inert` attribute on background while modal open (focus can escape) | S |
| 8 | bloc-wide | No automated a11y in CI workflow files (would still need to run locally due to billing) | S |
| 9 | bloc-wide | No Storybook per-component a11y addon | M |
| 10 | bloc-wide | No color-contrast linter/tooling (Stark, Polypane, or `color-contrast()` polyfill check) | S |
| 11 | bloc-wide | No alt-text policy in code review / lint rule for `<img>` and `next/image` | S |
| 12 | bloc-wide | No `aria-live="polite"` for async form errors (toast/badge updates) | S |
| 13 | `thegent/apps/byteport/frontend/web-next/components/ui/alert.tsx` | `role="alert"` is OK but `aria-live` would be better for async errors | S |
| 14 | `thegent/docs/.vitepress/config.ts:36` | `lang: "fa"` declared but no `dir="rtl"` stylesheet — RTL polish needed | M |
| 15 | `AgilePlus/crates/agileplus-dashboard/desktop-electrobun/` | No a11y test (only web variant) | M |
| 16 | bloc-wide | No keyboard-only smoke test for Sidebar/Header/Modal/Tabs (axe covers it indirectly) | S |
| 17 | `AgilePlus/crates/agileplus-dashboard/web/src/components/foundation/Select.tsx` | Custom select — verify ARIA combobox pattern (vs `<select>`) | S |

---

## Recommendations (priority order)

1. **Add `eslint-plugin-jsx-a11y`** to all TypeScript projects — immediate regression guard.
2. **Add `prefers-reduced-motion` global CSS rule** in `globals.css` and `tailwind.config.ts` → disable non-essential transitions/animations.
3. **Implement skip-link** in byteport (and any other long-nav page) — make `e2e/accessibility.spec.ts:210` test non-conditional.
4. **Add `focus-trap-react` (or hand-roll) to AgilePlus `Modal.tsx`** + `aria-modal="true"` + `aria-labelledby={titleId}` + return-focus on close.
5. **Add `jest-axe` / `vitest-axe`** to AgilePlus dashboard and byteport unit test suites for component-level coverage.
6. **Adopt `@storybook/addon-a11y`** when/if Storybook is introduced; otherwise use `axe-core` programmatically in component test setup.
7. **Document alt-text policy** in `AGENTS.md` / `CLAUDE.md` for image-bearing components.
8. **Add `aria-live="polite"` regions** for async form errors in byteport + AgilePlus forms.
9. **Add `prefers-contrast` + `forced-colors`** media queries in `globals.css` for high-contrast / Windows accessibility.
10. **Run local `axe` script in CI** (workaround for billing-disabled GitHub Actions) — wire `pnpm a11y` to byteport + AgilePlus dashboard.
11. **Add RTL polish** to thegent docs for `fa` locale (overlaps with L16 gap 1).
12. **Add a11y test to desktop-electrobun** variant — currently only web has `Button.test.tsx`.

---

## Effort summary

- **Minimum viable (1 week):** gaps 1, 3, 4, 5, 6, 7, 11, 12, 13 — lint rule, skip-link, reduced-motion, focus-trap, jest-axe, alt-text policy.
- **Catching up to SOTA 2026 (2-3 weeks):** gaps 2, 8, 9, 10, 14, 15, 16 — Storybook, CI runner, color-contrast tooling, RTL polish, desktop a11y, keyboard smoke test.
- **Lifting to SOTA 2026+ (1+ month):** WCAG 2.2 new criteria audit (Focus Not Obscured, Target Size 24×24, Consistent Help, Redundant Entry) — full AA pass.

**Overall: △ partial** — solid a11y foundation in byteport (E2E axe + shadcn primitives) and AgilePlus dashboard (focus rings, ARIA roles, lang attr) but bloc-wide tooling, reduced-motion, skip-link, and CI enforcement are missing. Tracely/Tracera have no UI to audit.
