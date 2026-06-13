# pheno-scaffold-kit end-to-end smoke test — 2026-06-11

## Pre-req install status
- pheno-agents-md (cargo): 0.1.0
- pheno-llms-txt (pip): 0.1.0
- pheno-prompt-test (pip): 0.1.0
- pheno-vibecoding-guard (pip): 0.1.0
- pheno-worklog-schema (pip): 0.1.0
- pheno-scaffold-kit (pip): 0.1.0

> Install note: `pheno-scaffold-kit`'s `pyproject.toml` lists `pheno-agents-md` as a
> pip dependency, but `pheno-agents-md` is a Rust crate with no PyPI distribution.
> A plain `pip install pheno-scaffold-kit` therefore fails with
> `ERROR: No matching distribution found for pheno-agents-md`. Workaround used here:
> `pip install /…/pheno-scaffold-kit --no-deps`. This is itself a bug worth filing
> (see PR list below).

## Repo 1: pheno-cost-card

### detect output
Run via `pheno_scaffold_kit.detect_repo_type(...)` (the CLI has no `detect`
subcommand — the closest equivalent is the `init` step's pre-check, which prints
`Detected: …` to stderr):

```json
{
  "exists": true,
  "git": true,
  "python": true,
  "node": false,
  "rust": false,
  "go": false
}
```

### init output (or dry-run)
The `init` command has no `--dry-run` flag. Tested against
`/tmp/scaffold-test-cost-card` (a copy of the target). Output:

```
$ pheno-scaffold init /tmp/scaffold-test-cost-card
Initializing scaffold for /private/tmp/scaffold-test-cost-card
Detected: exists, git, python
Traceback (most recent call last):
  …
  File ".../pheno_scaffold_kit/__init__.py", line 102, in init_scaffold
    "agents": init_agents(root, **context),
  File ".../pheno_scaffold_kit/__init__.py", line 71, in init_agents
    return _call_first(agents_md, ("init_agents", "init", "scaffold"), Path(repo_dir), **kwargs)
  File ".../pheno_scaffold_kit/__init__.py", line 45, in _call_first
    raise RuntimeError("Required scaffold sub-library is not installed")
RuntimeError: Required scaffold sub-library is not installed
```

Because `init_scaffold` does not try/except around each step, the first failure
(`init_agents`) aborts the whole flow — the remaining 4 steps never even run.

To get a per-step breakdown the 5 sub-commands were run individually on the
copy. All five returned exit code 1:

| # | Sub-command             | Exit | Last-line error                                                                                                                 |
|---|-------------------------|------|---------------------------------------------------------------------------------------------------------------------------------|
| 1 | `init-agents`           | 1    | `RuntimeError: Required scaffold sub-library is not installed`                                                                   |
| 2 | `init-llms`             | 1    | `AttributeError: pheno_llms_txt does not expose any supported entrypoint: init_llms, init, scaffold`                            |
| 3 | `init-prompt-test`      | 1    | `AttributeError: pheno_prompt_test does not expose any supported entrypoint: init_prompt_test, init, scaffold`                  |
| 4 | `install-hooks`         | 1    | `AttributeError: pheno_vibecoding_guard does not expose any supported entrypoint: install_hooks, init_vibecoding_guard, init, scaffold` |
| 5 | `init-worklog`          | 1    | `AttributeError: pheno_worklog_schema does not expose any supported entrypoint: init_worklog, init, scaffold`                    |

### Steps that succeeded: none (0/5)
### Steps that failed: all 5 (1/5 per failure type)
- `init-agents` — `pheno-agents-md` is a Rust crate, so `import pheno_agents_md`
  in `pheno_scaffold_kit/__init__.py:9` fails and `agents_md = None`. The kit
  then raises `RuntimeError` instead of an `AttributeError`.
- `init-llms`, `init-prompt-test`, `install-hooks`, `init-worklog` — every Python
  sub-lib exposes a high-level helper (`write_llms_txt`, `LLMResponse`,
  `check_diff`, `add_entry`, …) but **none** of them exposes an
  `init` / `scaffold` / step-specific function. The kit's `_call_first` walks
  `("init_xxx", "init", "scaffold")` and falls off the end with
  `AttributeError: … does not expose any supported entrypoint`.

