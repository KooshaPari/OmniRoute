# OmniRoute 50-PR Backlog (persisted from 2026-06-22 session scrollback)

**Source:** `log.md:927-1025` (the third "Next Plan" block in that session — never persisted, lived only in chat)
**Date persisted:** 2026-06-23
**Working repo:** `diegosouzapw/OmniRoute` (worktree `omniroute-wtrees/providers-page-memo`)
**Session context:** 50-PR list was synthesized from local evidence after `omni_50_backend_audit` / `omni_50_frontend_audit` / `omni_50_infra_data_audit` subagents stalled without returning. Subagents were interrupted and the list was built from previously-collected evidence.

---

## The 50 PRs

### Backend / Routing (18)

1. Bifrost SSE timeout/error regression tests beyond #4612.
2. Bifrost non-stream response body lifecycle accounting.
3. Bifrost parity audit: TS relay vs sidecar response/error shape.
4. Bifrost upstream retry/fallback metadata consistency.
5. Bifrost auth/rate-limit helpers shared with TS relay.
6. Bifrost request validation extraction from route file.
7. Cliproxy API route health/status normalization.
8. Cliproxy start/stop/restart response contract tests.
9. Provider routing preflight observability events.
10. Provider quota window registry tests across Codex/OpenCode/Bailian.
11. Provider quota monitor backoff and jitter.
12. Provider quota cache invalidation API consistency.
13. Relay usage write batching or async queue.
14. Relay token lookup read-through cache.
15. Relay rate-limit DB contention audit/fix.
16. OpenAI-compatible route request-size guard.
17. Provider error normalization module.
18. Route-level timeout constants/env sync.

### Frontend / Next.js Performance (18)

19. Providers page memoize `getProviderStats` via indexed selectors.
20. Providers page memoize all static entry groups.
21. Providers page extract remaining entry derivation from giant page.
22. Providers page remove in-place sort from error selection.
23. Provider quota widget typed cache contract.
24. Provider quota widget provider grouping `useMemo`.
25. Home dashboard split remaining heavy widgets behind visibility gates.
26. Home dashboard bootstrap fetch audit/reduction.
27. Dashboard settings load waterfall reduction.
28. Dashboard websocket/live polling centralization.
29. Production HAR capture script for dashboard routes.
30. Long-timeout production build profiling script.
31. Next bundle analyzer CI artifact.
32. Dynamic import heavy dashboard-only components.
33. Route-level loading skeleton consistency.
34. Client component boundary reduction audit.
35. Provider cards memoization and stable callbacks.
36. Dashboard search/filter debounce where network-backed.

### Local Services / Infra (14)

37. Redis one-click Docker/Podman detector.
38. Redis GUI start/stop/status polish.
39. Redis CLI start/stop/status command.
40. Dragonfly Redis-compatible option docs + health label.
41. Local service engine abstraction: Docker/Podman.
42. Caddy reverse-proxy local cluster recipe.
43. OmniRoute + Caddy + Redis/Dragonfly compose bundle.
44. NATS sidecar ADR: live sidecar over embedded.
45. NATS local dev compose + env docs.
46. MinIO optional object-storage ADR/config docs.
47. Load-balanced OmniRoute cluster compose example.
48. Health endpoint cluster-readiness contract.
49. Postgres-first vector/search ADR: pgvector + FTS + trigram.
50. Vector backend matrix: Postgres/Qdrant/MinIO/NATS integration paths.

---

## First 10 (in execution order)

1. **#19** providers page indexed stats.
2. **#37** Redis Docker/Podman detector.
3. **#29** HAR capture script.
4. **#44** NATS ADR.
5. **#49** Postgres vector/search ADR.
6. **#1** Bifrost SSE timeout regression tests.
7. **#23** quota widget typed cache contract.
8. **#41** local service engine abstraction.
9. **#31** bundle analyzer artifact.
10. **#47** cluster compose example.

---

## Wave 1 — 4 parallel worktrees (proposed at `log.md:1012-1025`)

