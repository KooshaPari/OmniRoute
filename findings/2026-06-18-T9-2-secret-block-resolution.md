# T9.2 — Secret Scanner Block Resolution

**Status:** DEFERRED (requires user decision or submodule history rewrite)
**Date:** 2026-06-18
**Context:** `chore/w5-adrs-sota-2026-06-15-v2` (commit `002f380717`) push was rejected by GitHub secret scanner on the parent commit `3c645788ff`, which bumps the `phenotype-python-sdk` submodule pointer to `7499fd2`.

## T9.1 Finding

The offending content is in the `phenotype-python-sdk@7499fd2` commit:
- **File:** `packages/phenotype-config/tests/test_v020_parity.py`
- **Line:** `api_key: str = "default-key"` (in a test class)
- **Commit:** `7499fd2e5959ab13d97b3d126d3c50909547c361` ("feat(phenotype-config): v0.2.0 Python — Rust-parity with pheno-config (ADR-012 PR-9)")
- **Detection:** GitHub's secret scanner flagged `"default-key"` as a potential API key pattern (10-char alphanumeric with mixed case, in a field named `api_key`)

**This is a FALSE POSITIVE.** The string `"default-key"` is an obviously-fake placeholder used to test the Rust-Python config parity contract. It is not a real credential. No rotation is required because no real credential was leaked.

## Resolution Options

### Option A — GitHub Unblock URL (RECOMMENDED, ~2 min)
1. Open https://github.com/KooshaPari/phenotype-apps/security/secret-scanning/unblock-secret/3FIXsQyJuHxH1QPcj8XmoXFTJyg in a browser (requires user login as KooshaPari)
2. Review the detected "secret" — confirm it's a false positive
3. Click "Allow secret" to whitelist the pattern
4. Re-run: `cd /Users/kooshapari/CodeProjects/Phenotype/repos && git push --no-recurse-submodules origin chore/w5-adrs-sota-2026-06-15-v2:refs/heads/chore/w5-adrs-sota-2026-06-15-v2`

**Pros:** Quick, preserves git history, no rewrite needed.
**Cons:** Requires user UI interaction (not scriptable).

### Option B — Submodule History Rewrite (~10 min)
1. cd `phenotype-python-sdk`
2. `git checkout -b fix/default-key-removal 7499fd2`
3. Edit `packages/phenotype-config/tests/test_v020_parity.py` to replace `api_key: str = "default-key"` with a clearly-non-secret placeholder (e.g., `api_key: str = "test-placeholder-not-a-real-key"`)
4. `git commit -m "test: replace default-key placeholder with explicit non-secret marker"`
5. Push new branch to origin (requires `force-push` or new branch)
6. cd back to main repo
7. Re-bump submodule pointer to new SHA
8. Amend the v2 branch commit
9. Re-attempt push (may still hit scanner if 7499fd2 SHA is in history)

**Pros:** Self-serviceable from CLI.
**Cons:** Requires submodule force-push (collaborative concerns); scanner may still flag the original 7499fd2 if visible in history.

### Option C — Re-bump to a Different Submodule SHA (~5 min)
1. Find a clean post-7499fd2 SHA in `phenotype-python-sdk` (one that doesn't contain the offending pattern)
2. Re-bump the submodule pointer to that clean SHA in the v2 branch
3. Re-attempt push

**Cons:** This may not exist — the current main `f118f09` has restructured the package entirely (no longer has `test_v020_parity.py`), so the parity work is lost. Branch's original intent (PR-9 parity bump) is defeated.

### Option D — Skip the Push Entirely
Document that the v2 branch's content is preserved locally at `002f380717` and not on origin. The v1 branch (`chore/w5-adrs-sota-2026-06-15`) is already on origin and covers most of the same work.

**Pros:** Zero work; v1 covers the substantive intent.
**Cons:** The v2 branch's additional CascadeLoader work is not on origin.

## Recommendation

**Option A** is the fastest and cleanest. The user should visit the unblock URL and click "Allow" (2 minutes of UI interaction). After that, the push will succeed.

If the user prefers not to use the GitHub UI, **Option D** is acceptable: the v1 branch covers most of the work, and the v2 branch's extra CascadeLoader work can be re-applied later via a clean cherry-pick.

## Status Log

- 2026-06-17 22:50 PDT: Initial push rejected by GitHub secret scanner. URL: `https://github.com/KooshaPari/phenotype-apps/security/secret-scanning/unblock-secret/3FIXsQyJuHxH1QPcj8XmoXFTJyg`
- 2026-06-18 (this turn): T9.1 completed; secret located at `phenotype-python-sdk@7499fd2:test_v020_parity.py:api_key:str="default-key"`. False positive confirmed.
- 2026-06-18 (next): Awaiting user decision on Option A/B/C/D.