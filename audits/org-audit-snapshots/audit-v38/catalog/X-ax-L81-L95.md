# L81–L95 — Accessibility & UX (Cluster C09)

**Tier:** 2 (product-facing; required for any repo with a user-visible surface)
**Sources:** WCAG 2.2 (W3C Recommendation, Oct 2023), Nielsen 10 Usability Heuristics (NN Group, 1994+)
**Cross-cuts:** L6 (error handling as UX surface), L7 (API ergonomics), L30.6 (user-story gap detection), L30.7 (visual acceptance criteria), L96–L107 (visual identity)

## Scope

Does the product surface respect users' access needs, cognitive models, and interaction expectations? This category covers:

- **Dev-AX:** accessibility of developer-facing surfaces (CLI output, TUI, API error messages, documentation)
- **End-user-AX:** accessibility of end-user-facing surfaces (web UI, desktop GUI, mobile screens, in-app help)

Repos with no user-facing surface (pure libraries / pure backend APIs) score pillars in context: a library's accessibility is its API ergonomics, doc clarity, and error messaging quality. Mark `NOT_APPLICABLE` only for automation-only daemons with zero human interaction surface.

---

## Sub-Pillars

### L81.1 — WCAG 2.2 Level A Baseline

**Name:** All user-facing views meet WCAG 2.2 Level A minimum compliance.

**Acceptance criterion:** Automated axe-core or WAVE scan on every page/view/screen returns zero Level A violations. Color contrast ≥ 3:1 for large text, ≥ 4.5:1 for normal text (per WCAG 1.4.3). All images have `alt` text or explicit `aria-hidden="true"`. All interactive elements are reachable via keyboard tab order.

**Evidence model:**
- `package.json` or `Taskfile.yml` contains an `a11y` or `axe` scan target: `grep -rn "axe\|wave\|a11y" Taskfile.yml package.json`
- CI job output shows axe-core run with zero Level A violations: `.github/workflows/*.yml` with `axe-core` or `playwright-axe` step
- `tests/a11y/` or `tests/accessibility/` directory present with ≥1 automated scan spec
- For CLI repos: `grep -rn "color_off\|NO_COLOR\|TERM=dumb" src/` — ensures color output degrades cleanly for non-color terminals
- `README.md` or `docs/accessibility.md` states compliance level

**Soft-optimizing goal:** Zero Level A violations enforced in CI; all Level AA violations tracked in `docs/a11y-backlog.md`; automated scan runs on every PR.

---

### L81.2 — WCAG 2.2 Level AA Color Contrast

**Name:** All text/background combinations in the UI meet WCAG 2.2 AA color contrast ratios.

**Acceptance criterion:** Normal text ≥ 4.5:1 contrast ratio, large text ≥ 3:1, UI components / graphical objects ≥ 3:1 (WCAG 1.4.3, 1.4.11). Contrast ratios are documented in the design token file or design system. Automated contrast check is wired to CI.

**Evidence model:**
- Design token file (e.g. `src/theme/tokens.ts`, `tailwind.config.ts`, `styles/variables.css`) with documented color values
- `grep -rn "contrast\|4\.5\|3:1" src/` returns ≥1 result indicating contrast awareness
- `package.json` contains `@axe-core/react`, `@radix-ui`, or equivalent component library with built-in contrast enforcement
- CI step output from `jest-axe`, `vitest-axe`, or Playwright accessibility check confirms no 1.4.3 violations
- For TUI/CLI: color palette in `src/` uses named constants, not hardcoded ANSI codes: `grep -rn "Color::" src/ | wc -l` ≥ 5

**Soft-optimizing goal:** Design tokens enforce contrast at definition time (Figma token linting); `storybook-addon-a11y` blocks storybook build on contrast failures; contrast ratios documented per component.

---

### L81.3 — Keyboard Navigation & Focus Management

**Name:** All interactive functionality is fully operable via keyboard alone, with a visible and logical focus indicator.

**Acceptance criterion:** Every interactive element (buttons, links, inputs, modals, dropdowns) is reachable and operable via Tab/Shift-Tab/Enter/Space/Arrow keys without a mouse. Focus is never trapped unintentionally outside modal/dialog. Focus returns to the trigger element when a modal closes. Focus indicator is visible (WCAG 2.4.11 Focus Appearance AA: ≥2px outline, ≥3:1 contrast).

