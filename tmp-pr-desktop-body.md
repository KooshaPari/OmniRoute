## Summary
- Path-filter **Electron Package Smoke** so it runs on PRs only when `electron/**` (or Electron smoke scripts) change.
- Keep **Electrobun** as the ADR-ECO-015 canonical desktop spike; extend `desktop-electrobun.yml` to watch `apps/desktop/**` and `main` pushes.
- Clarify READMEs: new desktop work is Electrobun (or a Tauri spike), not Electron.

## Test plan
- [ ] Change Classification emits `electron=false` on this PR (no Electron smoke job).
- [ ] Electrobun desktop workflow runs because `desktop-electrobun/**` / workflow paths changed.
- [ ] Confirm Electron smoke still runs on `main` pushes and on electron-only PRs.
