# 05_KNOWN_ISSUES

| Issue | Severity | Status | Mitigation |
|---|---|---|---|
| Storage Hono routes are stubs (return `[]`) | P1 | open | Lane F |
| Provider/combo persistence in SQLite | P1 | open | Lane F + omniroute-storage crate |
| Kbridge protocol parity test uses stub schemas | P2 | open | Real `cargo run --bin export-schemas` once backend exposes it |
| `app.d.ts` placeholder for `PageData` shape | P3 | open | Refine when persisted user model lands |
| Auth uses a `dev` cookie shortcut | P2 | open | Real session storage in lane F |
| Tray icon is a 1x1 PNG placeholder | P3 | open | `cargo tauri icon` in CI |
| `apps/desktop` capabilities may not match Tauri 2.4 ACL exactly | P2 | open | Verify after first `tauri dev` run |
