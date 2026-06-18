# HeliosLab — `Taskfile.yml` Cargo→Bun/npm Conversion Plan (CE-08)

**Task ID:** arc-2-17 / CE-08 Taskfile-fix-successor
**Working dir (read-only):** `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosLab`
**Deliverable (this file):** Conversion **plan** — no edits applied to `HeliosLab/Taskfile.yml`. The apply step is **gated on user approval** (this is a successor-repo change).
**Companion frozen archive (untouched, preserved):** `/tmp/phenotype-colab-extensions/src/Taskfile.yml`
**Generated:** 2026-06-12 (re-issued 2026-06-14 after transient `/tmp` cleanup)
**Author:** Forge (read-only audit)

---

## 1. Scope & Method

1. Read `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosLab/Taskfile.yml` (39 lines, 7 tasks — `lint`, `test`, `quality`, `build`, `fmt`, `clean`, `check`).
2. Verify byte-identity with the frozen archive's `src/Taskfile.yml` (per `PRESERVATION_POLICY.md` §1.1 the archive is immutable).
3. Enumerate every `cargo *` command-line invocation in the file and map it to its bun/npm equivalent grounded in the actual on-disk toolchain (`package.json`, `bun.lock`, `biome.json`, `tsconfig.json`, `webflow-plugin/`, `test-plugin/`, `docs/`).
4. Cite the bug provenance from the original audit and the archive's `STATUS.md`.
5. Produce this plan (no apply). Apply is gated.

**Read-only verification, no edits to `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosLab/`.**

---

## 2. Bug provenance (citations)

| Source | Line(s) | Quote |
|--------|---------|-------|
| `/tmp/audit_phenotype_colab_extensions.md` | 86 | "But the actual `src/Taskfile.yml:1-39` defines **only Rust/cargo** tasks" |
| `/tmp/audit_phenotype_colab_extensions.md` | 88–96 | Gap table listing every `cargo *` task as "Wrong toolchain" |
| `/tmp/audit_phenotype_colab_extensions.md` | 101 | "Severity: The Taskfile is a copy-paste from a Rust monorepo… **None of the seven defined tasks are runnable in this repo as-is**" |
| `/tmp/audit_phenotype_colab_extensions.md` | 103 | "**Side observation**: the same cargo-flavored `Taskfile.yml` appears at `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosLab/Taskfile.yml` with the identical misconfiguration — the bug was preserved when the work was absorbed into HeliosLab." |
| `/tmp/phenotype-colab-extensions/STATUS.md` | 25 | "## Known issues (do not fix in this archive)" |
| `/tmp/phenotype-colab-extensions/STATUS.md` | 27 | "`src/Taskfile.yml` defines `cargo clippy`/`cargo test`/`cargo build`/`cargo fmt`/`cargo check` for a TypeScript project. This is a copy-paste bug. Same bug exists in `HeliosLab/Taskfile.yml`. Fix lives in the successor, not the archive." |
| `archived-repos/PRESERVATION_POLICY.md` | §1.1 | "NO DELETION" — frozen archive, edits prohibited; fix lives in successor |

---

## 3. File identity verification (recorded finding)

In the prior session (2026-06-12), the two files were verified byte-identical:

```
$ diff -q /tmp/phenotype-colab-extensions/src/Taskfile.yml \
          /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosLab/Taskfile.yml
(no output — identical)

$ md5sum <both>
26afad42f5f4943482bed8b57408f651  /tmp/phenotype-colab-extensions/src/Taskfile.yml
26afad42f5f4943482bed8b57408f651  /Users/kooshapari/CodeProjects/Phenotype/repos/HeliosLab/Taskfile.yml
```

The bug in the successor is a 1:1 copy of the bug in the frozen archive, exactly as `STATUS.md:27` and `audit:103` predict. **The current HeliosLab `Taskfile.yml` (re-read 2026-06-14, 39 lines, 7 tasks) matches the line counts and structure recorded above** — the cargo misconfiguration is still present at lines 7, 8, 13, 24, 29, 34, 39.

---

## 4. HeliosLab toolchain reality (what `bun`/`npm` should actually call)

