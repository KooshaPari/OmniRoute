# Fork divergence summary — 2026-09-03T07:24:02Z

## Counts

| Property | Value |
|---|---|
| Upstream | `upstream/main` |
| Fork commits ahead | **26** |
| Portable (`W-class: P`) | 15 |
| Fork-only (`W-class: F`) | 9 |
| Blocking (`W-class: B`) | 0 |
| Unclassified | **2** (action: classify or rewrite trailer) |
| Files changed | 11808 |
| Insertions / deletions | +690912 / -957924 |

## Top touched files

| Hits | Path |
|---|---|
| 5 | `package-lock.json` |
| 4 | `.github/workflows/auto-release.yml` |
| 4 | `package.json` |
| 4 | `README.md` |
| 3 | `.github/workflows/docker-publish.yml` |
| 3 | `.github/workflows/infisical.yml` |
| 3 | `.github/workflows/nightly-dispatch-bench.yml` |
| 3 | `.github/workflows/nightly-release-green.yml` |
| 3 | `.github/workflows/nightly.yml` |
| 3 | `.github/workflows/quality.yml` |
| 3 | `pnpm-lock.yaml` |
| 3 | `bin/cli/commands/setup-qwen.mjs` |
| 3 | `scripts/dev/responses-ws-proxy.mjs` |
| 3 | `config/quality/eslint-suppressions.json` |
| 2 | `.github/workflows/build-fork.yml` |
| 2 | `.github/workflows/build-rinseaid-image.yml` |
| 2 | `.github/workflows/chaos-weekly.yml` |
| 2 | `.github/workflows/contract-weekly.yml` |
| 2 | `.github/workflows/cyclonedx-weekly.yml` |
| 2 | `.github/workflows/cyclonedx.yml` |
| 2 | `.github/workflows/electron-release.yml` |
| 2 | `.github/workflows/fuzz-ci.yml` |
| 2 | `.github/workflows/fuzz-weekly.yml` |
| 2 | `.github/workflows/k6-load-test.yml` |
| 2 | `.github/workflows/l21-bom-diff.yml` |

## Portable commits (cherry-pick candidates)

- `4b35640433d9` fix(ci): W9.19 release-drafter dry-run + W9.25 rollback playbook + workflow
- `0f38ab3b3f36` fix(ci): W9.15 Docker smoke test in auto-release + docker-publish (W9.15)
- `bec28574a3bc` fix(ci): W9.04 SHA-pin 121 action refs + W9.08 SLSA L3 attest + W9.10 CVE gate
- `8d1e1d49066f` fix(i18n): add 17 truly-missing EN source values to en.json (W2.x, #12272 partial)
- `5d12042313a3` fix(docker): pin TLS_CLIENT_VERSION=1.16.0 + verify installed version (W2.x, fixes #12084 CVE-2025-68121)
- `5ddff4a879a6` fix(ci): add least-privilege permissions: to 2 workflows + gitleaks/trufflehog secret-scan before npm publish (W9.06, W9.14)
- `0d261472b6fc` fix(ci): concurrency: false on nightly/auto-release — fix artifact-truncation on cron re-trigger (W9.05)
- `379d58fb6fc2` docs(adr-001): enrich frontmatter + governance reference
- `35526edc4719` feat(core): complete retry and quota recovery follow-ups (#711)
- `6da8329cbc7b` fix: restore provider and validation APIs (#700)
- `a0ebfabe4608` fix(open-sse): remove duplicate function definitions in perplexity-web.ts (#707)
- `79d5bf2fd6ec` chore(deps-dev): bump browserslist from 4.28.2 to 4.28.7 (#705)
- `321a89412892` fix(scripts): close missing braces/parens in mjs files (#706)
- `b05166853bc9` docs(readme): add AI slop inside + downloads badges (#702)
- `bf65512098f3` fix: complete retry and quota recovery follow-ups (#699)

## All commits (unclassified at top)

- `9fb91e8bc291` [unclassified] feat(intelligence): W10 upstream-PR factory — pr-candidates.mjs + digest + tracker (W10.01, W10.02, W10.07)
- `872f6ad9f1bf` [unclassified] feat(ci): upstream-intel script + fork-drift-warning workflow (W1.10, W1.13)
- `1ebd7ea3f6e9` [F] feat(docs+demo): 4-quadrant VitePress site + GUI walkthrough + stress test
- `374b7d266e3c` [F] chore(deps): dependabot bump (#714)
- `92fda49ff187` [F] chore(deps): dependabot bump (#713)
- `90843b57fa7f` [F] fix(ci): install jq before Trunk Check (#712)
- `d77bb2c84d19` [F] fix(skills): align computeCoverage cli total with 21-skill catalog
- `48d968c91618` [F] fix: repair #706 syntax corruption blocking CLI build (#709)
- `ac39a91a2f0e` [F] fix(skills): add missing cli-skill-collector catalog entry
- `2738bb252624` [F] feat(core): complete retry and quota recovery follow-ups (#708)
- `83a358c3804c` [F] feat(desktop): sign + notarize OmniRoute.app via Tauri 2 release pipeline (#703)
- `4b35640433d9` [P] fix(ci): W9.19 release-drafter dry-run + W9.25 rollback playbook + workflow
- `0f38ab3b3f36` [P] fix(ci): W9.15 Docker smoke test in auto-release + docker-publish (W9.15)
- `bec28574a3bc` [P] fix(ci): W9.04 SHA-pin 121 action refs + W9.08 SLSA L3 attest + W9.10 CVE gate
- `8d1e1d49066f` [P] fix(i18n): add 17 truly-missing EN source values to en.json (W2.x, #12272 partial)
- `5d12042313a3` [P] fix(docker): pin TLS_CLIENT_VERSION=1.16.0 + verify installed version (W2.x, fixes #12084 CVE-2025-68121)
- `5ddff4a879a6` [P] fix(ci): add least-privilege permissions: to 2 workflows + gitleaks/trufflehog secret-scan before npm publish (W9.06, W9.14)
- `0d261472b6fc` [P] fix(ci): concurrency: false on nightly/auto-release — fix artifact-truncation on cron re-trigger (W9.05)
- `379d58fb6fc2` [P] docs(adr-001): enrich frontmatter + governance reference
- `35526edc4719` [P] feat(core): complete retry and quota recovery follow-ups (#711)
- `6da8329cbc7b` [P] fix: restore provider and validation APIs (#700)
- `a0ebfabe4608` [P] fix(open-sse): remove duplicate function definitions in perplexity-web.ts (#707)
- `79d5bf2fd6ec` [P] chore(deps-dev): bump browserslist from 4.28.2 to 4.28.7 (#705)
- `321a89412892` [P] fix(scripts): close missing braces/parens in mjs files (#706)
- `b05166853bc9` [P] docs(readme): add AI slop inside + downloads badges (#702)
- `bf65512098f3` [P] fix: complete retry and quota recovery follow-ups (#699)

## How to use this manifest

- `node bin/cherry-pick-portable.mjs` — replay the portable set onto `upstream/main`
- `node bin/classify-commit.mjs <SHA> <P|F|B>` — set a commit's W-class trailer
- `node bin/upstream-intel.mjs` — refresh the daily intelligence digest