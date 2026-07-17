# KaskMan Dashboard Scripts (vendor snapshot, 2026-07-05)

## Source
- Repo: `KooshaPari/KaskMan` (GitHub-archived 2026-07-05, strict pause)
- Local source: `KaskMan/` (top-level polyrepo checkout)
- Vendor date: 2026-07-05
- Vendor agent: root (manager lane)

## Why vendored
The polyrepo portfolio strategy session (D4) marked KaskMan for strict-pause
archive. Its irreplaceable scripts (claude-flow + the dashboard-*.js/.* family)
are preserved here so the work survives the archive. The history remains in
the original GitHub repo; this is an in-repo snapshot for convenience only.

## Files
- `claude-flow` (693B) -- orchestration helper
- `dashboard-launcher.js` (19.2K) -- CLI entry point
- `dashboard-demo.js` (13.5K) -- demo mode
- `dashboard-server.js` (17.6K) -- HTTP server
- `dashboard-tui.js` (14.4K) -- TUI mode
- `dashboard-web.js` (26.5K) -- web UI server
- `dashboard-web.html` (14.9K) -- web UI template
- `dashboard-web.css` (15.9K) -- web UI styles
- `dashboard-memory.json` (9.0K) -- default memory seed
- `dashboard-package.json` (1.3K) -- standalone package manifest

## Strict pause rules
Per the archive notice in the original repo, this snapshot MUST NOT be
revived. If a new project needs the same capabilities, fork from this
snapshot, rename, and add a fresh STRICT-PAUSE banner at the new home.

## Pointer
- Decision record: `docs/sessions/2026-07-05-polyrepo-portfolio-strategy/05-decisions/`
- Archive PR: see `phenotype-org-audits` PRs for the vendor commit
