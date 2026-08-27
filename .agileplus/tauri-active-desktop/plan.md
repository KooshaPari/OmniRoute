# Tauri Active Desktop Work Packages

| WP   | Scope                                     | Depends on      | Exit evidence                                         | State                       |
| ---- | ----------------------------------------- | --------------- | ----------------------------------------------------- | --------------------------- |
| WP01 | Tauri shell and typed lifecycle commands  | approved design | commit touching `apps/desktop/src-tauri` + cargo test | in_review                   |
| WP02 | Active desktop policy and docs            | WP01            | `check:active-desktop`, docs diff                     | in_review                   |
| WP03 | Browser/Tauri parity fixtures             | WP01            | shared fixture tests                                  | planned                     |
| WP04 | Routing and response-healing parity       | WP03            | deterministic integration matrix                      | planned                     |
| WP05 | Hosted CI, PR review, and packaging       | WP01-WP04       | PR/run IDs, macOS artifact                            | blocked by hosted execution |
| WP06 | Upstream disposition and human acceptance | WP05            | reviewed merge and acceptance record                  | planned                     |

## Current blockers

1. AgilePlus live daemon/CLI is unavailable in this checkout; the fallback
   ledger is authoritative only for this branch and must be reconciled through
   the canonical engine when restored.
2. Hosted workflow failures (qgate, Scorecard, Windows Rust build, and startup
   failures) remain external gates and are not silently marked fixed.
