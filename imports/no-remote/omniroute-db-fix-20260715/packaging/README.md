# Publishing — ArgisMonitor

> **Status (Gate 4, file-only):** every registry's manifest is in
> `packaging/<registry>/`. The publish side fires from
> `.github/workflows/argismonitor-publish.yml` (npm + GitHub Packages)
> and `tools/publish-all.sh` (brew / choco / winget / crates / npm
> deprecate-all). No actual `npm publish` runs until you greenlight
> Gate 4 with a fresh `NPM_TOKEN` and `CARGO_REGISTRY_TOKEN`.

## Registry matrix

| Registry | Manifest path | Trigger | Required secret | First-time gate |
|----------|---------------|---------|-----------------|-----------------|
| npm (registry.npmjs.org) | `package.json` `name` = `argismonitor` | tag `v*` released | `NPM_TOKEN` | publish to `argismonitor@1.0.0` |
| npm (deprecated alias) | `packaging/npm/deprecate-omniroute.sh` | manual after GA | `NPM_TOKEN` | deprecate legacy `omniroute` |
| GitHub Packages | `.github/workflows/argismonitor-publish.yml` (publish step) | tag `v*` released | `GITHUB_TOKEN` | automatic on tag |
| Homebrew tap | `packaging/homebrew/argismonitor.rb` | tag `v*` released | `HOMEBREW_TAP_TOKEN` | push to `KooshaPari/homebrew-tap` |
| Chocolatey | `packaging/chocolatey/argismonitor.nuspec` + `tools/chocolateyinstall.ps1` | tag `v*` released | `CHOCOLATEY_API_KEY` | `choco push` after pack |
| winget | `packaging/winget/README.md` (manifest template) | tag `v*` released | `WINGET_TOKEN` (auto-bot) | PR to `microsoft/winget-pkgs` |
| crates.io | n/a — this is a Node package | n/a | n/a | n/a |
| Docker Hub | `.github/workflows/docker-publish.yml` (existing) | tag `v*` released | `DOCKERHUB_USERNAME` / `_TOKEN` | reuse existing |

## Install paths

| Surface | One-liner |
|---------|-----------|
| npm | `npm install -g argismonitor` |
| Homebrew | `brew install KooshaPari/tap/argismonitor` |
| Chocolatey | `choco install argismonitor` |
| winget | `winget install --id=KooshaPari.ArgisMonitor -e` |
| irm (PowerShell) | `iwr -useb https://argismonitor.phenotype.space/install.ps1 \| iex` |
| curl (POSIX) | `curl -fsSL https://argismonitor.phenotype.space/install.sh \| bash` |

## Deprecation order

1. **First publish** of `argismonitor@1.0.0` (Gate 4).
2. **Run** `packaging/npm/deprecate-omniroute.sh` once to mark every
   `omniroute@*` as deprecated.
3. **6 months later** (Gate 7+), the legacy `omniroute` binary is removed
   and the npm deprecation transitions to a redirect stub.

See [`docs/RENAMES-STRATEGY.md`](./../RENAMES-STRATEGY.md) § 7 for the
end-of-life criteria.

## Secrets checklist

Apply via `gh secret set --repo KooshaPari/ArgisMonitor <NAME>`:

- [ ] `NPM_TOKEN` — npm automation token, `read+publish` on `argismonitor`
- [ ] `HOMEBREW_TAP_TOKEN` — fine-grained PAT scoped to `KooshaPari/homebrew-tap` (Contents: Read+Write)
- [ ] `CHOCOLATEY_API_KEY` — chocolatey.org push API key
- [ ] `WINGET_TOKEN` — not needed; PR bot handles this via fork+PR
- [ ] `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` — already set in `KooshaPari/OmniRoute`

## Apply checklist (manual, once per release)

1. Tag a release: `git tag v3.8.45 && git push --tags`.
2. GitHub Actions runs `argismonitor-publish.yml` — publishes to npm + GitHub Packages + Docker Hub.
3. Manually run `tools/publish-all.sh v3.8.45` to push Homebrew + Chocolatey + winget + deprecate alias.

## File-only proof (this gate)

Everything below is in-tree; no registry write has been performed:

```
packaging/
├── README.md                  ← this file
├── homebrew/
│   └── argismonitor.rb        ← Homebrew formula (push to KooshaPari/homebrew-tap)
├── chocolatey/
│   ├── argismonitor.nuspec    ← Chocolatey package metadata
│   └── tools/
│       └── chocolateyinstall.ps1
├── winget/
│   └── README.md              ← winget manifest templates + apply instructions
└── npm/
    └── deprecate-omniroute.sh ← one-shot legacy-deprecation script
```

## Reference

- Companion: [`UPDATE-STRATEGY.md`](./../UPDATE-STRATEGY.md) for the
  in-app + CLI update flow that consumes these registries.
- Companion: [`FORK.md`](./../FORK.md) for the AI-DD / HITL-less context
  that determines who actually fires these publishes.