**Evidence model:**
- `tests/a11y/keyboard-nav.spec.ts` or equivalent keyboard-navigation test file present
- No `tabIndex="-1"` or `outline: none` without explicit `focus-visible` override: `grep -rn "outline.*none\|tabindex.*-1" src/ | grep -v "focus-visible"`
- For Radix/Headless UI components: `grep -rn "@radix-ui/react-dialog\|FocusTrap\|focus-trap" package.json src/` confirms focus-trapping library in use
- Playwright test that cycles Tab through all interactive elements of the primary view: `tests/e2e/keyboard.spec.ts`
- For TUI: `grep -rn "KeyCode\|handle_key\|KeyEvent" src/` — keyboard event handling for all interactive TUI widgets

**Soft-optimizing goal:** Axe `keyboard` rule passes on every view; Playwright keyboard-nav test suite runs in CI; focus-visible polyfill included for legacy browser support; TUI widgets all named and keyboard-addressed.

---

### L81.4 — Screen-Reader Compatibility

**Name:** All content and interactive controls are comprehensible and operable via a screen reader (NVDA, JAWS, VoiceOver, Orca).

**Acceptance criterion:** All images have non-empty `alt` text or `aria-hidden="true"`. All form inputs have an associated `<label>` or `aria-label`. All icon-only buttons have `aria-label`. Live regions (`aria-live`) announce dynamic content updates. Decorative SVGs use `aria-hidden="true"`. For CLI/TUI: semantic output is line-structured; machine-readable JSON/structured output mode available.

**Evidence model:**
- `grep -rn "aria-label\|aria-labelledby\|aria-describedby" src/` returns ≥5 results (indicates ARIA usage)
- No `<img>` without `alt`: `grep -rn "<img " src/ | grep -v 'alt='` returns 0 results
- No icon-only `<button>` without `aria-label`: `grep -rn "<button" src/ | grep -v "aria-label\|aria-labelledby\|<span\|children"` returns 0 problematic hits
- For CLI repos: `--json` or `--output=json` flag documented in `--help` output; `grep -rn "\-\-json\|\-\-output" src/`
- `docs/accessibility.md` or `README.md` references screen-reader testing procedure

**Soft-optimizing goal:** VoiceOver and NVDA manual-test checklist completed per release; `jest-axe` `toHaveNoViolations()` on every component test; CLI `--json` mode tested via golden-output tests.

---

### L81.5 — ARIA Correctness & Landmark Structure

**Name:** ARIA roles, landmarks, and attributes are used correctly — not as cosmetic decoration.

