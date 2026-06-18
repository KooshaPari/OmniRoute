# Phenotype Apps

Extracted from `apps/` subdir of `KooshaPari/FocalPoint` (the meta-repo) on 2026-06-17 per ADR-023 (agent-effort governance: apps are self-repod).

## Contents

26 files, ~1.7 MB total, 446-commit history preserved (via `git subtree split`).

### iOS shell

- `ios/FocalPoint/Assets.xcassets/AppIcon.appiconset/Contents.json` — iOS AppIcon catalog manifest
- `ios/FocalPoint/Assets.xcassets/AppIcon.appiconset/icon-*.png` — 9 PNG icons (60x60@2x, 60x60@3x, 76x76@1x, 76x76@2x, 83.5x83.5@2x, 1024x1024@1x)

### Web shell

- `web/public/favicon.ico` — browser favicon
- `web/public/icon-{16,32,48,512}.png` — 4 PNG icons at common web sizes
- `web/public/logo.svg` — SVG logo

### Governance (open-source standards)

- `CHANGELOG.md` — version history (Keep-a-Changelog format)
- `CODE_OF_CONDUCT.md` — community standards
- `CONTRIBUTING.md` — contribution guide
- `LICENSE` — MIT license
- `SECURITY.md` — security policy
- `.github/CODEOWNERS` — code ownership
- `.github/ISSUE_TEMPLATE/bug_report.md` — bug report template
- `.github/ISSUE_TEMPLATE/config.yml` — issue chooser config
- `.github/ISSUE_TEMPLATE/feature_request.md` — feature request template
- `.github/ISSUE_TEMPLATE/question.md` — question template
- `.github/ISSUE_TEMPLATE/security_report.md` — security report template

## What this repo IS

- The **shell assets + governance** for iOS and web Phenotype apps.
- 26 files (1.7 MB total).
- 446-commit history preserved (via `git subtree split`).

## What this repo is NOT

- **NOT** the actual iOS app source code. The Swift sources, Xcode project, and UniFFI bindings live in `KooshaPari/FocalPoint` branches (e.g., `chore/focalpoint-ios-untrack-build-artifacts`, `feat/focalpoint-ios*`).
- **NOT** the actual web app source code. The marketing site (`focalpoint-web`) lives in its own branch on the meta-repo.
- **NOT** the Rust core. That lives in `phenoShared` (the polyglot SSOT).

## Why extracted

Per ADR-023 Rule 1: "apps are self-repod" — apps want to be advertised/self-branded, so they don't fold into a collection at maturity; they keep their own repo. This repo is the proper home for app shell assets.

## Adding new app shell assets

1. Branch from `apps-extract` (the default branch).
2. Add your asset (PNG, SVG, JSON, etc.).
3. Update `Contents.json` if adding to the iOS AppIcon catalog.
4. Open a PR.
5. After merge, no further action needed — files are immediately live.

## Provenance

Extracted via:
```bash
git subtree split --prefix=apps --annotate="(apps-extract)" -b apps-extract-final
git push --set-upstream origin apps-extract-final:apps-extract --force
```

Original commits remain intact in `KooshaPari/FocalPoint` history.
