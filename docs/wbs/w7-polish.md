# W7 — Polish, UX, Documentation

**Wave:** W7
**Priority:** P3
**Generated:** 2026-09-02

## W7.1 — Admin UI Design Tokens (P3)

**Why:** The admin UI looks inconsistent — ad-hoc colors and spacing throughout.

**What:** A design token system (CSS custom properties + a `tokens.json`) that covers: colors, spacing scale, typography, border-radius, shadow, motion. Generated from the existing design decisions and applied to the admin UI.

**Files:** `src/admin/tokens.css`, `src/admin/tokens.json`, `src/admin/components/*`

**Acceptance:**
- [ ] Every color reference in the admin UI is a CSS variable
- [ ] `tokens.json` is the single source of truth
- [ ] A token rename takes <5 minutes

**Verify:** Grep for hex colors in `src/admin/` — should be 0.

---

## W7.2 — Dark Mode (P3)

**Why:** Most users expect dark mode.

**What:** Toggle in the admin UI (stored in `localStorage`) that applies a `dark` class to the root and overrides the color tokens. System preference detected on first load.

**Files:** `src/admin/theme.ts`, `src/admin/tokens.css`

**Acceptance:**
- [ ] `prefers-color-scheme: dark` respected on first load
- [ ] Toggle persists across page reloads
- [ ] Toggle respects system changes mid-session

**Verify:** DevTools → Rendering → Emulate CSS media feature prefers-color-scheme

---

## W7.3 — OpenAPI Reference (P3)

**Why:** Developers want to explore the API in Swagger UI before writing code.

**What:** An OpenAPI 3.1 spec covering all `/v1/chat/completions`, `/v1/embeddings`, `/models`, `/healthz`, and admin endpoints. Served at `/docs`.

**Files:** `src/server/routes/docs.ts`, `openapi.yaml`

**Acceptance:**
- [ ] `curl localhost:3000/docs` returns Swagger UI
- [ ] "Try it out" works for /v1/chat/completions with a valid key
- [ ] Spec validates against the OpenAPI 3.1 schema

**Verify:** `npx swagger-cli validate openapi.yaml`

---

## W7.4 — API Quick-Start Guide (P3)

**Why:** README is good for contributors but not for API consumers.

**What:** A quick-start guide covering: obtain an API key → make your first request → streaming → error handling → rate limits.

**Files:** `docs/QUICKSTART.md`

**Acceptance:**
- [ ] A developer with zero context can complete the full flow in 5 minutes
- [ ] Includes a `curl` example and a Python example

**Verify:** Read it fresh — if you have questions, it's not done.

---

## W7.5 — README Refresh (P3)

**Why:** The current README has AI slop and outdated badges.

**What:**
1. Rewrite the tagline and one-liner
2. Replace slop with real content
3. Add a proper comparison table vs. OpenAI proxy
4. Add a "Who uses this?" section with GitHub stars
5. Fix the installation instructions

**Files:** `README.md`

**Acceptance:**
- [ ] No template-generated content
- [ ] Stars badge points to the right repo
- [ ] Installation works on a clean Ubuntu 22.04 box in <5 min
- [ ] "Who uses this?" has at least 3 real companies

**Verify:** `gh repo view kooshapari/OmniRoute` → README tab
