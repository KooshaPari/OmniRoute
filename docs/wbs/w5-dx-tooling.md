# W5 — DX, Testing, Tooling

**Wave:** W5
**Priority:** P2
**Generated:** 2026-09-02

## W5.1 — Commitlint (P2)

**Why:** Without conventional commits, `release-drafter` and the changelog generator have to guess at version bumps. Manual errors compound.

**What:** Add `commitlint` with `@commitlint/config-conventional` and a `commit-msg` git hook that fails the commit if the message doesn't match the pattern.

**Files:** `.commitlintrc.cjs`, `package.json` (devDeps), `.husky/commit-msg`

**Acceptance:**
- [ ] `git commit -m "foo"` fails with a clear error
- [ ] `git commit -m "feat: add X"` passes
- [ ] Type-scope-body format enforced

**Verify:** `npm run commitlint`

---

## W5.2 — Husky Pre-Commit Hooks (P2)

**Why:** Catch lints, formatting, and broken tests before the commit, not in CI.

**What:** `husky` pre-commit hook that runs `lint-staged` (eslint + prettier) on staged files.

**Files:** `.husky/pre-commit`, `.lintstagedrc.cjs`

**Acceptance:**
- [ ] Modified file with bad formatting → commit fails with diff
- [ ] All-good file → commit succeeds in <2s
- [ ] Test file change → also runs `vitest run --related`

**Verify:** `touch bad.ts && git add bad.ts && git commit -m "test bad"`

---

## W5.3 — Prettier + ESLint Config (P2)

**Why:** Code review shouldn't be a style debate.

**What:** A shared prettier config (single-quote, semi, 100-char width) and a relaxed ESLint config (the project already has one; we just add missing rules + autoupdate).

**Files:** `.prettierrc.cjs`, `.eslintrc.cjs`, `package.json` (scripts: `format`, `lint:fix`)

**Acceptance:**
- [ ] `npm run format` rewrites the entire repo
- [ ] `npm run lint` exits 0 on `main`
- [ ] CI runs both and uploads the lint report as an artifact

**Verify:** `npm run format && git diff --stat | head -5`

---

## W5.4 — tsconfig Hardening (P2)

**Why:** Strict TypeScript catches bugs at compile time. The current config has several `noImplicitAny: false` exceptions.

**What:** Tighten `tsconfig.json`:
- `noUncheckedIndexedAccess: true`
- `noImplicitOverride: true`
- `exactOptionalPropertyTypes: true`
- `noFallthroughCasesInSwitch: true`

**Files:** `tsconfig.json`

**Acceptance:**
- [ ] `tsc --noEmit` exits 0 on main
- [ ] New code that violates any rule fails to build
- [ ] Number of new compile errors on `main` after the change: documented

**Verify:** `npm run typecheck`

---

## W5.5 — ARCHITECTURE.md (P2)

**Why:** New contributors (and your future self) need a 10-minute overview.

**What:** A single document with:
1. System diagram (mermaid)
2. Module boundaries
3. Data flow on a request
4. Where to find what

**Files:** `ARCHITECTURE.md`

**Acceptance:**
- [ ] New contributor can answer "where does the auth happen?" after 5 minutes
- [ ] Diagram renders correctly in GitHub
- [ ] No "TODO" sections

**Verify:** cat test → "where does auth happen?" → answer in <60s

---

## W5.6 — CONTRIBUTING.md (P2)

**Why:** Standardize the contribution process. Required for the W10 reputation campaign.

**What:** Step-by-step from `gh repo fork` to merged PR. Includes: testing locally, commit message format, PR template reference, CLA/CoC links.

**Files:** `CONTRIBUTING.md`

**Acceptance:**
- [ ] A new contributor can complete their first PR following only this doc
- [ ] Doc references the actual scripts (`bin/dev.sh`, `npm test`, etc.)

**Verify:** Ask a new contributor to follow it. Time them.

---

## W5.7 — Vitest Watch Mode Default (P3)

**Why:** Faster dev loop.

**What:** `npm test` → `vitest watch` in dev mode, `vitest run --reporter=verbose` in CI.

**Files:** `package.json` (scripts), `vitest.config.ts`

**Acceptance:**
- [ ] `npm test` reruns only affected tests on file save
- [ ] CI unchanged (still runs once, no watch)

**Verify:** `npm test` then edit a test file → re-runs
