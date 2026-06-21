# L15 — CLI/UX & ergonomics

**Owner:** forge-A08 (UX)
**Scope:** Argument parsing, output formatting, progress indicators, interactive prompts, shell completions, man pages, help-text quality.
**Status legend:** ✓ implemented · △ partial · ✗ missing

## Scope

How the bloc's CLIs (Rust clap-based and Python click/typer-based) greet the user, parse intent, format output, render progress, and offer discoverability (completions, man pages, help text).

## SOTA 2026

- `clap` v4 with `#[derive(Parser)]` + nested `Subcommand`s, versioned `--version`, env-var fallback (`#[arg(env = "...")]`).
- Output format selectors: `--format text|json|yaml|table` with a single emitter.
- Progress via `indicatif` (Rust) or `rich.progress` (Python); non-TTY auto-detection.
- Interactive prompts via `inquire` (Rust) or `rich.prompt` / `click.prompt` (Python).
- Shell completions via `clap_complete` (`-bash`, `-zsh`, `-fish`, `-elv`, `-powershell`) installed as a subcommand.
- Man pages via `clap_mangen` rendered to `share/man/man1/`.
- Help text written once and reused (clap auto-generates from doc comments; typer auto-generates from signatures).
- Color/spinner suppression on `NO_COLOR` / `CI` / non-TTY.

## Phenotype state

### Rust CLIs (clap derive baseline — strong)
- **AgilePlus `agileplus-cli`** — `crates/agileplus-cli/src/main.rs:23-28` ✓
  - `#[derive(Parser)]` + `#[command(name, about, version)]` — versioned CLI ✓
  - Nested `Subcommand` (Feature/Module/Cycle/...) — 24 subcommand files in `crates/agileplus-cli/src/commands/`
  - 10,936 lines of command implementations
  - **Output format selector** — `crates/agileplus-cli/src/context.rs:24-34` defines `OutputFormat::{Text, Json}` ✓
  - `context.rs:200-216` — `serde_json::to_string_pretty(value)?` emitters for JSON ✓
  - `context.rs:141` — `is_json()` check; commands branch on format △ partial (not all commands honor --format)
  - `main.rs:549,555,562` — wraps `SqliteStorageAdapter` errors as `anyhow!("open db: {e}")` ✓
  - `main.rs:582` — `eprintln!("error: {e:#}")` (uses `{:#}` to print context chain) ✓
  - **No progress bars / spinners** ✗
  - **No interactive prompts** ✗
  - **No shell completions** (`clap_complete` absent) ✗
  - **No man pages** (`clap_mangen` absent) ✗
- **thegent Rust CLIs** — 112 clap usages across 20+ crates, including
  - `thegent/crates/thegent-shims/src/main.rs`, `thegent-maif/src/main.rs`, `thegent-watcher/src/main.rs`, `thegent-fs/src/main.rs`, `thegent-benchmark/src/main.rs`, `thegent-git/src/main.rs`, `thegent-runtime/src/main.rs`, `thegent-discovery/src/main.rs`, `thegent-shm/src/main.rs`, `thegent-path-resolve/src/main.rs`, `thegent-plugin-host/src/main.rs`, `thegent-tool-detect/src/main.rs`, `thegent-docs/src/main.rs`, `thegent-parser/src/main.rs`, `thegent-offload/src/main.rs`, `thegent-tui/src/main.rs`, `thegent-hooks/src/main.rs`, `thegent-jsonl/src/main.rs`, `hooks/hook-dispatcher/src/main.rs`
  - `thegent/crates/thegent-utils/src/bin/monitor.rs:6` — uses `colored::*` for ANSI output ✓
  - `thegent/crates/thegent-hooks/Cargo.toml:66` — `colored = "3.0.0"` dep ✓
  - `thegent/crates/thegent-utils/Cargo.toml:24` — `colored = "3.0.0"` dep ✓
  - **No progress bars** ✗
  - **No shell completions / man pages** ✗
- **Tracely** — no CLIs, no bin entries ✗ (library-only crate)
- **Tracera** — `crates/tracera-core/src/health.rs` declares `HealthError` and a `HealthConfig`; no `bin/` entries; no CLI ✗

