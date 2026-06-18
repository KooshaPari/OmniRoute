# py-pheno-mcp Wave F redirect (D-02)

| Source | Canonical | Pattern |
|--------|-----------|---------|
| `python/pheno-mcp` (HexaKit/phenoShared) | **PhenoMCP** + substrate MCP plane | REDIRECT |

**Consumer rule:** `pip install` / path dep → PhenoMCP packages or `phenotype-python-sdk` MCP extras — not phenoShared.

**Block-C note:** PhenoMCP disposition SUPERSEDE (#164); terminal runtime → PhenoMCPServers + substrate.

## Package map

| Legacy path | Canonical package | Install |
|-------------|-------------------|---------|
| `python/pheno-mcp` (HexaKit) | [PhenoMCP](https://github.com/KooshaPari/PhenoMCP) `python/src/pheno_mcp` | `pip install git+https://github.com/KooshaPari/PhenoMCP.git` or clone + `pip install -e .` |
| `python/pheno-mcp` (HexaKit/phenoShared) | **PhenoMCP** submodule / `phenotype-python-sdk` `packages/mcp-kit` | pip from PhenoMCP or SDK `[connect]` extras (see below) |
| `python/pheno-mcp` (Pyron vendored) | PhenoMCP | Drop vendored tree; redirect manifest |

HexaKit and Pyron legacy trees are **pointer stubs** only — see `MIGRATED.md` in wave3-eviction worktrees.

## phenotype-python-sdk package map

| SDK path | Role | Notes |
|----------|------|-------|
| `packages/mcp-kit/` | Py MCP kit umbrella (McpKit absorption) | Python binding lives in PhenoMCP submodule (`python/pheno-mcp`); Rust `mcp-forge` codegen in kit |
| `packages/mcp-kit/rust/` | Rust MCP framework surface | Registry-driven bindings; not the runtime server plane |
| substrate `crates/phenotype-mcp` | Rust MCP **runtime** canonical | [substrate#28](https://github.com/KooshaPari/substrate/pull/28) — connect role SSOT |

**Install via SDK workspace:**

```bash
# Preferred: canonical PhenoMCP package
git clone --recurse-submodules https://github.com/KooshaPari/PhenoMCP.git
cd PhenoMCP && pip install -e .

# Or from phenotype-python-sdk mcp-kit submodule path
cd phenotype-python-sdk/packages/mcp-kit/python/pheno-mcp
pip install -e '.[dev]'
```

Optional extras on `phenotype-python-sdk` root (when published): `[connect]` pulls MCP kit edges per [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md) `connect` role.

## Disposition closure

| Field | Value |
|-------|-------|
| Registry row | `py-pheno-mcp` |
| Target | **substrate** (Rust runtime) + PhenoMCP (Py library) |
| FSM | **done** |
| PR | substrate#28 |

Do not add new dependents on HexaKit `python/pheno-mcp` or phenoShared Python paths.