| Tool | Status in HeliosLab | Evidence |
|------|---------------------|----------|
| **Bun** | Declared as the package manager | `package.json:1` (`"private": true`), `bun.lock` (200 KB lockfile at repo root), `"bun": ">=1.0"` engine pin at `package.json:37` |
| **TypeScript compiler** | Declared as a devDep | `package.json:66` (`"typescript": "^5.4.5"`), `tsconfig.json` (30 lines, `strict: true`, `noEmit: true`) |
| **Electrobun** | Declared as a runtime dep | `package.json:51` (`"electrobun": "1.18.1"`), `electrobun.config.ts` at repo root |
| **Bun test runner** | Available (built into `bun`), no test files yet | `bun test` runs `*.test.ts`/`*.spec.ts` — currently **0 such files** in the TS tree (only `test-plugin/index.ts` exists, no siblings) |
| **Biome** | **`biome.json` exists at root but `@biomejs/biome` is NOT in `package.json` and NOT in `bun.lock`** | `biome.json` (12 lines, only `vcs` + `javascript.formatter` config); grep for `biome` in `bun.lock` and all four `package.json` files returns zero hits |
| **VitePress** | Declared in `docs/package.json` | `docs/package.json:18` (`"vitepress": "^1.6.3"`) |
| **Playwright** | Declared in `docs/package.json` | `docs/package.json:17` (`"@playwright/test": "^1.53.2"`) |
| **Cargo workspace** | Co-exists (members: `pheno-core`, `pheno-db`, `pheno-crypto`, `pheno-cli`, `crates/pheno-ffi-python`, `crates/pheno-ffi-go`) | `Cargo.toml:3` workspace — **separate concern** (the `phenotype-config` SDK), not part of the colab/webflow TS surface |

**Implication for the plan:** the `webflow-plugin/` and `test-plugin/` sub-`package.json` files do not declare lint/test/typecheck scripts either, and the root `package.json` has no `lint`/`test`/`typecheck`/`format` scripts. The conversion below assumes the apply step will also add the corresponding `scripts` block to `package.json` (out of scope for this plan but flagged in §7).

---

## 5. Line-by-line mapping (the proposed fix)

For each `cargo *` command in `HeliosLab/Taskfile.yml`: the current line (with surrounding context), the proposed `bun`/`npm` replacement, and the rationale.

### 5.1 `lint` task — `HeliosLab/Taskfile.yml:4-8`

```yaml
# CURRENT (lines 4–8)
lint:
  desc: "Run clippy linter and check formatting"
  cmds:
    - cargo clippy --all-targets -- -D warnings
    - cargo fmt -- --check
```

**Proposed:**
```yaml
lint:
  desc: "Type-check TypeScript and run biome formatter check"
  cmds:
    - bunx tsc --noEmit
    - bunx biome check .
```

**Rationale (per line):**
- `cargo clippy --all-targets -- -D warnings` (line 7) → `bunx tsc --noEmit`. `tsc --noEmit` is the TypeScript equivalent of `clippy --all-targets` for the TypeScript project: it type-checks every file without emitting, with `strict: true` in `tsconfig.json` making it as strict as `-D warnings`. `cargo clippy` would never run on this repo because there is no `target/` artifact, no `Cargo.toml` for the webflow-plugin/test-plugin/docs modules, and the only Rust workspace (`phenotype-config` SDK) is a different concern (see §4).
- `cargo fmt -- --check` (line 8) → `bunx biome check .`. `biome.json` is the declared formatter at the repo root, and `biome check` (without `--write`) is the dry-run/verify mode — semantically identical to `cargo fmt -- --check`. The audit (§3, lines 82–84) explicitly calls for `biome check` on the webflow-plugin source.
- **Tooling caveat (must be fixed at apply time):** `@biomejs/biome` is NOT currently in any `package.json` or `bun.lock` (see §4). The apply step must `bun add -D @biomejs/biome` first, OR substitute `npx -y @biomejs/biome check .` to fetch on demand.

---

### 5.2 `test` task — `HeliosLab/Taskfile.yml:10-13`

```yaml
# CURRENT (lines 10–13)
test:
  desc: "Run all tests"
  cmds:
    - cargo test --all
```

