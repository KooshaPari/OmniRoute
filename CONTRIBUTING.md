# Contributing to NanoVMS (Nano Virtual Machine Services)

First off, thank you for considering contributing to **NanoVMS** — it's
people like you who make this project better for everyone. NanoVMS is a
Go-based runtime and CLI for 3-tier isolation (WASM, gVisor, Firecracker)
and is part of the [Phenotype](https://github.com/KooshaPari) ecosystem.

This is the canonical contributor guide. It supersedes the shorter
`CONTRIBUTING.md` you may have seen on older branches (which had
copy-paste terminal escape codes that made the rendered Markdown
unreadable). For agent-specific operating procedures, see `AGENTS.md`
and `CLAUDE.md` in this repo.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Project Layout](#project-layout)
3. [Prerequisites](#prerequisites)
4. [Development Setup](#development-setup)
5. [Build](#build)
6. [Test](#test)
7. [Lint, Format, and Quality Gates](#lint-format-and-quality-gates)
8. [Coverage](#coverage)
9. [Commit Message Format (Conventional Commits)](#commit-message-format-conventional-commits)
10. [Branch and PR Process](#branch-and-pr-process)
11. [Code Review](#code-review)
12. [Reporting Issues](#reporting-issues)
13. [Security Disclosures](#security-disclosures)
14. [License](#license)

---

## Code of Conduct

By participating, you agree to abide by the [Phenotype Code of
Conduct](https://github.com/KooshaPari/phenotype-org-governance/blob/main/CODE_OF_CONDUCT.md).
Be respectful. Assume good intent. Keep technical disagreement on the
technical merits.

## Project Layout

```
nanovms/
├── api/                  # API contracts (proto + generated Go)
├── go/                   # Go runtime and library code
│   ├── cmd/              # CLI entrypoints (nanovms, nanovmsd, …)
│   ├── internal/         # Private packages
│   └── pkg/              # Public packages
├── sdk/                  # Generated SDK clients (Go + TS)
├── docs/                 # VitePress docs (Node tooling)
├── scripts/              # Repository automation
├── tests/                # Integration tests + fixtures
├── .github/
│   ├── workflows/        # CI, scorecard, secret-scan, dependabot
│   ├── CODEOWNERS        # Per-area ownership
│   └── FUNDING.yml       # Sponsor links
├── package.json          # Node tooling (VitePress)
├── go.mod                # Go module definition
├── Taskfile.yml          # Task runner (preferred)
├── justfile              # Just runner (CI mirror)
├── Makefile              # Legacy (use Taskfile instead)
├── SPEC.md
├── ARCHITECTURE.md
├── AGENTS.md
├── CLAUDE.md
├── CHANGELOG.md
├── CODEOWNERS            # Root-level ownership alias
├── CONTRIBUTING.md       # This file
├── SECURITY.md           # Security policy
└── LICENSE
```

## Prerequisites

- **Go** 1.23+ (install via [go.dev/doc/install](https://go.dev/doc/install))
- **Node.js** 20+ (only for VitePress docs)
- **pnpm** or **bun** (CI uses pnpm)
- **Task** ([taskfile.dev](https://taskfile.dev/installation/)) — preferred
  task runner
- **just** ([just.systems](https://just.systems/)) — CI mirror
- **git** 2.40+
- A POSIX shell

Verify your toolchain:

```bash
go version         # go version go1.23 linux/amd64 (or similar)
node --version     # v20+
pnpm --version     # 9.x
task --version     # 3.x
just --version     # 1.x
git --version
```

## Development Setup

```bash
# 1. Clone
git clone https://github.com/KooshaPari/nanovms.git
cd nanovms

# 2. Fetch Go deps
go mod download

# 3. Install Node deps (docs only)
pnpm install        # or: bun install

# 4. Verify the workspace builds
go build ./...

# 5. Run a smoke test
go test ./... -run TestSmoke
```

### Recommended shell aliases

```bash
alias nv='cd /path/to/nanovms'
alias nvtest='go test -race ./...'
alias nvlint='golangci-lint run ./... && gofmt -l . | (! grep .)'
```

## Build

NanoVMS is a single Go module. The Taskfile and justfile are the
canonical task definitions; `Makefile` is kept for legacy callers and
will be removed in a future release.

```bash
# Go-native
go build ./...
go build -o bin/nanovms ./go/cmd/nanovms
go build -o bin/nanovmsd ./go/cmd/nanovmsd

# Task runner (preferred)
task build           # builds all binaries into ./bin
task build:nvms      # one binary
task clean

# Just (CI mirror)
just build

# Cross-compile (Linux primary, Mac secondary)
GOOS=linux GOARCH=amd64 go build -o bin/nanovms-linux ./go/cmd/nanovms
GOOS=darwin GOARCH=arm64 go build -o bin/nanovms-mac ./go/cmd/nanovms
```

## Test

```bash
# Unit + integration
go test ./...

# With race detection (CI default)
go test -race ./...

# With coverage
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
go tool cover -html=coverage.out -o coverage.html

# A single test
go test ./... -run TestSessionCreate -v

# Verbose
go test -v ./go/internal/backend/...

# Skip integration (network-bound) tests
go test -short ./...
```

## Lint, Format, and Quality Gates

```bash
# Format
gofmt -s -w .
goimports -w .

# Vet
go vet ./...

# Lint (golangci-lint v2 config in .golangci.yml)
golangci-lint run ./...

# Vulnerability scan (Go vuln DB)
govulncheck ./...

# Pre-commit (gitleaks + trufflehog + gofmt + goimports + golangci-lint)
pre-commit run --all-files
```

CI runs the same set. CI also runs the `scorecard` and `codeql`
workflows weekly and posts findings to the `#security` Discord channel.

## Coverage

```bash
# Coverage profile + func summary
go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out

# HTML report
go tool cover -html=coverage.out -o coverage.html

# Per-package summary
go test -cover ./... | grep -E '^ok|FAIL'
```

Coverage target on `cmd/` packages is **≥ 80%**. Drops below 70% need
a PR-body justification.

## Commit Message Format (Conventional Commits)

NanoVMS uses [Conventional Commits 1.0.0](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <short summary>

<body — wrap at 72 columns>

<footer>
```

### Allowed types

| Type       | Purpose                                                  |
|------------|----------------------------------------------------------|
| `feat`     | New user-visible feature                                 |
| `fix`      | Bug fix                                                  |
| `docs`     | Documentation only                                       |
| `style`    | Formatting (no logic change)                             |
| `refactor` | Code restructure (no behavior change)                   |
| `perf`     | Performance improvement                                  |
| `test`     | Adding or fixing tests                                   |
| `build`    | Build system / dependency change                         |
| `ci`       | CI configuration                                         |
| `chore`    | Maintenance, tooling, governance                         |
| `revert`   | Revert a previous commit                                 |

### Scopes (recommended)

`api`, `backend`, `cli`, `daemon`, `wasm-runtime`, `gvisor`,
`firecracker`, `image`, `sdk`, `docs`, `ci`, `governance`.

### Examples

```
feat(backend): add firecracker adapter with snapshot resume

fix(daemon): close image handle on session end (leak)

docs(arch): add sequence diagram for session creation

chore(governance): add CODEOWNERS, CONTRIBUTING, SECURITY, FUNDING (L2 #30)
```

### Breaking changes

```
feat(api)!: rename SessionConfig.MemMiB to SessionConfig.MemoryMib

BREAKING CHANGE: callers must use MemoryMib (camelCase) instead of
MemMiB. Migration: rg 'MemMiB' --type go | xargs sed -i '' 's/MemMiB/MemoryMib/g'
```

## Branch and PR Process

### Branch naming

- `feat/<short-kebab>` — new feature
- `fix/<short-kebab>` — bug fix
- `chore/<short-kebab>` — maintenance, deps, governance
- `docs/<short-kebab>` — documentation
- `refactor/<short-kebab>` — code restructure
- `hotfix/<short-kebab>` — urgent production fix

### Workflow

1. **Branch** off `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/your-feature
   ```
2. **Develop** in small, focused commits.
3. **Run the full quality gate** locally:
   ```bash
   gofmt -s -l . | (! grep .) && \
     go vet ./... && \
     go test -race ./... && \
     golangci-lint run ./... && \
     govulncheck ./...
   ```
4. **Push** and **open a PR** against `main`:
   ```bash
   git push -u origin feat/your-feature
   gh pr create --base main --title "feat(scope): short summary" \
     --body-file .github/PULL_REQUEST_TEMPLATE.md
   ```
5. **Address review** in additional commits (no force-push during
   review).
6. **Squash-merge** via the GitHub UI; the squash commit MUST follow
   conventional-commits format.

### PR requirements (CI will enforce)

- [ ] Title matches `<type>(<scope>): <summary>`
- [ ] Body references the issue / spec (`Closes #123`)
- [ ] At least 1 approving review from a CODEOWNER
- [ ] CI green: `gofmt`, `go vet`, `go test -race`, `golangci-lint`,
  `govulncheck`, `scorecard`
- [ ] Coverage delta documented (or target met)
- [ ] No new `TODO` without a tracking issue

## Code Review

Reviewers should:

- **Be specific** — quote the line, suggest the fix, link the doc.
- **Distinguish** blocking from non-blocking (prefix `[blocking]` or
  `[nit]`).
- **Approve explicitly** — use the GitHub "Approve" button.

Authors should:

- **Respond to every comment** — push a fix or explain why not.
- **Keep the diff small** — split a 1500-line PR into stacked PRs.
- **Self-review first** — read your own diff in the GitHub PR view.

Review SLA: 1 business day for the first round. If a reviewer is
unreachable, ping `@KooshaPari` to reassign.

## Reporting Issues

Use the GitHub issue templates under `.github/ISSUE_TEMPLATE/`. Always
include:

- NanoVMS version (`nanovms --version`)
- OS and architecture (`uname -a`)
- Go toolchain (`go version`)
- Reproduction steps (the smallest possible snippet)
- Expected vs. actual behavior
- Relevant logs (`NVMS_LOG_LEVEL=debug nanovms …`)

## Security Disclosures

For sensitive vulnerabilities, **do not open a public issue**. Follow
the process in [`SECURITY.md`](./SECURITY.md). Acknowledgment within
48 hours, triage decision within 7 days.

## License

By contributing, you agree that your contributions will be licensed
under the **MIT OR Apache-2.0** license (dual-licensed, at the option
of downstream consumers). See [`LICENSE`](./LICENSE) for the full text.

---

Questions? Open a discussion at
https://github.com/KooshaPari/nanovms/discussions or reach out to
@KooshaPari on the Phenotype Discord.