### Missing entrypoints: <list with suggested fix>
- `pheno-llms-txt` — add `init_llms(repo_dir, **kw)` that calls
  `write_llms_txt(load_config("pheno-llms-txt.yaml"), repo_dir/"llms.txt")`.
  Files to touch: `src/pheno_llms_txt/__init__.py`, optionally a new
  `cli init` sub-command.
- `pheno-prompt-test` — add `init_prompt_test(repo_dir, **kw)` that writes
  a starter `tests/prompts/conftest.py` (or a `pyproject.toml` `[tool.pheno-prompt-test]`
  block) so `pheno-prompt-test` hooks in. File: `src/pheno_prompt_test/__init__.py`.
- `pheno-vibecoding-guard` — add `install_hooks(repo_dir, **kw)` that copies a
  `.pre-commit-config.yaml` snippet and `pheno-vibecoding-guard run` step into
  the repo. File: `src/pheno_vibecoding_guard/__init__.py`.
- `pheno-worklog-schema` — add `init_worklog(repo_dir, **kw)` that writes a
  blank V2 `WORKLOG.md` table with the canonical column header row. File:
  `src/pheno_worklog_schema/__init__.py`.
- `pheno-agents-md` — out-of-process (Rust). Either (a) ship a tiny PyO3 wheel
  exposing `init_agents(repo_dir) -> dict`, or (b) drop it from
  `pheno-scaffold-kit/pyproject.toml` dependencies and call the `pheno-agents-md`
  binary via `subprocess` from the kit's `init_agents`. The kit's
  `try/except ImportError` already handles the missing-import case, so the
  dependency listing is what's blocking `pip install`.

## Repo 2: pheno-mcp-router

### detect output
```json
{
  "exists": true,
  "git": true,
  "python": true,
  "node": false,
  "rust": false,
  "go": false
}
```

### init output (or dry-run)
```
$ pheno-scaffold init /tmp/scaffold-test-mcp-router
Initializing scaffold for /private/tmp/scaffold-test-mcp-router
Detected: exists, git, python
Traceback (most recent call last):
  …
RuntimeError: Required scaffold sub-library is not installed
```

Same shape as cost-card: crashes on the first step, remaining 4 never run.

Per-step breakdown (run on `/tmp/scaffold-test-mcp-router` copy):

| # | Sub-command             | Exit | Last-line error                                                                                                                 |
|---|-------------------------|------|---------------------------------------------------------------------------------------------------------------------------------|
| 1 | `init-agents`           | 1    | `RuntimeError: Required scaffold sub-library is not installed`                                                                   |
| 2 | `init-llms`             | 1    | `AttributeError: pheno_llms_txt does not expose any supported entrypoint: init_llms, init, scaffold`                            |
| 3 | `init-prompt-test`      | 1    | `AttributeError: pheno_prompt_test does not expose any supported entrypoint: init_prompt_test, init, scaffold`                  |
| 4 | `install-hooks`         | 1    | `AttributeError: pheno_vibecoding_guard does not expose any supported entrypoint: install_hooks, init_vibecoding_guard, init, scaffold` |
| 5 | `init-worklog`          | 1    | `AttributeError: pheno_worklog_schema does not expose any supported entrypoint: init_worklog, init, scaffold`                    |

### Steps that succeeded: none (0/5)
### Steps that failed: all 5 — identical reasons to pheno-cost-card (entrypoint-name
mismatch on 4 of the 5, and `pheno-agents-md` import failure on the 1st).
### Missing entrypoints: same list as pheno-cost-card (the gaps are in the
sub-libs, not in the target repos).

## Findings
The umbrella CLI is well-structured (clear `_call_first` indirection, good
`try/except ImportError` on each sub-lib, granular per-step sub-commands, a
`detect_repo_type` helper) but it currently cannot deliver a single working
step. There are two distinct classes of gap, and they are independent:

1. **Cross-language mismatch.** `pheno-agents-md` is a Rust crate while
   `pheno-scaffold-kit` declares it as a pip dependency. The kit's
   `pheno_scaffold_kit/__init__.py:8-11` already soft-imports it, so the real
   bug is the `pyproject.toml` `dependencies` line — a user running a vanilla
   `pip install pheno-scaffold-kit` will never even reach the soft-import
   fallback. The path of least resistance: drop `pheno-agents-md` from
   `pheno-scaffold-kit/pyproject.toml` dependencies (it's optional, the
   `try/except` proves it) and have `init_agents` shell out to the
   `pheno-agents-md` binary that `cargo install` already places on `$PATH`.
