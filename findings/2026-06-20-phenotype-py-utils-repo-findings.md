# phenotype-py-utils — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `phenotype-py-utils/` — **ACTIVE**
**Status:** Active — shared Python utility library for the Phenotype org

---

## 1. Overview

`phenotype-py-utils` is the canonical Python shared utility library for the Phenotype organization. It consolidates commonly-copied utility functions (config loading, logging setup, CLI arg parsing, datetime, string utilities) into a single tested, typed, and quality-gated package. The project follows the org's Python quality bar (`mypy --strict`, `ruff`, `pytest` with coverage).

The package was originally a small core of 5 public API functions, and has since absorbed capabilities from `phenotype-py-extras` (extras for CLI, MCP, web, testing).

## 2. Repository Structure

```
phenotype-py-utils/
├── src/
│   └── phenotype_py_utils/
│       ├── __init__.py              # Package root + re-exports (5 public functions)
│       ├── config.py                # load_config - YAML/TOML/JSON loading with env-var override
│       ├── logging.py               # setup_logging - stdlib logging + JSON formatter
│       ├── args.py                  # parse_args - dataclass → argparse CLI
│       ├── datetime.py              # iso_now, from_unix - UTC timestamps with Z suffix
│       ├── string.py                # truncate, slugify - string utilities
│       └── extras/
│           ├── __init__.py
│           ├── cli.py               # Extra CLI utilities (click, typer, rich)
│           ├── mcp.py               # MCP server utilities (fastmcp)
│           ├── web.py               # Web utilities (fastapi, uvicorn)
│           ├── testing.py           # Testing utilities (pytest helpers)
│           └── llms_txt/
│               ├── __init__.py
│               ├── core.py          # llms.txt renderer core
│               └── cli.py           # llms.txt CLI tooling
├── tests/                           # 59 tests with coverage
├── config/                          # Example configuration files
├── docs/                            # Documentation
├── pyproject.toml                   # hatchling build, ruff, mypy, pytest config
├── README.md                        # Full API reference
├── AGENTS.md                        # Agent instructions
└── CHANGELOG.md
```

## 3. Architecture — Modular Utility Library

```
phenotype_py_utils/
├── Core (zero extra deps)     ─── load_config, setup_logging, parse_args, iso_now, truncate
│   ├── deps: pyyaml only
│   └── Quality: mypy --strict, ruff clean, pytest with coverage
│
├── Extras (optional deps)     ─── cli, mcp, web, testing
│   ├── cli:   click, rich, typer, pydantic
│   ├── mcp:   fastmcp, pydantic, pydantic-settings, httpx
│   ├── web:   fastapi, uvicorn, pydantic, pydantic-settings
│   └── testing: pytest, pytest-asyncio, pytest-cov
│
└── Extras.llms_txt            ─── llms.txt spec renderer
    └── deps: pyyaml + extras[cli]
```

## 4. Key Features

| Feature | Status | Location |
|---------|--------|----------|
| Multi-format config loading (YAML, TOML, JSON) | Done | `src/phenotype_py_utils/config.py` |
| Environment variable overrides (`PHENOTYPE_KEY__SUBKEY`) | Done | `src/phenotype_py_utils/config.py` |
| One-line logging setup with JSON output | Done | `src/phenotype_py_utils/logging.py` |
| Dataclass-to-argparse CLI generation | Done | `src/phenotype_py_utils/args.py` |
| UTC ISO 8601 timestamps + Z suffix | Done | `src/phenotype_py_utils/datetime.py` |
| String truncation with configurable suffix | Done | `src/phenotype_py_utils/string.py` |
| Slugify utility | Done | `src/phenotype_py_utils/string.py` |
| CLI extras (click, typer, rich) | Done (absorbed from py-extras) | `src/phenotype_py_utils/extras/cli.py` |
| MCP server extras (fastmcp) | Done (absorbed from py-extras) | `src/phenotype_py_utils/extras/mcp.py` |
| Web extras (fastapi, uvicorn) | Done (absorbed from py-extras) | `src/phenotype_py_utils/extras/web.py` |
| Testing extras (pytest helpers) | Done (absorbed from py-extras) | `src/phenotype_py_utils/extras/testing.py` |
| llms.txt renderer | Done | `src/phenotype_py_utils/extras/llms_txt/` |
| Observability (structlog, loguru) | Optional deps declared | `pyproject.toml` [observability] extra |