### Python CLIs (typer + click + rich)
- **thegent** — `thegent/pyproject.toml:13` deps: `typer>=0.16.0, rich>=13.9.4, pydantic>=2.12.5` ✓
  - `thegent/src/thegent/mesh/cli.py:14-15` — `app = typer.Typer(help="Agent Mesh Coordination commands")` ✓
  - `thegent/src/thegent/mesh/cli.py:17` — `console = Console()` (rich) ✓
  - `thegent/src/thegent/mesh/cli.py:21-23` — `app.add_typer(queue_app, name="queue")` — nested sub-app ✓
  - `thegent/src/thegent/mesh/cli.py:26-37` — `typer.Option` with short flags and help strings ✓
  - `thegent/src/thegent/mesh/cli.py:36` — `console.print(f"[bold green]Task enqueued![/bold green] ID: [cyan]{task_id}[/cyan]")` — rich markup ✓
  - `thegent/cli/commands/queue.py:17` — `@click.group("queue")` + `click.option` △
    - Two CLI libraries used inconsistently (typer for mesh, click for queue)
  - `thegent/cli/commands/governance_policy_contracts_cmds.py:72,106,139,185` — `console_inst = Console()` ✓
  - `thegent/cli/commands/specs.py:19` — `console = Console()` ✓
  - `thegent/src/thegent/mesh/observability.py:138` — `console = Console(width=1000, soft_wrap=False)` for table output ✓
  - `thegent/src/thegent/cli/commands/cli.py` — 486 lines of CLI command implementations
  - 58 `typer` `@app.command` / `@app.callback` decorators across the project ✓
  - **No `rich.progress` usage in thegent CLI source** (only in tests + `pheno-deploy` resilience kit) ✗
  - **No `rich.prompt` interactive prompts** ✗
  - **No shell completions** (typer auto-generates if `--install-completion` is invoked; never called) ✗
  - **The `thegent/cli/parser.py` is a stub** — `thegent/cli/parser.py:1-12` returns `{"argv": argv, "parsed": True}` without real parsing △ (dead code)
  - `thegent/benchmark/tbench_validate.py:43-46` — `argparse` with `description` ✓
  - `thegent/heliosHarness/benchmark/src/helios_bench/local_runner.py:43-46` — `argparse` ✓
  - `thegent/specs/generate_all_specs.py:108-142` — `argparse` with subcommands △
  - **Multiple parallel CLI styles** (typer + click + argparse + stub) in the same repo — fragmentation ✗

### Output formats
- **AgilePlus** — text (default) + JSON (`OutputFormat::Json`) ✓ — but not all commands honor it
- **thegent** — `--format` arg + `_normalize_output_format` supports `"rich"` / `"csv"` (fallback `"rich"`) at `thegent/tests/test_unit_cli_impl_gaps.py:229-238` △
  - Test coverage: `thegent/tests/test_unit_cli_commands_a.py:223-225,326-328,428-430,510,711,1002-1004` — rich tables rendered ✓
- **Tracely/Tracera** — no CLI ✗

### Help text quality (samples)
- `AgilePlus/crates/agileplus-cli/src/main.rs:23-28` — `#[command(name = "agileplus", about = "AgilePlus project management CLI", version)]` ✓
- `AgilePlus/crates/agileplus-cli/src/main.rs:36, 41, 51, 53, 56, 58, 60, 62, 64, 66, 68, 70, 72` — every subcommand has a `///` doc comment (15/15 commands documented) ✓
- `thegent/src/thegent/mesh/cli.py:27-37` — `typer.Option(..., help="...")` on every flag ✓
- `thegent/cli/commands/queue.py:36-39` — `click.option(..., help="...")` ✓
- `AgilePlus/crates/agileplus-cli/src/main.rs:88-89` — `#[arg(long, value_name = "STATE")]` — explicit value name in help ✓
- `thegent/src/thegent/mesh/cli.py:14` — `typer.Typer(help="Agent Mesh Coordination commands")` top-level help ✓
- Doc comments used as help text — most CLI surfaces are well-documented ✓
- **No `--help` examples** in any clap surface (could use `#[command(after_help = ...)]`) ✗

### Color, spinners, progress
- `thegent/crates/thegent-utils/Cargo.toml:24` + `thegent/crates/thegent-hooks/Cargo.toml:66` — `colored = "3.0.0"` dep ✓
- `thegent/crates/thegent-utils/src/bin/monitor.rs:6` — `use colored::*;` ✓
- `thegent/src/thegent/mesh/cli.py:36` — rich ANSI markup `[bold green]…[/bold green]` ✓
- **No `indicatif` (Rust) or `rich.progress` (Python) in main bloc source** — progress bar dependency only in `phenotype-python-sdk/.../deploy-kit/src/pheno_deploy_kit/cli.py` (satellite) ✗
- **No `inquire` / `dialoguer` (Rust) or `rich.prompt` / `click.prompt` (Python) interactive prompts** ✗

### Shell completions
- **None in main bloc** ✗
- `HeliosCLI/codex-rs/Cargo.toml:clap_complete = "4"` + `HeliosCLI/codex-rs/cli/src/main.rs:use clap_complete::Shell; generate` — exists in satellite (HeliosCLI) ✓ but not used in main bloc
- typer auto-generates completions via `--install-completion` — never invoked anywhere ✗
- No `completion.sh` / `completion.bash` artifacts found ✗

### Man pages
- **None in main bloc** ✗
- `KWatch/node_modules/jsesc/man/jsesc.1`, `DINOForge-UnityDoorstop/tools/xmake_build/scripts/man/{xmake,xrepo}.1` — present but vendored, not bloc-authored ✗
- `clap_mangen` not in any bloc Cargo.toml ✗

### Telemetry / startup UX
- `AgilePlus/crates/agileplus-cli/src/main.rs:515` — `let _telemetry = agileplus_telemetry::init_subscriber().ok();` — telemetry init at startup ✓
- `agileplus-telemetry` wires structured logging for every command ✓ (complements L5)

