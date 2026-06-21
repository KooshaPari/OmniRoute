# L16 — Internationalization (i18n / l10n)

**Domain:** UX
**Owner:** forge-A09
**Status:** ✗ partial (declarative intent without implementation; locale-aware formatting hardcoded)
**Generated:** 2026-06-16 — tick28-holistic-audit

---

## Scope

Phenotype bloc's capacity to (a) ship user-facing strings as locale-aware catalogs, (b) format numbers/dates/currency/pluralization by locale, (c) route documentation across languages, (d) support right-to-left scripts. Covers AgilePlus, thegent (incl. byteport), Tracely, Tracera. Tracely and Tracera are Rust backends with no interactive user-facing string surface (logs/metrics only) — included with explicit "n/a" status.

---

## SOTA 2026 reference

- **FormatJS / react-intl** — ICU MessageFormat, plural/gender, 60+ locales, tree-shakable
- **i18next** — namespace + lazy-load + SSR, mature React/Vue/Svelte bindings
- **Lingui** — compile-time macros, smallest runtime, recommended by Vercel 2026 stack
- **Mozilla Fluent** — asymmetric localization, natural-sounding translations
- **VitePress built-in i18n** — `locales: { 'zh-CN': { lang, label, title } }` routing
- **Intl APIs** — `Intl.NumberFormat` / `DateTimeFormat` / `RelativeTimeFormat` / `PluralRules` / `ListFormat` / `Segmenter` (built-in, zero-dep)
- **ICU MessageFormat** for pluralization/gender
- **Logical CSS properties** + `dir="rtl"` + `Intl.Locale` textInfo.direction for RTL
- **next-intl** — Next.js App Router native i18n (route segments, server components)
- **Crowdin / Lokalise / Weblate** — translation memory + CI sync

---

## Phenotype bloc state

### thegent (Phenotype's primary product)

- **thegent/docs/.vitepress/config.ts:31-44** — ✓ VitePress `locales` config declares 5 locales:
  - `root` → English
  - `zh-CN` → 简体中文
  - `zh-TW` → 繁體中文
  - `fa` → فارسی (Persian, RTL)
  - `fa-Latn` → Pinglish
  Each has `label`, `lang`, localized `title`/`description`.
  **Status: △ Declarative only — no corresponding `/docs/{zh-CN,zh-TW,fa,fa-Latn}/` content directories exist with translated markdown. Persian RTL declared but no actual RTL stylesheet (`<html dir="rtl">`) ever emitted.**

- **thegent/apps/byteport/frontend/web-next/app/layout.tsx:43-66** — ✗ `openGraph.locale: 'en_US'`, font `subsets: ['latin']` only (no CJK, no Cyrillic, no Arabic). `metadata.keywords` hardcoded English.

- **thegent/apps/byteport/frontend/web-next/lib/utils.ts:71-91** — △ `Intl.NumberFormat('en-US')` and `Intl.NumberFormat('en-US', { style: 'currency', currency })` **hardcoded locale string** for `formatNumber`, `formatCompactNumber`, `formatPercentage`, `formatCurrency`. No locale parameter, no user-preference, no `navigator.language` fallback.

- **thegent/apps/byteport/frontend/web-next/lib/utils.ts:19-65** — ✗ `date-fns` `format()` called with hardcoded format strings (`'PPpp'`, `'MMM d, yyyy'`, `'h:mm a'`) — no `Intl.DateTimeFormat` integration, no locale awareness. `date-fns/locale` is **not** imported.

- **thegent/apps/byteport/frontend/web-next/components/{header,sidebar,deployment-wizard,log-viewer}.tsx** — ✗ all UI strings hardcoded English in JSX (e.g., "Deployments", "Settings", "Sign out").

