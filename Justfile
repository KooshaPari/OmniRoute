# phenotype-registry justfile
# VitePress registry documentation

set shell := ["bash", "-uc"]

# List available recipes
default:
    @just --list

# Start VitePress dev server with hot reload
dev:
    bun run docs:dev

# Build the VitePress static site
build:
    bun run docs:build

# Preview the built site locally
preview:
    bun run docs:preview

# Run the test suite
test:
    @echo "No tests defined for phenotype-registry docs site"

# Lint Markdown
lint:
    bunx markdownlint-cli "**/*.md"

# Apply formatter
fmt:
    bunx prettier --write "**/*.md" "**/*.json" "**/*.mjs"

# Remove build artifacts
clean:
    rm -rf docs/.vitepress/cache docs/.vitepress/dist .vitepress/cache .vitepress/dist
    @echo "Cleaned VitePress build artifacts"

# Grade targets (strictest checks — no caching)
grade:
    @echo "=== Running full grade ==="
    ./grade.sh

# Validate the 13 canonical KooshaPari repos: GitHub reachability + meta-file
# presence. Reports drift and exits non-zero on any miss.
validate:
    @echo "=== Validating ecosystem (13 canonical repos) ==="
    ./scripts/validate-ecosystem.sh

validate-json:
    @echo "=== Validating ecosystem (JSON output) ==="
    ./scripts/validate-ecosystem.sh --json

validate-quiet:
    @echo "=== Validating ecosystem (no color) ==="
    ./scripts/validate-ecosystem.sh --no-color

grade-fast:
    @echo "=== Running fast grade ==="
    ./grade.sh --fast

grade-json:
    @echo "=== Running grade (JSON) ==="
    ./grade.sh --json

grade-html:
    @echo "=== Running grade (HTML) ==="
    ./grade.sh --html