## 5. Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| pyyaml | Core | YAML parsing |
| tomli | Optional (<3.11) | TOML parsing |
| click, rich, typer, pydantic | Extra: cli | CLI application support |
| fastmcp, pydantic-settings, httpx | Extra: mcp | MCP server support |
| fastapi, uvicorn | Extra: web | Web server support |
| pytest, pytest-asyncio, pytest-cov | Extra: testing | Test utilities |
| structlog, loguru | Extra: observability | Structured logging |
| pytest, mypy, ruff, types-PyYAML | Dev | Quality tooling |

## 6. Package Configuration

**Build System:** hatchling
**Python:** >=3.10 (supports 3.10–3.14)
**Typing:** Fully typed via PEP 561 (`py.typed` marker)
**Current Version:** 0.2.0

### Quality Tooling

| Tool | Config | Strictness |
|------|--------|------------|
| ruff | line-length=100, target=py310 | E/F/I/N/W/UP/B/C4/SIM/RUF |
| mypy | strict=true, python-version=3.10 | Strict mode for src/, relaxed for tests/ |
| pytest | minversion=8.0, coverage | `--cov=phenotype_py_utils`, branch coverage |

## 7. Extras Architecture

The extras package absorbs previously separate `phenotype-py-extras` functionality:

- **Zero-cost abstraction**: Core functions have no deps beyond pyyaml. Extras require explicit `pip install phenotype-py-utils[cli,mcp,web]`.
- **All extras are optional**: Declared as optional-dependencies groups in pyproject.toml.
- **llms.txt renderer**: Nested within extras as a self-contained sub-package with its own CLI entry point.

## 8. Config Loading Details

`load_config` supports three formats auto-detected from extension:

| Extension | Parser | Python Version |
|-----------|--------|---------------|
| .yaml / .yml | pyyaml | All |
| .toml | tomllib (stdlib) | 3.11+ |
| .toml | tomli | 3.10 |
| .json | json (stdlib) | All |

Env var override scheme: `PHENOTYPE_KEY__SUBKEY=value` maps to `config["key"]["subkey"] = "value"`. Double underscore (`__`) is the nesting separator.

## 9. Test Coverage

- **59 tests** covering all core functions and edge cases
- Config loading with various formats, env var overrides, error cases
- Logging setup (idempotency, JSON formatting, custom formats)
- Arg parsing (bool flags, required fields, custom types)
- Datetime utilities (iso_now, from_unix, precision)
- String utilities (truncate edge cases, slugify edge cases)

## 10. Key Observations

1. **Clean, focused core API**: Only 5 public functions — no scope creep, well-documented with comprehensive API reference in README.
2. **Org quality bar enforcement**: Full mypy --strict compliance, ruff linting, pytest with branch coverage across all Phenotype Python repos.
3. **Elegant extras pattern**: Uses hatchling optional-dependencies groups — consumers only pay for what they use.
4. **Absorption milestone**: The extras package absorbed `phenotype-py-extras`, demonstrating the org's polyrepo → monorepo consolidation strategy.
5. **OTel-friendly timestamps**: `iso_now()` outputs ISO 8601 with `Z` suffix (not `+00:00`) — consistent with OpenTelemetry and browser JSON parsing.
6. **Self-documenting CLI bridge**: `parse_args` uses dataclass type annotations and docstrings to auto-generate argparse help text.

## 11. Recommendations

1. **Publish type stubs**: While fully typed internally, `.pyi` stubs would improve IDE DX for consumers.
2. **Generic config typing**: `load_config` returns `dict[str, Any]` — consider TypedDict or a generic type parameter for type-safe config access.
3. **CI matrix for extras**: Currently only the core is CI-tested; extras groups should be validated independently.
4. **Bump to 1.0.0**: API is stable and well-tested — 0.x versioning understates production readiness.
