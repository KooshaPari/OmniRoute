# Release Tag Command

## Tag Command

To cut a release for this project:

```bash
# For Rust projects
cargo run -p release-cut -- v<VERSION> --execute

# For Node projects
npm version <patch|minor|major>

# For documentation projects
git tag v<VERSION>
```

## Dry-Run

A dry-run validation runs automatically on any PR that touches:
- `Cargo.toml` (Rust)
- `package.json` (Node)
- Documentation files (Specs)

The workflow is defined in `.github/workflows/release-dry-run.yml`.

## Recovery

If the release fails midway:

1. **Rust projects**: `cargo run -p release-cut -- rollback v<VERSION>`
2. **Node projects**: `npm install` and re-run version bump
3. **Specs**: Delete the tag and reset: `git tag -d v<VERSION>`

## Reference

- **phenotype-tooling**: `repos/phenotype-tooling/crates/release-cut/README.md`
- **Org-wide adoption**: `repos/docs/governance/release_cut_adoption.md`
