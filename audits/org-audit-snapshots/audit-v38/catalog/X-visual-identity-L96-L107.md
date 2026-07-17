# L96–L107 — Visual Identity & Creative Polish (Cluster C10)

**Tier:** 2 (acceptance-contract pillar; a repo with a user-visible surface is NOT "done" until it scores here)
**Sources:** operator visual-identity directive (tasteful/creative/thematic/UNIQUE loading skeletons, custom/animated art, splash screens, icon sets); design-system practice (tokens, motion); Nielsen aesthetic-minimalist heuristic
**Cross-cuts:** L30.7 (visual acceptance criteria as agent-detectable gap), L81–L95 (accessibility of the visual surface), L108–L122 (installer/tray polish as distribution surface)

## Scope

Does the product carry a **tasteful, unique, thematic visual identity** — or does it look like an unstyled default? This category treats visual identity as a **first-class acceptance contract, not a bolt-on**. It is scored for any repo with a user-visible surface: web UI, desktop GUI, mobile screens, **and TUI/CLI** (a CLI has a visual identity too — its color scheme, banner, spinner, table styling, and output rhythm).

### The 3 Provenance Tiers (applies to every asset-producing sub-pillar)

Every visual asset (icon, splash, animation, skeleton, illustration) must have a declared **provenance tier**. A sub-pillar scores 3 only when its assets carry an explicit provenance declaration (e.g. in `docs/visual/PROVENANCE.md` or asset-adjacent metadata):

1. **Hand-authored** — designed/drawn/animated originally for this project (Figma export, hand-tuned SVG/Lottie, bespoke shader). Highest tier.
2. **Generated-and-curated** — AI/tool-generated (diffusion art, generated icon set, procedural motion) then human-reviewed, edited, and committed as a deliberate choice — NOT raw dumped. Declared as generated with the generation source noted.
3. **Sourced-with-license** — from an OSS/paid asset library (icon pack, Lottie library, stock illustration) with the license recorded and attribution satisfied.

A sub-pillar scores ≤1 if assets are undeclared, placeholder, framework-default, or license-unknown.

---

## Sub-Pillars

### L96 — Design Token System

**Name:** A single source of truth defines color, typography, spacing, radius, elevation, and motion tokens.

**Acceptance criterion:** A design-token file (`src/theme/tokens.ts`, `tailwind.config.ts`, `styles/tokens.css`, or a TUI `theme.rs`/`palette.rs`) defines named tokens for the palette, type scale, spacing scale, radii, and motion durations/easings. No hardcoded hex/ANSI/px scattered through components — components reference tokens.

**Evidence model:**
- Token file present: `ls src/theme/ styles/ src/**/palette.rs 2>/dev/null`
- `grep -rn "#[0-9a-fA-F]\{6\}" src/components/ | wc -l` is low (raw hex NOT scattered in components; target ≤5)
- Named token references dominate: `grep -rn "tokens\.\|theme\.\|Color::" src/ | wc -l` ≥ 10
- Type scale + spacing scale documented (not ad-hoc `14px`, `15px`, `17px` drift)

**Soft-optimizing goal:** Tokens exported to Figma (Figma Tokens / Style Dictionary); dark + light themes both derived from one token set; motion tokens (durations, springs) tokenized too.

---

### L97 — Typography System

**Name:** Intentional type: chosen faces, a clear hierarchy, and readable measure.

**Acceptance criterion:** A named font stack (not the browser/OS default) is loaded and applied; a type scale defines ≥4 distinct roles (display/heading/body/caption/mono); mono is used for technical/code UI per org convention; line-height and measure (max line length) are set for body text. For TUI: a deliberate box-drawing/typography style, aligned columns, and consistent glyph set.

**Evidence model:**
- Font loading present: `grep -rn "@font-face\|font-family\|next/font\|fontsource" src/`
- Type-scale tokens in the token file (≥4 roles)
- Body text has `line-height` + `max-width`/`measure` set (not full-bleed prose)
- Mono for code/technical elements: `grep -rn "mono" src/theme/`
- TUI: `grep -rn "Style::\|Modifier::\|border\|Rounded" src/` shows deliberate styling, not raw `println!`

**Soft-optimizing goal:** Variable fonts with weight axes; fluid type scale (clamp); `font-display: swap`; a documented typographic rationale in `docs/visual/`.

---

### L98 — Icon Set

**Name:** A cohesive, provenance-declared icon set — not mixed random glyphs.

**Acceptance criterion:** Icons come from ONE cohesive set (single stroke weight, grid, style) OR a hand-authored set; provenance tier is declared; there is a real app icon / favicon / `.iconset` (not a framework placeholder). For a desktop app: a committed `.iconset`/`.icns`/`.ico` with all required sizes. For CLI/tray: a tray/menubar icon asset exists.

**Evidence model:**
- Icon assets present: `find . -path ./node_modules -prune -o \( -name '*.icns' -o -name '*.ico' -o -name 'AppIcon.iconset' -o -name 'icons' -type d \) -print`
- Provenance declared: `ls docs/visual/PROVENANCE.md` or asset-adjacent license/source note
- Single icon system (not mixed lucide+fontawesome+emoji): `grep -rn "lucide\|heroicons\|@tabler\|feather\|phosphor" package.json` shows ONE
- Desktop `.iconset` has full size ladder (16→1024 incl @2x) — see [[feedback_electrobun_codesign_noop_build]] real-iconset requirement