**Proposed:**
```yaml
test:
  desc: "Run all tests (Bun + docs/vitepress)"
  cmds:
    - bun test
    - cmd: cd documentation && npm run docs:test
      dir: '{{.USER_WORKING_DIR}}'
```

**Rationale (per line):**
- `cargo test --all` (line 13) → `bun test`. Bun's built-in test runner discovers `*.test.ts` / `*.spec.ts` files; this is the canonical replacement for `cargo test --all` in a TypeScript/Bun project. `bun` is pinned in `package.json:37` (`"bun": ">=1.0"`), confirming it's the intended runner.
- **Additional command:** `docs/package.json:8–11` already defines `docs:test` (composed of `docs:test:unit` via `node --test`, `docs:test:component` via `node --test`, and `docs:test:e2e` via `playwright`). Including it makes the `test` task match the audit's intent ("webflow-plugin tests" + everything else in the TS surface).
- **Test reality check (flagged for apply):** There are currently **0** `*.test.ts`/`*.spec.ts` files in the TS tree. `bun test` will exit zero but find nothing. The apply step should not be blocked on this — `bun test` is the correct invocation; the test files are a separate authoring task (out of scope).

---

### 5.3 `quality` task — `HeliosLab/Taskfile.yml:15-19`

```yaml
# CURRENT (lines 15–19)
quality:
  desc: "Run quality checks (lint + test)"
  cmds:
    - task: lint
    - task: test
```

**Proposed:**
```yaml
quality:
  desc: "Run quality checks (lint + typecheck + test)"
  cmds:
    - task: lint
    - task: typecheck
    - task: test
```

**Rationale (per line):**
- The current `quality` task just composes the two other cargo-flavored tasks. It is a meta-task and doesn't reference `cargo` directly, so the structure doesn't need to change — only the underlying `lint` and `test` tasks need to be the bun/npm versions.
- **Add `typecheck` as a new step.** Splitting `tsc` out of `lint` matches the audit's prescribed structure (audit:81 — `typecheck` is its own task per FR-CI-001..004). Including it here makes `quality` a single CI-friendly entry point that runs the same checks the spec mandates.
- `task: lint` and `task: test` (lines 18–19) → unchanged structurally; they now invoke the bun/npm tasks defined in §5.1 and §5.2.

---

### 5.4 `build` task — `HeliosLab/Taskfile.yml:21-24`

```yaml
# CURRENT (lines 21–24)
build:
  desc: "Build release binary"
  cmds:
    - cargo build --release
```

**Proposed:**
```yaml
build:
  desc: "Build stable release via Electrobun"
  cmds:
    - bun run build:stable
```

**Rationale (per line):**
- `cargo build --release` (line 24) → `bun run build:stable`. `package.json:12` already defines `"build:stable": "electrobun build --env=stable"`, which is the canonical "release" build for an Electrobun-based app (it produces a packaged binary in `dist/`). `package.json:11` defines `build:canary` for the prerelease channel; the `build` task should default to **stable** because the original `cargo build --release` is the production build path.
- **Why not `bun run build:dev`:** `build:dev` (line 9) runs `bun setup && electrobun build` (un-packaged dev artifact) — semantically the dev/internal build, not a release.

---

### 5.5 `fmt` task — `HeliosLab/Taskfile.yml:26-29`

```yaml
# CURRENT (lines 26–29)
fmt:
  desc: "Format code with rustfmt"
  cmds:
    - cargo fmt
```

**Proposed:**
```yaml
fmt:
  desc: "Format code with biome"
  cmds:
    - bunx biome format --write .
```

**Rationale (per line):**
- `cargo fmt` (line 29) → `bunx biome format --write .`. `biome format --write` is the write-mode equivalent of `cargo fmt` (which has no `--check` flag — the write-mode is the default). Same tooling caveat as §5.1: `@biomejs/biome` must be installed first.
- **Scope:** the current `cargo fmt` defaults to all Rust files in the workspace. `biome format --write .` formats all files `biome.json` covers (JS/TS/JSON/etc. per `biome.json` which only configures `javascript.formatter`). This is the correct equivalent — `biome` does not format Rust.

---

### 5.6 `clean` task — `HeliosLab/Taskfile.yml:31-34`

```yaml
# CURRENT (lines 31–34)
clean:
  desc: "Clean build artifacts"
  cmds:
    - cargo clean
```

