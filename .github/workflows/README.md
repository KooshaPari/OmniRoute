# GitHub Actions Runner & CI Billing Policy

OmniRoute GitHub Actions workflows now run on GitHub-hosted Ubuntu runners only.

Allowed `runs-on` label:
- `ubuntu-24.04`

Disallowed in executable jobs:
- self-hosted runners
- Windows runners
- macOS runners
- Containerized execution (`container:` jobs), Podman, and WSL

Local-first enforcement:
- `.github/workflows/local-first-ci.yml` validates the committed local manifest on `push` and on labeled PRs.
- `pre-push` writes gate proof artifacts to `.ci/local-first-ci-gates/` (one `*.proof.json` and one `*.log.txt` per gate) and hashes those proofs into `.ci/local-first-ci-manifest.json`.
- CI-heavy workflows must include the `ci-billing-exception` label to run on pull requests; by default they are not eligible for PR billing.
- Add `local-first-ci` on PRs to enforce local manifest verification (`.ci/local-first-ci-manifest.json`) policy.
