## Summary
Second #392 slice (stacked on #449 auth/CORS/tRPC):

- Register KBridge inflight waiters **before** socket write (closes fast-reply race)
- Enforce request deadlines (`KBRIDGE_TIMEOUT_MS`, default 5s) and `AbortSignal` cancellation
- Document Windows transport: named pipe `\\.\pipe\omniroute-gateway` via `OMNIROUTE_GATEWAY_SOCKET` (same `net.connect(path)` API as Unix sockets)
- Unit tests for path resolution, race registration, timeout, and abort

## Test plan
- [x] `bunx vitest run src/kbridge/client.test.ts` (5/5)
- [ ] CI Build on this PR
- [ ] Merge after #449 (or rebase onto `main` once #449 lands)

Depends on / stacks with: #449