**Acceptance criterion:** Main page regions use semantic landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`, `role="banner"`, `role="contentinfo"`). No `role` attribute that misuses semantics (e.g. `role="button"` on a div when a `<button>` suffices). No orphaned `aria-labelledby` pointing to a non-existent `id`. All `aria-expanded`, `aria-selected`, `aria-checked` values are dynamically updated when state changes.

**Evidence model:**
- `grep -rn "role=\"button\"\|role=\"link\"" src/` returns 0 results (use native elements instead)
- `grep -rn "aria-labelledby" src/` — verify each referenced ID exists in same component
- Axe rule `aria-required-attr` and `aria-valid-attr-value` pass in CI output
- Component test using `@testing-library/react` `getByRole` verifies ARIA roles are discoverable: `grep -rn "getByRole\|findByRole" src/ tests/`
- For Dioxus/Tauri desktop: accessibility tree verified via `cargo test -- accessibility` or `AT-SPI` checks on Linux

**Soft-optimizing goal:** ARIA linting via `eslint-plugin-jsx-a11y` with all rules enabled; zero `aria-*` misuse; semantic landmark audit automated in Playwright.

---

### L81.6 — Error Prevention & Recovery (Nielsen H5, H9)

**Name:** The UI prevents errors where possible, and guides users to recovery when errors occur.

**Acceptance criterion:** Destructive actions require confirmation (WCAG 3.3.4; Nielsen H3 user control). Error messages are written in plain language (not internal error codes), identify what went wrong, and suggest a corrective action. Input validation happens before submission, not only after. All form errors are associated with the specific input that caused them (WCAG 3.3.1 Error Identification).

**Evidence model:**
- Error message structs include a `help` or `hint` field: `grep -rn "\.hint\|\.help\|\.suggestion\|User::hint" src/` returns ≥3 results
- No error message that is only a raw code or enum name: `grep -rn "\"Error:\"\|\"Err:\"\|\"error:\"" src/ | head -5` — check messages are human-readable sentences
- Confirmation dialog before destructive actions: `grep -rn "confirm\|dialog\|modal" src/ | grep -i "delete\|remove\|drop\|reset"` returns ≥1 hit
- WCAG 3.3.1: `grep -rn "aria-describedby\|aria-errormessage\|setCustomValidity" src/` returns ≥1 result
- `docs/user_journeys/` or `tests/e2e/` includes an error-recovery scenario

**Soft-optimizing goal:** Snapshot tests for every error message; error-message quality gate in CI (readability score ≥ 60 Flesch-Kincaid); all error codes documented in a public errors reference.

---

### L81.7 — System Status Visibility (Nielsen H1)

**Name:** The system always informs users about what is happening, with appropriate feedback within a reasonable time.

**Acceptance criterion:** Operations taking >1s display a loading indicator. Operations taking >10s display a progress indicator with estimated time or step count. Background operations (sync, compile, fetch) have visible status. For CLI: long operations emit progress to stderr or use a progress bar library. No "silent work" — every user-initiated action acknowledges receipt within 100ms.

**Evidence model:**
- Loading/spinner component present: `grep -rn "Spinner\|Skeleton\|Loading\|progress" src/ | grep -v "test\|spec" | wc -l` ≥ 3
- For CLI repos: `grep -rn "indicatif\|pbr\|ProgressBar\|Spinner\|spinner" Cargo.toml pyproject.toml package.json` — progress library in deps
- `grep -rn "aria-busy\|aria-live.*polite\|role.*status" src/` — live region for async status announcements
- E2E test that asserts loading state is visible during async operation: `grep -rn "loading\|spinner\|busy" tests/e2e/`
- CLI `--verbose` or `--progress` flag documented and tested: `grep -rn "\-\-verbose\|\-\-progress" src/ tests/`

**Soft-optimizing goal:** All async operations expose a cancellation mechanism; loading states tested for screen-reader announcement via `aria-live`; CLI uses `indicatif` with ETA display for long-running operations.

---

### L81.8 — Consistency & Standards (Nielsen H4)

**Name:** The interface follows platform conventions and is internally consistent in terminology, layout, and interaction patterns.

**Acceptance criterion:** All like elements use the same component (no one-off button implementations); terminology is consistent (no "delete" in one place and "remove" in another for the same action); keyboard shortcuts match platform conventions (Cmd+S on macOS, Ctrl+S on Windows); TUI uses consistent keybinding patterns across screens. A design system or component library is the single source for all UI elements.

**Evidence model:**
- Single component library import: `grep -rn "from '@radix-ui\|from 'shadcn\|from '@headlessui\|from 'dioxus" src/ | wc -l` ≥ 10 (consistent use)
- No ad-hoc native `<button>` or `<input>` outside the design system wrapper: `grep -rn "<button\b\|<input\b" src/ | grep -v "component\|Button\|Input" | wc -l` — should be ≤ 2
- Terminology consistency: `grep -rn "\"delete\"\|\"remove\"\|\"Delete\"\|\"Remove\"" src/` — check both words are not used interchangeably for the same concept
- `docs/design-system.md` or `src/components/README.md` defines allowed components
- For TUI: keybinding table defined in `src/config/keybindings.rs` or equivalent and rendered in a help overlay

**Soft-optimizing goal:** Component library Storybook deployed and referenced in AGENTS.md; `eslint-plugin-react`/clippy rules catch raw native element use; UX copy reviewed by a non-engineer for terminology consistency.

---

### L81.9 — User Control & Emergency Exits (Nielsen H3)

**Name:** Users can always undo, cancel, or escape out of any state without data loss.

**Acceptance criterion:** Every multi-step form or wizard has a "Back" and "Cancel" button. Every destructive action has an undo mechanism (trash/archive with restore, or confirmation before permanent delete). CLI commands that take >5s support Ctrl+C with a clean shutdown that does not corrupt partial state. Modal dialogs close on Escape key.

**Evidence model:**
- `grep -rn "Escape\|escape\|esc_key\|KeyCode::Esc" src/` returns ≥1 result for dialog/modal close handlers
- `grep -rn "SIGINT\|ctrl_c\|Ctrl+C\|signal::ctrl_c" src/` — CLI handles cancellation gracefully
- Undo/restore mechanism: `grep -rn "undo\|restore\|archive\|trash" src/ | grep -v test | wc -l` ≥ 1
- E2E test that presses Escape in a modal and asserts dismissal: `grep -rn "Escape\|dismiss\|close" tests/e2e/`
- No destructive operation without confirmation: `grep -rn "\.delete\|\.drop\|\.truncate\|\.remove" src/ | grep -v "test\|spec"` — all have guard checks

**Soft-optimizing goal:** All state changes fully undoable (command-pattern architecture); CLI operations emit a rollback manifest on Ctrl+C; browser history reflects app navigation state (pushState).

---

### L81.10 — Inclusive Language & Cognitive Accessibility

**Name:** All user-visible text uses inclusive, plain language accessible to non-expert users.

**Acceptance criterion:** No ableist language (e.g. "blindly", "crippled", "dumb terminal" without a recognized technical term exemption) in user-visible strings. Reading level of user-facing help text ≤ 8th grade Flesch-Kincaid. Error messages avoid jargon. Labels and placeholders are plain nouns/verbs, not abbreviated codes. For CLI: `--help` output is formatted, structured, and uses consistent option naming.

**Evidence model:**
- `grep -rn "blindly\|cripple\|dumb\|idiot\|stupid" src/ | grep -v "#\|//.*technical" | wc -l` returns 0 for user-visible strings
- `--help` output tested via golden snapshot: `tests/golden/help.txt` present
- `grep -rn "HELP\|help_text\|description:" src/ | wc -l` ≥ 5 — indicates help strings are populated
- `docs/style-guide.md` or `.vale.ini` present with inclusive-language rule configuration
- For web: reading level check via `scripts/readability-check.ts` or equivalent

**Soft-optimizing goal:** Vale linting with inclusive-language ruleset (`vale.sh/packages/Microsoft`) enabled in CI; Flesch-Kincaid score ≥60 for all user-visible strings; UX copy reviewed quarterly.

---

### L81.11 — Responsive & Adaptive Layout

**Name:** The UI renders correctly across the supported viewport/terminal size range without loss of content or function.

**Acceptance criterion:** For web UI: responsive breakpoints tested at mobile (375px), tablet (768px), and desktop (1280px) widths; no horizontal scrollbar at any breakpoint; touch targets ≥ 44×44px (WCAG 2.5.5). For TUI/CLI: output wraps or truncates gracefully at 80-column terminals; works at 40-column minimum. For desktop: window resize does not break layout or lose data.

**Evidence model:**
- Playwright responsive test: `grep -rn "375\|768\|1280\|viewport\|mobile" tests/e2e/` returns ≥1 test with viewport configuration
- For TUI: `grep -rn "terminal_size\|crossterm::terminal::size\|get_size" src/` — terminal size is queried and respected
- CSS: `grep -rn "@media\|min-width\|max-width\|sm:\|md:\|lg:" src/ | wc -l` ≥ 10 for web repos
- Touch target size: no interactive element with `width: < 44px` or `height: < 44px` in CSS (automated via axe `target-size` rule)
- `docs/browser-support.md` or `README.md` states supported viewport/terminal range

**Soft-optimizing goal:** Storybook viewport addon shows all breakpoints; TUI renders a `COLUMNS`-adaptive layout; web has a dedicated mobile smoke test in CI.

---

### L81.12 — Recognition Over Recall (Nielsen H6)

**Name:** The UI makes options, actions, and objects visible — users are not required to remember information from one step to the next.

**Acceptance criterion:** Navigation menus are persistent or discoverable without memorizing paths. Form fields show current values when editing (not blank). Wizards show a breadcrumb or step indicator. CLI: subcommands listed in `--help`; recent commands visible in history or `--list` output. Error messages repeat the invalid input value.

**Evidence model:**
- Breadcrumb or step-indicator component in multi-step flows: `grep -rn "Breadcrumb\|Stepper\|Steps\|step_indicator" src/`
- Form edit mode pre-fills current values: `grep -rn "defaultValue\|initialValues\|value={current\|defaultValues" src/ | wc -l` ≥ 3
- CLI: `--list` or `--history` subcommand: `grep -rn "list\|history" src/main.rs src/cli.rs src/commands/`
- User journey test that navigates away and returns, asserting state is preserved: `grep -rn "navigate back\|go back\|history" tests/e2e/`
- Context panel or sidebar persists selection across views: `grep -rn "selectedItem\|currentItem\|selectedId" src/store/ src/state/`

**Soft-optimizing goal:** All form edit states pre-filled; history/recent-items panel in complex UIs; CLI `--list` tested via golden snapshot; wizard step count and current step in `aria-label`.

---

### L81.13 — Help & Documentation Accessibility (Nielsen H10)

**Name:** Help content is discoverable, contextual, and written for the actual user — not the implementer.

**Acceptance criterion:** Every major feature/view has a contextual help link, tooltip, or inline explanation. `--help` for CLI is complete (all flags documented). `docs/` or in-app help covers the top-3 user journeys end-to-end. Help content does not require reading source code to understand the feature. A `CONTRIBUTING.md` or `docs/faq.md` covers the top-5 user questions.

**Evidence model:**
- `grep -rn "tooltip\|Tooltip\|aria-describedby.*help\|HelpText" src/ | wc -l` ≥ 3 (contextual help in UI)
- `docs/` directory with ≥3 user-facing guide files: `ls docs/guides/ | wc -l` ≥ 3
- CLI `--help` golden test: `tests/golden/help.txt` or `tests/cli/help.snap`
- `docs/faq.md` or `README.md` FAQ section present: `grep -rn "FAQ\|Frequently Asked\|Common questions" README.md docs/`
- `CONTRIBUTING.md` exists and is non-stub (`wc -l CONTRIBUTING.md` ≥ 30)

**Soft-optimizing goal:** In-app contextual help pane for desktop apps; CLI man page generated via `clap_mangen` or equivalent; docs site with search (VitePress/MkDocs); help content reviewed quarterly for accuracy.

---

### L81.14 — Flexibility & Efficiency (Nielsen H7)

**Name:** Power users can complete tasks faster via shortcuts, aliases, and accelerators, without degrading the novice experience.

**Acceptance criterion:** Web/desktop UI: keyboard shortcuts documented and discoverable (keyboard shortcut overlay via `?` or `Cmd+K`). CLI: command aliases and tab-completion supported. API: a batch endpoint or bulk-operation mode exists alongside the single-item endpoint. TUI: vim-style keybindings or configurable keybindings supported.

**Evidence model:**
- Keyboard shortcut map: `grep -rn "keyboard-shortcuts\|hotkeys\|useHotkeys\|KeyboardShortcuts" src/ docs/` returns ≥1 hit
- CLI tab-completion: `grep -rn "completion\|generate_completion\|clap_complete\|argcomplete\|completions" src/ Cargo.toml pyproject.toml`
- Batch/bulk API endpoint: `grep -rn "batch\|bulk\|/batch\|/bulk" src/ | grep -v test | wc -l` ≥ 1 for service repos
- TUI keybinding config file: `grep -rn "keybindings\|keymap\|bindings" src/config/ src/settings/`
- `README.md` or `docs/shortcuts.md` documents keyboard shortcuts

**Soft-optimizing goal:** Keyboard shortcut palette (Cmd+K command palette) in web apps; CLI shell completions for bash/zsh/fish generated and tested; API batch endpoint has a load test.

---

### L81.15 — Aesthetic & Minimalist Design (Nielsen H8)

**Name:** Every piece of information and every UI element present has a clear purpose — no decorative clutter that obscures primary functions.

**Acceptance criterion:** Primary actions are visually prominent (sufficient contrast, size, position). Secondary and tertiary actions are visually de-emphasized. Error and warning states are color-coded AND use an icon or text label (not color alone, per WCAG 1.4.1). No information overload on primary views — complex data is progressively disclosed or paginated. CLI output has a structured, scannable format with aligned columns.

**Evidence model:**
- Primary CTA uses a `primary` / `brand` color variant and is not mixed with secondary actions: `grep -rn "Button.*variant.*primary\|btn-primary" src/ | wc -l` ≥ 3
- WCAG 1.4.1 — error states are not color-only: `grep -rn "ErrorIcon\|error.*icon\|aria-invalid\|role.*alert" src/ | wc -l` ≥ 2
- Progressive disclosure: `grep -rn "Accordion\|Collapsible\|expand\|collapse\|showMore\|Show more" src/ | wc -l` ≥ 1
- CLI output: `grep -rn "Table\|tabulate\|comfy_table\|prettytable\|tabled\|cli-table" Cargo.toml pyproject.toml package.json` — tabular output library in use
- No `TODO: remove` or `DEBUG` strings in user-visible output: `grep -rn "TODO.*remove\|DEBUG\b" src/ | grep -v "//\|#" | wc -l` returns 0

**Soft-optimizing goal:** Design audit quarterly (screenshot comparison); CLI output tested for column alignment via golden snapshots; information architecture reviewed with a first-time user per release.