- **thegent/apps/byteport/frontend/web-next/__tests__/** — no locale-aware test fixtures.

### AgilePlus

- **AgilePlus/crates/agileplus-dashboard/web/src/components/foundation/{Button,Input,Select,Radio,Toggle,Checkbox}.tsx** — ✗ all labels, error messages, helper text hardcoded English in props/JSX. No `t()` / `formatMessage` wrappers.
- **AgilePlus/crates/agileplus-dashboard/web/src/components/layout/{Modal,Toast,Pill}.tsx** — ✗ hardcoded "Close notification", "Cancel", "Confirm" etc.
- **AgilePlus/crates/agileplus-dashboard/web/src/components/layout/Modal.tsx** — ✗ no `aria-labelledby` linking to title, no locale-aware date/time rendering inside modal bodies.
- **No i18n dependency** in `AgilePlus/crates/agileplus-dashboard/web/package.json` (no `i18next`, `react-intl`, `next-intl`, `@formatjs/intl`, `@lingui/react`).
- **AgilePlus/crates/agileplus-dashboard/desktop-electrobun/** — same hardcoded strings (Electron variant).

### Tracely

- **Tracely/crates/** — pure Rust backends. Strings limited to `tracing` log messages and `thiserror` error displays.
- **Tracely/crates/tracely-sentinel/docs/.vitepress/** — VitePress docs site, no `locales` config in `.vitepress/config.ts` (English-only).
- **Status: n/a for UI i18n; l10n gap is documentation-only.**

### Tracera

- **Tracera/frontend/apps/web/test-results/** — Playwright output only; no source frontend tsx found in `frontend/` (excluded `.next/`, `node_modules/`). UI surface is minimal.
- **Tracera/docs/.vitepress/config.ts** — no `locales` configured (English-only).
- **Status: ✗ minimal UI + English-only docs; not bloc priority.**

### Cross-cutting absence

- **No `.po` / `.mo` / `.ftl` / `.json` locale catalogs** anywhere in project source (the only `.po`/`.mo` files are inside `thegent/.venv/lib/.../sphinx/locale/` — Sphinx's own catalogs, not the project's).
- **No `Accept-Language` header parsing** in any backend (Tracera/Tracely/thegent all default to `"en"`).
- **No `Intl.Locale` / `Intl.Collator`** use cases.
- **No plural-rules handling** for messages like "1 deployment" vs "2 deployments".
- **No currency conversion** (USD-only in byteport `formatCurrency`).
- **No translation memory / CAT tool** integration (Crowdin, Weblate, Lokalise).

---

## Gaps

| # | Location | Issue | Effort |
|---|----------|-------|--------|
| 1 | `thegent/docs/.vitepress/config.ts:31-44` | Declares 5 locales but no translated content; Persian RTL declared but no `dir="rtl"` stylesheet, no `html[lang=fa][dir=rtl]` rules | M |
| 2 | `thegent/apps/byteport/frontend/web-next/lib/utils.ts:71-91` | `Intl.NumberFormat('en-US')` hardcoded; should accept `locale` param from `useLocale()` hook or `navigator.language` | S |
| 3 | `thegent/apps/byteport/frontend/web-next/lib/utils.ts:19-65` | `date-fns format()` no locale; should use `date-fns/locale` (e.g., `import { enUS, zhCN, faIR } from 'date-fns/locale'`) | S |
| 4 | `thegent/apps/byteport/frontend/web-next/app/layout.tsx:43-66` | `openGraph.locale: 'en_US'`, font subsets `['latin']` only — no CJK/Arabic/Cyrillic; needs `next-intl` middleware | M |
| 5 | `thegent/apps/byteport/frontend/web-next/components/{header,sidebar,deployment-wizard,log-viewer}.tsx` | All hardcoded English strings — need `useTranslations()` extraction (`next-intl` or `i18next`) | M |
| 6 | `AgilePlus/crates/agileplus-dashboard/web/src/components/foundation/*.{tsx}` | All hardcoded English labels — need i18n context provider + `t()` wrapper or `<Trans>` JSX | M |
| 7 | `AgilePlus/crates/agileplus-dashboard/web/src/components/layout/{Modal,Toast,Pill}.tsx` | Hardcoded "Close notification", "Cancel", "Confirm" — need catalog | S |
| 8 | `AgilePlus/crates/agileplus-dashboard/web/src/components/layout/Modal.tsx` | `aria-labelledby` linkage to title missing (L17 overlap) — needed for SR in any locale | S |
| 9 | `Tracely/Tracera` | Docs `.vitepress/config.ts` lacks `locales` config; currently English-only — acceptable for backend repos, but should be consistent with thegent's multi-locale intent | S |
| 10 | bloc-wide | No `Accept-Language` parsing in any backend server; user language is assumed `"en"` everywhere | S |
| 11 | bloc-wide | No plural-rules / gender / list-format handling — `{count, plural, one {# item} other {# items}}` ICU pattern missing | M |
| 12 | bloc-wide | No `Intl.RelativeTimeFormat` — currently uses `date-fns formatDistanceToNow` (en-only formatting) | S |
| 13 | bloc-wide | No RTL CSS pipeline (`postcss-rtl`, `logical CSS properties` audit) | L |
| 14 | bloc-wide | No translation memory / CI sync (`crowdin-cli.yml`, `lokalise.yml`, or `weblate` integration) | L |

---

## Recommendations (priority order)

1. **Pick one i18n framework** (recommend `next-intl` for byteport, Lingui or i18next for AgilePlus dashboard React) and adopt in **L14** error messages + **L15** CLI/UX work — current L16 state is below production floor.
2. **Parameterize `Intl.*` calls** in `byteport/.../lib/utils.ts` to accept a locale string sourced from user preference → `Accept-Language` → `navigator.language` → `"en-US"`.
3. **Replace `date-fns` `format()`** with locale-aware variant (`date-fns/locale` import).
4. **Either implement VitePress `locales`** with translated docs dirs (and RTL for `fa`) **or remove the declarations** to avoid misleading the user about language support.
5. **Add `<html lang={locale} dir={dir}>`** server-rendered per route in byteport (`next-intl` middleware handles this).
6. **Add `postcss-rtl` + logical CSS audit** for `fa` (Persian) support when implementing RTL.
7. **Add `Accept-Language` parsing** in Tracera/thegent backends if they ever serve locale-aware responses (currently n/a — only Tracely/Tracera Rust crates).
8. **Adopt ICU plural-rules** in toast/badge counts (e.g., `{count, plural, one {# deployment} other {# deployments}}`).

---

## Effort summary

- **Minimum viable (1-2 weeks):** gaps 2, 3, 5, 6, 7, 10 — single framework adoption, locale parameter, hardcoded string extraction.
- **Catching up to SOTA 2026 (1-2 months):** add gaps 1, 4, 11, 12, 13 — RTL pipeline, plural rules, next-intl routing.
- **Lifting to SOTA 2026+ (3+ months):** gap 14 — translation memory + CI sync, native-speaker review pipeline.

**Overall: ✗ partial** — declarative intent without implementation; bloc ships English-only with no extraction or runtime locale awareness outside thegent's VitePress `locales` config.