| Worktree branch | PRs | What |
|---|---|---|
| `fix/providers-page-indexed-stats` | #19 | memoized provider stats/index selectors |
| `feat/local-service-engine-detect` | #37/#41 | Docker/Podman detector abstraction for local services |
| `chore/dashboard-har-profile` | #29/#30 | long-timeout production build + HAR capture profiling script |
| `docs/search-vector-architecture` | #44/#49/#50 | NATS + Postgres/vector/search ADRs, split if large |

## Wave 2

5. Bifrost SSE timeout/error tests.
6. Quota widget typed cache contract.
7. Bundle analyzer CI artifact.
8. Redis GUI/CLI one-click start wiring.
9. Cluster compose: Caddy + Redis/Dragonfly + OmniRoute.
10. Providers page entry derivation extraction.

---

## Status as of 2026-06-23

| PR | Status | Notes |
|---|---|---|
| **#19** (providers page indexed stats) | **DONE (merged via KooshaPari/OmniRoute#105)** | Implemented as `appendProviderNode` dedup helper + defensive `Set<string>` dedup in `buildCompatibleProviderGroups` + 2 unit tests. Branch `fix/l5-502-providers-page-entry-dedup-2026-06-23`. [PR #105](https://github.com/KooshaPari/OmniRoute/pull/105) |
| **#13** (relay usage write batching) | **DONE (partial, via KooshaPari/OmniRoute#104)** | `ServiceSupervisor` MaxListeners cap raised to 50; companion to leak family. Branch `fix/l5-501-svc-supervisor-max-listeners-cap-2026-06-23`. [PR #104](https://github.com/KooshaPari/OmniRoute/pull/104) |
| **#20** (memoize all static entry groups) | **DONE (via diegosouzapw/OmniRoute#4613)** | Earlier session PR; 3 `useMemo`s collapsed to 1 in `providerPageUtils.ts`. |
| **#15** (relay rate-limit DB contention) | **DONE (via diegosouzapw/OmniRoute#4612)** | Earlier session PR; Bifrost SSE lifecycle + rate-limit handling. |
| Other 46 PRs | **NOT STARTED** | Subagents `omni_50_backend_audit` / `omni_50_frontend_audit` / `omni_50_infra_data_audit` stalled without returning (2026-06-22 session). Audit data not produced; backlog synthesized from local evidence only. |

---

## Subagent stall (open question, 2026-06-22)

The three `omni_50_*_audit` subagents started at `log.md:891-893` did not return. Two "Waiting for agents / No agents completed yet" cycles at `log.md:901-913`, then explicit interrupt at `log.md:918-923`. No retry attempted; no smaller subagent; no `dispatch-worker` fallback.

Output file pattern (`/tmp/dispatch-batch-2026-06-14/agent_*.out`) was empty on re-inspection 2026-06-23, so the subagent output files (if any) were already cleaned up. Probable causes (not verified):

- Subagent prompt exceeded 8k token context (most likely; the 50-item spec was long)
- `dispatch-worker` RPC timeout (60s default; subagent work would have taken longer)
- Local OmniRoute endpoint at `http://localhost:20128/v1` was not reachable at the moment of dispatch
- Auth token rotation between parent and child processes

**Recommended follow-up:** rerun the audit lane-by-lane with a single focused subagent per lane (smaller prompts), piped through `dispatch-worker` with explicit `--timeout 600` and a 1-line spec. Do not bundle all 18 items per lane into one subagent.

---

## Related issues / PRs

- `diegosouzapw/OmniRoute#4746` — providers-page combo-entry accumulation (companion bug, fixed by PR #105)
- `KooshaPari/OmniRoute#104` — `ServiceSupervisor` MaxListeners cap (this session, 2026-06-23)
- `KooshaPari/OmniRoute#105` — providers page dedup helper (this session, 2026-06-23)
- `diegosouzapw/OmniRoute#4612`, `#4613` — prior-session PRs
- `tailcallhq/forgecode#3548` — binary prompt blocker (`application/x-mach-binary`)
- `tailcallhq/forgecode#3549` — `contentscript.js:14083` MaxListeners warning
- `tailcallhq/forgecode#3550` — `busy_timeout = 0` on `.forge.db` (6.6 GB)