## Gaps

1. **No `clap_complete` in main bloc** — completion subcommand missing ✗ — effort: S
   - Add `clap_complete = "4"` + a `Cli::Complete` subcommand to `agileplus-cli/src/main.rs` (mirror the HeliosCLI pattern at `HeliosCLI/codex-rs/cli/src/main.rs:use clap_complete::Shell`).
2. **No `clap_mangen` / man-page generation** — bloc has no man pages ✗ — effort: S
   - Add `clap_mangen` to `agileplus-cli`, generate `man/man1/agileplus.1` in CI, install to `share/man/man1/`.
3. **No progress bars / spinners** — long ops (sync, import, scan) print only the result line ✗ — effort: S
   - Add `indicatif = "0.17"` and wrap long ops in `agileplus-cli` (e.g. `crates/agileplus-cli/src/commands/sync.rs`, `import_dagctl.rs`).
   - Add `rich.progress` to thegent `mesh/cli.py:queue scan` (long-running).
4. **No interactive prompts** — bloc has no `--yes` skip, no confirmation on destructive ops ✗ — effort: S
   - Add `inquire = "0.7"` (Rust) and `rich.prompt.Confirm` (Python) for destructive prompts (delete, force-push, etc).
5. **thegent CLI fragmentation** — 3+ parser libs (typer, click, argparse) + a stub (`thegent/cli/parser.py`) ✗ — effort: M
   - Pick one (typer) as canonical, port click groups, replace the stub, remove argparse uses from `thegent/benchmark/`, `thegent/heliosHarness/`, `thegent/specs/`.
6. **No `NO_COLOR` / non-TTY detection** — `colored` and rich markup may emit ANSI into pipes ✗ — effort: S
   - Use `colored::control::set_override(!atty::is(Stream::Stdout))` (Rust) and `Console(no_color=True)` or `force_terminal()` (Python).
7. **Output format (`--format json`) not consistently honored** — `agileplus-cli/src/context.rs:141` is checked but not every command branches on it ✗ — effort: S
   - Audit all 24 command files in `agileplus-cli/src/commands/` and route every `println!` through the `OutputContext::print` helper at `context.rs:200-216`.
8. **No `--help` examples / after_help** — bloc has only short `about` strings ✗ — effort: S
   - Add `#[command(after_help = "EXAMPLES:\n  agileplus feature list\n  agileplus feature show 42")]` to every clap subcommand.
9. **thegent stub `parser.py` ships in the package** — `thegent/cli/parser.py:1-12` is placeholder code ✗ — effort: S
   - Delete or implement (refer to the canonical typer app in `thegent/src/thegent/cli/apps/main.py`).
10. **No auto-`--version` consistency** — some thegent binaries do not declare `version` in `#[command(...)]` ✗ — effort: S
    - Audit each clap surface; ensure every top-level `Cli` has `version` in `#[command(...)]`.
11. **No shell-completion install / uninstall subcommand** — even with `clap_complete` added, no `agileplus-cli completions install` wrapper exists ✗ — effort: S
    - Add `agileplus-cli completions {bash,zsh,fish,powershell,elv}` subcommand that prints to stdout and provide an `install` flag that drops the file to `~/.zsh/completions/_agileplus`.
12. **typer `--install-completion` is never called in tests/CI** — thegent's typer apps never exercise the install path ✗ — effort: S
    - Add a smoke test that asserts `typer.main.get_completion()` returns shells for the main app.

## Recommendations

1. **Adopt `clap_complete` + `clap_mangen` for the Rust bloc** in one PR — adds two dev-deps and a subcommand. Reuse the `HeliosCLI/codex-rs/cli/src/main.rs:use clap_complete::generate` pattern.
2. **Standardize thegent Python CLI on `typer`**; remove the click groups and the stub `parser.py`. `typer.Typer` already supports `rich` integration and `--install-completion` out of the box.
3. **Wire `indicatif` into long-running Rust commands** (sync, import, dag scan) and `rich.progress` into thegent `mesh` long-running tasks. Always check `isatty(stdout)` first to skip in pipes/CI.
4. **Add interactive confirmation** for destructive ops (`agileplus worklog reset`, `agileplus ship --force`, `thegent mesh queue purge`) via `inquire::Confirm` (Rust) / `rich.prompt.Confirm` (Python), with a `--yes` escape hatch.
5. **Add `after_help` examples to every clap subcommand** and a top-level `agileplus --help` tutorial page; the SOTA bar is one `EXAMPLES:` block, not a separate docs site.
6. **Route every command's output through `OutputContext`** so `--format json` is honored uniformly. This also makes the CLI machine-parseable for agent-driven workflows.
7. **Detect `NO_COLOR` and non-TTY** to avoid emitting ANSI when piped; respect `CI=true` for determinism.
8. **Generate and ship man pages** (`clap_mangen`) and completion scripts (`clap_complete`) via a `make man` / `make completions` target, installed to `share/man/man1/` and `share/completions/` in release artifacts.
