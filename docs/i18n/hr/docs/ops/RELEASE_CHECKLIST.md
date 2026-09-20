# RELEASE_CHECKLIST (Hrvatski)

**Languages:** [English](../../../../ops/RELEASE_CHECKLIST.md) · [ar](../../../ar/docs/ops/RELEASE_CHECKLIST.md) · [az](../../../az/docs/ops/RELEASE_CHECKLIST.md) · [bg](../../../bg/docs/ops/RELEASE_CHECKLIST.md) · [bn](../../../bn/docs/ops/RELEASE_CHECKLIST.md) · [cs](../../../cs/docs/ops/RELEASE_CHECKLIST.md) · [da](../../../da/docs/ops/RELEASE_CHECKLIST.md) · [de](../../../de/docs/ops/RELEASE_CHECKLIST.md) · [el](../../../el/docs/ops/RELEASE_CHECKLIST.md) · [es](../../../es/docs/ops/RELEASE_CHECKLIST.md) · [et](../../../et/docs/ops/RELEASE_CHECKLIST.md) · [fa](../../../fa/docs/ops/RELEASE_CHECKLIST.md) · [fi](../../../fi/docs/ops/RELEASE_CHECKLIST.md) · [fr](../../../fr/docs/ops/RELEASE_CHECKLIST.md) · [ga](../../../ga/docs/ops/RELEASE_CHECKLIST.md) · [gu](../../../gu/docs/ops/RELEASE_CHECKLIST.md) · [he](../../../he/docs/ops/RELEASE_CHECKLIST.md) · [hi](../../../hi/docs/ops/RELEASE_CHECKLIST.md) · [hu](../../../hu/docs/ops/RELEASE_CHECKLIST.md) · [id](../../../id/docs/ops/RELEASE_CHECKLIST.md) · [it](../../../it/docs/ops/RELEASE_CHECKLIST.md) · [ja](../../../ja/docs/ops/RELEASE_CHECKLIST.md) · [ko](../../../ko/docs/ops/RELEASE_CHECKLIST.md) · [lt](../../../lt/docs/ops/RELEASE_CHECKLIST.md) · [lv](../../../lv/docs/ops/RELEASE_CHECKLIST.md) · [mr](../../../mr/docs/ops/RELEASE_CHECKLIST.md) · [ms](../../../ms/docs/ops/RELEASE_CHECKLIST.md) · [mt](../../../mt/docs/ops/RELEASE_CHECKLIST.md) · [nl](../../../nl/docs/ops/RELEASE_CHECKLIST.md) · [no](../../../no/docs/ops/RELEASE_CHECKLIST.md) · [phi](../../../phi/docs/ops/RELEASE_CHECKLIST.md) · [pl](../../../pl/docs/ops/RELEASE_CHECKLIST.md) · [pt](../../../pt/docs/ops/RELEASE_CHECKLIST.md) · [pt-BR](../../../pt-BR/docs/ops/RELEASE_CHECKLIST.md) · [ro](../../../ro/docs/ops/RELEASE_CHECKLIST.md) · [ru](../../../ru/docs/ops/RELEASE_CHECKLIST.md) · [sk](../../../sk/docs/ops/RELEASE_CHECKLIST.md) · [sl](../../../sl/docs/ops/RELEASE_CHECKLIST.md) · [sr](../../../sr/docs/ops/RELEASE_CHECKLIST.md) · [sv](../../../sv/docs/ops/RELEASE_CHECKLIST.md) · [sw](../../../sw/docs/ops/RELEASE_CHECKLIST.md) · [ta](../../../ta/docs/ops/RELEASE_CHECKLIST.md) · [te](../../../te/docs/ops/RELEASE_CHECKLIST.md) · [th](../../../th/docs/ops/RELEASE_CHECKLIST.md) · [tr](../../../tr/docs/ops/RELEASE_CHECKLIST.md) · [uk-UA](../../../uk-UA/docs/ops/RELEASE_CHECKLIST.md) · [ur](../../../ur/docs/ops/RELEASE_CHECKLIST.md) · [vi](../../../vi/docs/ops/RELEASE_CHECKLIST.md) · [zh-CN](../../../zh-CN/docs/ops/RELEASE_CHECKLIST.md) · [zh-TW](../../../zh-TW/docs/ops/RELEASE_CHECKLIST.md)

---

---

title: "Kontrolna Lista Izdanja"
version: 3.8.51
lastUpdated: 2026-08-28
---

## Rollback

If release has critical issue:

1. `gh release edit vX.Y.Z --prerelease` (marks as not latest)
2. `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z` (only if not yet adopted by users)
3. Or: hotfix on `release/vX.Y.0` → patch release `vX.Y.(Z+1)`
4. Communicate in GitHub Discussions and Discord immediately

## Hard Rules

- Never commit directly to `main`
- Never use `git push --force` to `main` or `release/*` branches
- Never skip Husky hooks (`--no-verify`)
- Never commit secrets, credentials, or `.env` files
- Coverage must stay ≥60/60/60/60 (statements/lines/functions/branches)
- Always include or update tests when changing production code in `src/`, `open-sse/`, or `bin/`

## Automated Sync Check

Run the docs sync guard locally before opening a PR:

```bash
npm run check:docs-sync
```

CI also runs this check in `.github/workflows/ci.yml` (lint job).
