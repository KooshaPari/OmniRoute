# GitHub Actions Runner Policy

All workflows in this repository must use self-hosted runners only.

Required labels:
- Linux: `[self-hosted, linux, x64]`
- Windows: `[self-hosted, windows, x64]`
- macOS arm64: `[self-hosted, macos, arm64]`

Any hosted label (e.g. `ubuntu-*`, `windows-*`, `macos-*`) is prohibited in executable jobs.