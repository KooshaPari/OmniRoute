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

grade-fast:
    @echo "=== Running fast grade ==="
    ./grade.sh --fast

grade-json:
    @echo "=== Running grade (JSON) ==="
    ./grade.sh --json

grade-html:
    @echo "=== Running grade (HTML) ==="
    ./grade.sh --html