2. **Missing sub-lib entrypoints.** The four Python sub-libs each implement the
   "render" half of their job (write a file given a config object) but none
   implement the "init/scaffold" half that the umbrella looks for. Concretely,
   the umbrella tries `("init_xxx", "init", "scaffold")` in that order — and
   falls off the end with `AttributeError` every time. The sub-libs need a
   one-shot helper that takes a `repo_dir` and writes the right starter file
   into it. The `pheno-llms-txt` and `pheno-vibecoding-guard` libraries already
   have a `cli.py`, so adding a small Python wrapper is a <30-line change per
   lib. `pheno-prompt-test` and `pheno-worklog-schema` would need a new public
   function added to their `__init__.py` (the existing `__all__` lists are
   a good guide for naming).

A secondary UX gap: `init_scaffold` in
`pheno_scaffold_kit/__init__.py:95-107` does not wrap each step in
`try/except`, so the first failure aborts the whole `init` and the user has to
run each sub-command individually to see the full failure picture. Wrapping
each call in a small `try/except Exception` (recording the error under
`"error"` in the result dict) would make the umbrella usable in a degraded
state — a key property when 4/5 sub-libs are still being completed.

## Suggested follow-up PRs
1. **fix(scaffold-kit): drop unresolvable pip dep on Rust crate**
   Remove `pheno-agents-md` from `pheno-scaffold-kit/pyproject.toml:15-22`
   and have `init_agents` invoke the `pheno-agents-md` CLI via
   `subprocess.run(["pheno-agents-md", "--out", f"{repo_dir}/AGENTS.md"])`.
   Unblocks `pip install pheno-scaffold-kit` for everyone.
   Files: `pyproject.toml`, `src/pheno_scaffold_kit/__init__.py`.

2. **feat(llms-txt): add `init_llms(repo_dir)` entrypoint**
   One-line wrapper around `load_config(repo_dir/"pheno-llms-txt.yaml")` and
   `write_llms_txt(cfg, repo_dir/"llms.txt")`, exported in
   `pheno_llms_txt/__init__.py`. Unblocks the `init-llms` sub-step.
   Files: `src/pheno_llms_txt/__init__.py`, `src/pheno_llms_txt/core.py`.

3. **feat(prompt-test): add `init_prompt_test(repo_dir)` entrypoint**
   Writes a starter `tests/prompts/conftest.py` registering a smoke-test
   `PromptCase` and adds a `[tool.pytest.ini_options]` `prompt_test` block to
   the repo's `pyproject.toml` (idempotent — skip if already present).
   File: `src/pheno_prompt_test/__init__.py` + a new
   `src/pheno_prompt_test/scaffold.py` (or inline).

4. **feat(vibecoding-guard): add `install_hooks(repo_dir)` entrypoint**
   Writes a `.pre-commit-config.yaml` entry for `pheno-vibecoding-guard run`
   and a sample `pheno-vibecoding-guard.yaml` config. Wire it into
   `pheno_vibecoding_guard/__init__.py`.
   Files: `src/pheno_vibecoding_guard/__init__.py`, `guard.py`.

5. **feat(worklog-schema): add `init_worklog(repo_dir)` entrypoint**
   Writes a blank V2 10-column `WORKLOG.md` header (idempotent — skip if the
   file already exists). File: `src/pheno_worklog_schema/__init__.py`.

6. **fix(scaffold-kit): make `init` collect per-step errors instead of crashing**
   Wrap each `init_xxx(...)` call inside `init_scaffold` in a
   `try/except Exception as exc: results[key] = {"error": str(exc)}`. Lets
   the umbrella still report `4/5 succeeded` when one step is broken.
   Files: `src/pheno_scaffold_kit/__init__.py` (single function change).

7. **docs(scaffold-kit): add `--dry-run` to the `init` command**
   Cheap UX win. With dry-run, `init` would just call `detect_repo_type` and
   print the sub-step plan instead of executing. Catches ~all of the issues
   this report found in seconds, not minutes. File:
   `src/pheno_scaffold_kit/cli.py`.