**Proposed:**
```yaml
clean:
  desc: "Clean build artifacts and dependencies"
  cmds:
    - rm -rf node_modules documentation/node_modules webflow-plugin/node_modules test-plugin/node_modules dist .turbo
    - cmd: rm -rf documentation/.vitepress/cache documentation/.vitepress/dist
      ignore_error: true
```

**Rationale (per line):**
- `cargo clean` (line 34) → `rm -rf` of `node_modules`, build output dirs, and VitePress caches. `cargo clean` removes `target/`; the TypeScript equivalent is removing `node_modules/` (per-package) and the framework-specific build outputs.
- **Why per-package `node_modules`:** the repo has 4 `package.json` files (root, `docs/`, `webflow-plugin/`, `test-plugin/`) — each has its own `node_modules`. `bun install` with the workspace link model may hoist, but a `rm -rf` of all four locations is the safest cross-tool equivalent of `cargo clean`.
- **Second command (with `ignore_error: true`):** VitePress generates `.vitepress/cache` and `.vitepress/dist` inside `documentation/` (per `docs/package.json` VitePress config). These are `documentation/.vitepress/{cache,dist}` — guarded with `ignore_error: true` because they may not exist on a fresh clone.
- **Why not `bun pm cache rm`:** that purges the global bun package cache, not the per-repo `node_modules`. Wrong scope for a `clean` task.

---

### 5.7 `check` task — `HeliosLab/Taskfile.yml:36-39`

```yaml
# CURRENT (lines 36–39)
check:
  desc: "Check code compiles without warnings"
  cmds:
    - cargo check --all-targets
```

**Proposed:**
```yaml
check:
  desc: "Type-check without emitting (fast pre-commit check)"
  cmds:
    - bunx tsc --noEmit
```

**Rationale (per line):**
- `cargo check --all-targets` (line 39) → `bunx tsc --noEmit`. The TypeScript equivalent of `cargo check` (no codegen, just verify) is `tsc --noEmit`. `tsconfig.json` has `noEmit: true` already, so `tsc` by default won't emit, but passing `--noEmit` is explicit and matches the audit's prescription at line 81 (`typecheck — tsc --noEmit on the webflow-plugin`).
- **Why a separate `check` task AND a separate `typecheck` task:** the audit (line 81) names a `typecheck` task; the original HeliosLab file has `check`. The proposal above maps `check` → `tsc --noEmit` (the literal cargo-equivalent) and adds `typecheck` as a new task in §5.3's `quality` composition. If the apply step wants to **merge** `check` and `typecheck` into one task, that's a valid simplification — flagged as an open question in §7.

---

## 6. Summary table (drop-in diff)

| Line(s) | Current task name | Current command | Proposed command | Source of truth |
|--------:|:------------------|:----------------|:-----------------|:----------------|
| 7 | `lint` (1/2) | `cargo clippy --all-targets -- -D warnings` | `bunx tsc --noEmit` | `audit:81`, `tsconfig.json` (`strict: true`) |
| 8 | `lint` (2/2) | `cargo fmt -- --check` | `bunx biome check .` | `biome.json`, `audit:82` |
| 13 | `test` (1/1) | `cargo test --all` | `bun test` (+ `cd documentation && npm run docs:test`) | `package.json:37`, `docs/package.json:8` |
| 18–19 | `quality` | `task: lint` + `task: test` | `task: lint` + `task: typecheck` + `task: test` | `audit:80-84` |
| 24 | `build` | `cargo build --release` | `bun run build:stable` | `package.json:12` |
| 29 | `fmt` | `cargo fmt` | `bunx biome format --write .` | `biome.json` |
| 34 | `clean` | `cargo clean` | `rm -rf node_modules … dist .turbo` (+ `.vitepress/{cache,dist}`) | node-modules layout |
| 39 | `check` | `cargo check --all-targets` | `bunx tsc --noEmit` | `tsconfig.json` (`noEmit: true`) |

