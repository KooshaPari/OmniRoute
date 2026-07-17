# Contract: Registry Adapter Interface

**Date**: 2026-03-01
**Feature**: 002-org-wide-release-governance-dx-automation

---

## Adapter Interface

Every registry adapter implements these operations:

### `Detect(repoPath) → []Package`

Scan a repository path for publishable packages. Returns all detected packages with their metadata.

- Rust: Parse `Cargo.toml` (workspace members if workspace), check `publish` field
- Python: Parse `pyproject.toml`, check classifiers for `Private :: Do Not Upload`
- Node: Parse `package.json`, check `private` field
- Go: Parse `go.mod`, detect module path
- Elixir: Parse `mix.exs`, detect hex package config
- Zig: Parse `build.zig.zon`, detect package metadata
- Mojo: Parse `mojoproject.toml` (stub — return empty)

### `Version(baseVersion, channel, increment) → string`

Calculate the registry-specific pre-release version string.

- Input: base version (`0.2.0`), target channel (`beta`), increment (`1`)
- Output: registry-formatted version (`0.2.0b1` for PyPI, `0.2.0-beta.1` for crates.io)

### `Build(package) → BuildResult`

Build the package artifact for publishing.

- Rust: `cargo package`
- Python: `python -m build`
- Node: `npm pack`
- Go: N/A (Go proxy pulls from VCS)
- Elixir: `mix hex.build`

### `Publish(package, version, credentials) → PublishResult`

Publish the built artifact to the registry.

- Must handle: rate limits (retry with backoff), auth errors (fail fast), network errors (retry 3x)
- Must verify: clean working tree, correct version, package not private
- Returns: success/failure, registry URL, error details

### `Verify(package, version) → bool`

Confirm the published version is available on the registry.

- Poll registry API until version appears or timeout (5 min)
- Used to gate workspace dependency publishing (publish leaf → verify → publish dependents)

---

## Adapter Registry

| Adapter | Manifest | Status | Registry |
|---------|----------|--------|----------|
| `CratesAdapter` | `Cargo.toml` | Active | crates.io |
| `PyPIAdapter` | `pyproject.toml` | Active | PyPI |
| `NpmAdapter` | `package.json` | Active | npm |
| `GoProxyAdapter` | `go.mod` | Active | proxy.golang.org |
| `HexAdapter` | `mix.exs` | Pre-wired | hex.pm |
| `ZigAdapter` | `build.zig.zon` | Pre-wired | Git tags |
| `MojoAdapter` | `mojoproject.toml` | Pre-wired (stub) | N/A |

## Error Handling

All adapters return structured errors:

| Error Type | Behavior |
|------------|----------|
| `RateLimited` | Retry with exponential backoff (1s, 2s, 4s, 8s, 16s). Max 5 retries. |
| `AuthError` | Fail immediately. Log credential hint. |
| `NetworkError` | Retry 3x with 5s delay. |
| `AlreadyPublished` | Skip (idempotent). Log as info. |
| `PrivatePackage` | Skip (expected). Log as debug. |
| `BuildError` | Fail immediately. Show build output. |
| `DirtyWorkTree` | Fail immediately. Never publish from dirty state. |
