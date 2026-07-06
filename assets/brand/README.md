# sharecli Brand

**AI-CODED, not AI-generated.** Backbone-2 family — pulse-green dominant on a graphite panel.
Vision-pillar L96 ships the static icon set; L101 ships the animated motion variant.

## The mark

A hexagonal chevron stack — pulse-green `#3fb950` strokes on graphite `#0a0d12` panel — read as the
"share + flow + dispatch" rail of sharecli.

## Files

| File | Purpose |
|------|---------|
| `sharecli-icon.svg` | Source of truth — static, hand-coded vector |
| `sharecli-icon-animated.svg` | L101 motion variant — SMIL pulse + counter-rotating chevron (no JavaScript) |

## Regenerating

Static raster exports derive from the SVG via the repo's brand-export script.

## Motion variant (L101)

`sharecli-icon-animated.svg` ships a 4-second loop:

- Pulse-green `#3fb950` chevron arc breathes (stroke-opacity 0.6 → 1 → 0.6).
- Inner chevron group counter-rotates 360° per loop.
- Loop is seamless: last frame == first frame.

All animation is SVG-native SMIL — no JavaScript, no external CSS. Safe to inline in HTML, SVG
`<img src>`, README previews, and the sharecli tray icon (Electrobun).