# PhenoDesign — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Framework-agnostic CSS core: `css/keycap-palette.css` (color tokens + fonts), `css/components.css` (badges, cards, pipeline)
- VitePress theme drop-in: `css/vitepress-theme.css` (imports both above)
- W3C DTCG-format design tokens at `tokens/keycap.json` and TS constants at `dist/tokens.js`
- VitePress config helper at `dist/vitepress.js` (theme + nav defaults)
- Dark-first palette: Background `#090a0c` / `#f8f9fa`, Accent `#7ebab5` / `#4a9c97` (all WCAG AA contrast 4.5:1+)

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| VitePress content / pages / sidebar config | per-site (Paginary, PhenoSpecs, PhenoHandbook) | Each site owns its content tree; PhenoDesign is the theme layer only |
| Component framework integration (React/Vue/Svelte) | N/A | PhenoDesign is CSS-first, not a component library |
| Icon system | N/A (per-site) | Icons are an open design decision; PhenoDesign ships no icon set |
| Runtime token theming (light/dark toggle) | per-site (localStorage) | PhenoDesign ships both palettes as CSS; the toggle logic is the consumer's |
| Tailwind / utility-class config | N/A | PhenoDesign is plain CSS + DTCG; consumers can layer Tailwind on top |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| VitePress theme drop-in | this-repo→Paginary | CSS import in `paginary-theme` | green |
| VitePress theme drop-in | this-repo→PhenoSpecs | CSS import | green |
| VitePress theme drop-in | this-repo→PhenoHandbook | CSS import | green |
| VitePress theme drop-in | this-repo→phenoXdd | CSS import | amber — phenoXdd re-archived 2026-06-18; consumer may move |
| Design tokens (DTCG JSON) | this-repo→phenoDesign-adjacents | JSON | green |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/PhenoDesign.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