**Soft-optimizing goal:** Custom-drawn brand mark; animated icon on hover/state; icon set exported as a sprite/font for perf; monochrome + color variants.

---

### L99 — Loading & Skeleton States

**Name:** Thematic, tasteful loading/skeleton states — not a bare spinner or blank screen.

**Acceptance criterion:** Every async view has a designed loading state: content-shaped skeletons (matching the real layout) for data views, a branded spinner/progress for actions, and NO layout shift when content arrives. For TUI/CLI: a styled progress bar / spinner with a themed glyph set and a meaningful status line (not a frozen terminal). Skeletons are thematic (carry the brand's motion/shape language), not generic gray boxes.

**Evidence model:**
- Skeleton components exist: `grep -rn "[Ss]keleton\|shimmer\|placeholder" src/`
- Loading states per async boundary: `grep -rn "isLoading\|Suspense\|loading" src/ | wc -l` ≥ number of data views
- No CLS: content-shaped skeletons match final layout (dimensions reserved)
- TUI: `grep -rn "indicatif\|Spinner\|ProgressBar\|Gauge" src/` (Rust) or equivalent
- Thematic: skeletons use token colors + motion, not default gray

**Soft-optimizing goal:** Skeletons animate with the brand's signature easing; progressive/streaming reveal; skeleton generated from the real component (no drift); a unique "loading personality" (themed messages, mascot).

---

### L100 — Empty & Zero-Data States

**Name:** Designed empty states that guide the user — not a blank void.

**Acceptance criterion:** Every list/collection/dashboard view has a designed empty state: an illustration or icon, a one-line explanation, and a primary call-to-action ("Add your first X"). First-run empty state differs from filtered-to-zero empty state. For CLI: a helpful "no results / get started" message with a suggested next command, not silent exit.

**Evidence model:**
- Empty-state components/branches: `grep -rn "[Ee]mpty\|no.*results\|NoData\|zero.*state" src/`
- Empty state has CTA + copy (not just "No data")
- First-run vs filtered-empty distinguished
- CLI: `grep -rn "no results\|nothing to\|get started\|try:" src/` — actionable empty output

**Soft-optimizing goal:** Bespoke empty-state illustrations (provenance-declared); empty states A/B-considered for activation; onboarding-linked empty states.

---

### L101 — Error & Failure State Design

**Name:** Errors are visually designed and human — not raw stack traces or red walls.

**Acceptance criterion:** User-facing errors have a designed presentation: a clear icon/illustration, plain-language cause, and a recovery action ("Retry" / "Go back" / link to help). No raw stack traces or framework error overlays reach the end user in production. For CLI: errors are formatted (color-coded, structured), state the cause, and suggest a fix — cross-refs L30.6 friction detection.

**Evidence model:**
- Error-boundary / error-view components: `grep -rn "ErrorBoundary\|error.*state\|<Error" src/`
- Error copy is actionable (has hint/help/action), not just the exception message
- No raw trace in prod: `grep -rn "err\.stack\|traceback\|panic.*user" src/` guarded behind dev-only
- CLI: errors go through a formatter with color + hint (not bare `eprintln!("{e}")`)

**Soft-optimizing goal:** Error illustrations per error class; `docs_url` per error; snapshot tests on error views; toast/inline severity system.

---

### L102 — Motion & Animation System

**Name:** Purposeful, consistent motion — transitions, micro-interactions, and feedback — tuned to a signature feel.

**Acceptance criterion:** Motion is tokenized (durations, easings/springs) and applied consistently: view/route transitions, hover/press feedback, enter/exit animations for lists and modals. Motion respects `prefers-reduced-motion`. Nothing janky (60fps target). For TUI: deliberate transitions (fade/slide in ratatui/bubbletea) where they aid comprehension, not gratuitous.

**Evidence model:**
- Motion tokens in the token file (durations + easings/springs)
- Animation library or CSS transitions used consistently: `grep -rn "framer-motion\|motion\.\|@keyframes\|transition\|useSpring\|animate" src/`
- `prefers-reduced-motion` honored: `grep -rn "prefers-reduced-motion\|reduce.*motion\|reducedMotion" src/`
- 60fps: transforms/opacity (GPU) not layout-thrashing top/left/width animations

**Soft-optimizing goal:** A signature motion identity (recognizable easing/choreography); scroll-driven or spring-physics reveals; shared-element transitions; motion documented in `docs/visual/motion.md`.

---

### L103 — Splash / Launch Experience

**Name:** A branded splash / launch / first-frame — not a white flash or blank window.

**Acceptance criterion:** The app has a designed first frame: desktop app shows a branded splash/launch window (not a blank OS window) while initializing; web app has no unstyled flash-of-content and a branded initial paint; CLI has a tasteful banner/logo on `--help` or startup (ASCII/figlet art or styled header), provenance-declared. Splash assets carry a provenance tier.

**Evidence model:**
- Desktop: splash asset + window config: `grep -rn "splash\|launch.*screen\|SplashScreen" src/` + electrobun/tauri window config
- Web: no FOUC — critical CSS inlined / theme applied before paint: `grep -rn "critical\|inline.*css\|theme.*script" src/`
- CLI: startup banner: `grep -rn "figlet\|banner\|ascii\|BANNER\|logo" src/`
- Splash provenance declared in `docs/visual/PROVENANCE.md`

**Soft-optimizing goal:** Animated splash (Lottie/shader); splash transitions seamlessly into first real view; seasonal/themed splash variants; splash doubles as a loading-progress surface.

---

### L104 — Theming (Dark / Light / Brand)

**Name:** Complete, consistent theming across at least dark + light, brand-first.

**Acceptance criterion:** Dark and light themes are both fully supported (org convention: dark-first, light secondary), derived from the token set, with no broken/unthemed surfaces in either. Theme switch is instant and persisted. Every component reads theme tokens (no theme-blind hardcoded colors). For TUI: a theme/palette that adapts to terminal background or offers a `--theme` flag.

**Evidence model:**
- Theme definitions for dark + light: `grep -rn "dark\|light\|theme" src/theme/`
- Theme provider/switch: `grep -rn "ThemeProvider\|useTheme\|data-theme\|color-scheme" src/`
- Persistence: `grep -rn "localStorage.*theme\|theme.*persist\|prefers-color-scheme" src/`
- No unthemed surfaces: spot-check both themes render (screenshot test if present)

**Soft-optimizing goal:** System-follow + manual override; high-contrast theme; per-user accent color; theme tokens shared with the marketing site/docs.

---

### L105 — Visual Consistency & Brand Cohesion

**Name:** The surface reads as ONE product — consistent components, spacing rhythm, and voice.

**Acceptance criterion:** Repeated UI patterns (buttons, cards, inputs, modals) are componentized and consistent (not visually drifting copies); spacing follows the scale (no `13px`/`17px`/`19px` drift); the same visual voice runs across all views. A `docs/visual/` or design-system reference documents the intended look. Cross-refs L81 (AX consistency heuristic).

**Evidence model:**
- Shared component library: `ls src/components/ui/ src/design-system/ 2>/dev/null`
- Low style drift: `grep -rEn "[0-9]+px" src/ | grep -vE "(0|2|4|8|12|16|24|32|48|64)px" | wc -l` is low (off-scale values rare)
- One button/input implementation reused (not N ad-hoc copies)
- `docs/visual/` design reference present

**Soft-optimizing goal:** Storybook / component gallery published; visual-regression tests (Chromatic/Playwright screenshots) block drift; a brand guideline doc.

---

### L106 — Signature / Unique Identity Element

**Name:** At least one distinctive, memorable, UNIQUE identity element — the anti-generic pillar.

**Acceptance criterion:** The product has ≥1 deliberately unique, tasteful signature that makes it NOT look like a template: a bespoke mascot/logo, a signature animation, a distinctive layout motif, a unique color story, a memorable empty-state character, or a themed TUI personality. This is the operator's "tasteful/creative/thematic/UNIQUE" bar — a repo scoring 3 here has an identity a user would recognize. Provenance-declared.

**Evidence model:**
- A named signature element documented in `docs/visual/IDENTITY.md` (what makes this product visually unique)
- The element is implemented (asset/animation/motif present in `src/`), not just described
- Provenance tier declared
- Not framework-default: does not read as unstyled shadcn/bootstrap/default-ratatui

**Soft-optimizing goal:** The identity element is animated/interactive; it appears across surfaces (app + docs + installer + social card); users reference it; it has a name.

---

### L107 — Visual Spec & Golden Tests

**Name:** Visual identity is specified and regression-guarded, so an agent can DETECT polish gaps (not just crashes).

**Acceptance criterion:** A `VISUAL_SPEC.md` or `docs/visual/` documents palette, typography, empty/loading/error states, and per-major-view reference (screenshot/Figma link); visual-regression or golden-output tests exist (Playwright/Chromatic screenshots for GUI; `tests/golden/*.txt`/`*.snap` for CLI/TUI) so a regression is caught in CI. This closes the L30.7 loop: the repo ships the criteria an autonomous agent uses to detect visual/creative polish gaps. Provenance table (`docs/visual/PROVENANCE.md`) lists every asset's tier.

**Evidence model:**
- `VISUAL_SPEC.md` or `docs/visual/` with ≥5 sections
- Reference assets/links per major view: `find docs/visual -name '*.png' -o -name '*.svg'` or Figma URLs
- Golden/visual-regression tests: `ls tests/golden/ tests/visual/ 2>/dev/null` or Chromatic/Playwright screenshot config
- `docs/visual/PROVENANCE.md` present, mapping each asset → tier (1/2/3) + source/license

**Soft-optimizing goal:** Visual-regression gates merge; golden tests cover all major views/commands; spec auto-linked from `AGENTS.md` so agents find it; quarterly visual review logged in `CHANGELOG.md`.
