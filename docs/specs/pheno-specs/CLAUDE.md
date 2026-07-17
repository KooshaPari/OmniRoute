# PhenoSpecs

Unified specification registry for the Phenotype ecosystem. Central source of truth for design specifications, requirements documents, ADRs, and API contracts across all Phenotype projects.

## Stack
| Layer | Technology |
|-------|------------|
| Content | Markdown (CommonMark) |
| Publishing | VitePress (GitHub Pages) |
| CI | GitHub Actions |
| Validation | markdownlint, link checking |
| Registry | Flat file system (specs/) |

## Key Commands
```bash
# Browse specs
ls specs/                          # Top-level domains
ls specs/<domain>/                  # Domain specs (auth, crypto, etc.)
cat specs/<domain>/<spec>.md        # Read a spec

# Validate
npm run lint                       # markdownlint
npm run docs:build                 # VitePress build

# Docs dev
cd docs && npm install && npm run docs:dev
```

## Key Files
- `specs/` — Specification source files organized by domain
- `specs/auth/` — Authentication domain specs
- `specs/crypto/` — Cryptography domain specs
- `specs/api/` — API contract specs
- `docs/` — VitePress documentation site
- `.github/workflows/legacy-tooling-gate.yml` — Quality gate workflow

## Reference
Global Phenotype rules: see `~/.claude/CLAUDE.md` or `/Users/kooshapari/CodeProjects/Phenotype/repos/CLAUDE.md`