**New tasks to add at apply time** (audit §3, lines 81–84 / 97–99):
- `typecheck` — `bunx tsc --noEmit` (referenced from `quality`)
- `sync:upstream` — `git fetch upstream && git merge upstream/main --no-commit` (FR-SYNC-005; out of scope for this plan — flagged in §7)
- `sync:check` — `git diff --name-only upstream/main…HEAD | grep -E '^(app/|src/main/|src/renderers/|src/pty/)' | (! grep .)` (FR-SYNC-004; out of scope)
- `specs:validate` — validate that `src/specs/*` files have `Traces to: E{n}.{m}` markers (PRD §E3.2; out of scope)

---

## 7. Open questions & decisions deferred to the apply step

These are flagged for the user to decide before the apply step runs. **None of these block the line-by-line mapping above; they are enhancement decisions.**

1. **HeliosLab's `Cargo.toml` is real and active.** The repo IS a mixed monorepo: the `phenotype-config` Rust SDK (`pheno-core`/`pheno-db`/`pheno-crypto`/`pheno-cli` + `crates/pheno-ffi-{go,python}`) has nothing to do with colab/webflow. The plan above drops all cargo invocations from `Taskfile.yml`. If the user wants the Rust SDK to keep cargo automation, the options are:
   - **(a) Split the Taskfile** — create `crates/Taskfile.yml` for cargo tasks, keep root `Taskfile.yml` for bun/npm (TS).
   - **(b) Keep cargo tasks under a namespace** — wrap the original `lint`/`test`/`build`/`fmt`/`clean`/`check` as `rust:lint`/`rust:test`/… and have a top-level `lint`/`test` that runs both.
   - **(c) Drop cargo entirely from `Taskfile.yml`** — Rust devs use `cargo` directly; the Taskfile serves the colab/webflow surface only. (This is what the plan above assumes.)
2. **Biome is orphaned.** `biome.json` exists at root but `@biomejs/biome` is not in any `package.json` or `bun.lock` (verified). The apply step must either `bun add -D @biomejs/biome` first, OR replace `bunx biome` with `npx -y @biomejs/biome` (fetch-on-demand). The plan above uses `bunx` for consistency with the rest of the toolchain.
3. **`check` vs `typecheck`.** The proposal keeps `check` (1:1 with the original) and adds `typecheck` (per audit). User may want to merge them.
4. **`push:*` and `docs:*` scripts.** `package.json` has 14 `scripts` entries (setup, build:dev, dev, build:canary, build:stable, docs:dev, docs:build, docs:serve, build:docs:release, push:canary, push:patch, push:minor, push:major, push:stable). The plan does NOT propose new `Taskfile.yml` tasks for any of these — they live in `package.json` and can be invoked via `bun run …` directly. User may want to expose them in `Taskfile.yml` for discoverability.
5. **`sync:upstream`, `sync:check`, `specs:validate` — out of scope.** The audit (lines 97–99) flags these as missing-but-required by the spec. The plan does not add them because (a) the spec is for the frozen archive, not the successor, and (b) the user has not requested them. They are noted in §6 for completeness.

---

## 8. Apply-step gate (explicit)

**No edits to `/Users/kooshapari/CodeProjects/Phenotype/repos/HeliosLab/Taskfile.yml` were performed by this plan.** The apply step requires:

1. User sign-off on this plan (explicit, written).
2. Decision recorded for each open question in §7 (especially §7.1 about the Rust sub-workspace).
3. A worktree branch created from `HeliosLab`'s default branch (do not push directly to main).
4. The apply step itself runs `bun add -D @biomejs/biome` first (if §7.2 is resolved as "install") before the Taskfile edit.
5. Post-apply: `task --list` should show 8 tasks (`lint`, `test`, `quality`, `build`, `fmt`, `clean`, `check`, `typecheck` — or however §7.3 resolves); each task should be smoke-tested with `task <name> --dry` to confirm the command resolves.

**Archive (frozen) is not touched.** Per `PRESERVATION_POLICY.md §1.1`, `/tmp/phenotype-colab-extensions/src/Taskfile.yml` remains byte-identical (md5 `26afad42f5f4943482bed8b57408f651`, as recorded in §3). The bug lives in the archive as a historical record; the fix lives in the successor.

---

**Maintainer note:** This plan is generated by Forge as a read-only successor-repo deliverable. It does not modify the frozen archive. The apply step is a separate user-gated action.
