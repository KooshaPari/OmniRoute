# GitHub Actions Runner & CI Billing Policy

OmniRoute GitHub Actions workflows now run on GitHub-hosted Ubuntu runners only.

Allowed `runs-on` label:
- `ubuntu-24.04`

Disallowed in executable jobs:
- self-hosted runners
- Windows runners
- macOS runners
- Containerized execution (`container:` jobs), Podman, and WSL

Lightweight local-first enforcement:
- `.github/workflows/local-first-ci.yml` validates the committed local manifest on `push` and on labeled PRs.
- CI-heavy workflows must include the `ci-billing-exception` label to run on pull requests; by default they are not eligible for PR billing.
- Add `local-first-ci` on PRs to enforce local manifest verification (`.ci/local-first-ci-manifest.json`) policy.
