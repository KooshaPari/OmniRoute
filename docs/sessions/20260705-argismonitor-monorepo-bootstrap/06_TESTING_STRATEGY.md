# 06_TESTING_STRATEGY

| Layer | Test | Tool | Goal |
|---|---|---|---|
| shared-types | roundtrip + kbridge parity | Vitest | Zod 100% covered; matches Rust Request enum exactly |
| sdk-js | client + kbridge + sse | Vitest + msw | Type-safe RPC; SSE parser resilient |
| apps/web | hono routes | Vitest + msw | /api/* validation + auth + ratelimit |
| apps/web | components | Vitest + @testing-library/svelte | CombosGrid, ProvidersList, etc. |
| apps/web | e2e | Playwright | dashboard, login, combo resolve, chat stream |
| crates/gateway | kbridge_client | tokio::test + tempdir | Mock Unix server roundtrip |
| crates/gateway | process | cargo test | Spawn no-op binary, assert supervise |
| crates/gateway | ipc | cargo test | Each tauri::command with mock state |
| tools/scripts | sync-env | Vitest | .env validation against Zod |
| tools/scripts | parity | Vitest | Drift detection between Zod ↔ Rust JSON schemas |
| tools/scripts | codegen | Vitest | Output is valid TS that imports into sdk-js |
