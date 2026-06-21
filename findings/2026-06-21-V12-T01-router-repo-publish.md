# V12-T01 Router Repo Publish — phenotype-router spike promotion

**Task:** V12-T01 (Promote `spikes/go/phenotype-router` to production repo at `KooshaPari/phenotype-router`)
**Date:** 2026-06-21
**Author:** Forge (orchestrator-level execution, no destructive ops performed)
**Status:** **HOLD** — verification gate (`builds and tests pass`) FAILS. GitHub repo NOT created. No push performed.

---

## 0. Outcome summary

| Step | Status | Notes |
|------|--------|-------|
| (1) `cd repos/` | OK | cwd = `/Users/kooshapari/CodeProjects/Phenotype/repos` |
| (2) verify build + tests pass | **FAIL** | build exit 1; test exit 1; see § 2 / § 3 |
| (3) `gh repo create KooshaPari/phenotype-router` | **NOT RUN** | gated on (2); skipped to avoid pushing broken code |
| (4) clone spike → `/tmp/pr-build` | **NOT RUN** | gated on (3) |
| (5) `git init` + `git push -u origin main` | **NOT RUN** | gated on (3)+(4) |
| (6) AGENTS.md + README.md + LICENSE-MIT + go.mod validation | **NOT RUN** | gated on (3)+(4) |
| (Output) this findings file | **WRITTEN** | required deliverable; documents HOLD |

**Promotion deferred pending spike maturation.** See § 6 for the unblock criteria.

---

## 1. Spike layout at time of capture (2026-06-21, working tree, untracked)

```
spikes/go/phenotype-router/
├── README.md                                                    72 lines
├── go.mod                                                        3 lines (module github.com/KooshaPari/phenotype-router; go 1.26)
├── e2e/e2e_test.go                                             637 lines
└── internal/
    ├── plugins/toolrouter/
    │   ├── plugin.go                                           181 lines
    │   ├── plugin_test.go                                      305 lines
    │   ├── routing.go                                          146 lines
    │   └── routing_test.go                                     256 lines
    ├── router/
    │   ├── config.go                                           160 lines
    │   ├── hotreload.go                                        388 lines
    │   ├── plugin.go                                           164 lines
    │   └── router.go                                           345 lines
    └── sdk/
        ├── classifier.go                                        53 lines
        └── sdk.go                                              153 lines
```

**Total:** 11 Go files, 2,788 LOC, plus `go.mod` (3 lines) + `README.md` (72 lines). Zero test files in `internal/router/` and `internal/sdk/`. One e2e package.

**Git state:** all 11 files are **untracked** in the working tree (per `git status -uall`). The `repos/` checkout is mid-rebase (`interactive rebase in progress; onto 13ed4b6d81`, branch `wip-2026-06-19-v8-batch-11F-otel-coverage-llms`, 12 of 22 commands done). The spike is being actively mutated by another process — between the first `ls -laR` and the third, file count went 4 → 5 → 13 across the course of this task.

**README references ghost files:** the in-repo `README.md` (which describes itself as "V12-T12 spike") still lists `cmd/routerd/main.go`, `internal/router/hotreload_test.go`, and `testdata/config-{a,b}.toml` — **none of which exist on disk** at capture time. The README is a forward-looking design doc, not a description of the current code.

---

## 2. Build state — FAIL

```
$ go build ./...
# github.com/KooshaPari/phenotype-router/internal/router
internal/router/router.go:33:6: Plugin redeclared in this block
internal/router/plugin.go:124:6: other declaration of Plugin
internal/router/router.go:77:18: replaced.Shutdown undefined (type Plugin has no field or method Shutdown)
internal/router/router.go:93:17: removed.Shutdown undefined (type Plugin has no field or method Shutdown)
internal/router/router.go:257:16: p.Init undefined (type Plugin has no field or method Init)
internal/router/router.go:270:16: p.Init undefined (type Plugin has no field or method Init)
internal/router/router.go:326:44: p.Kind undefined (type Plugin has no field or method Kind)
$ echo $?
1
```

**Root cause:** `internal/router/router.go` and `internal/router/plugin.go` both declare `type Plugin struct {...}`, and `router.go` references methods (`Init`, `Shutdown`, `Kind`) that are not declared on the struct in either file. The `Plugin` interface is split across two files without a coherent definition.

`go vet ./...` confirms the same errors and adds `e2e/e2e_test.go:607:17: cannot use sdk.ClassifierFunc(nil) ... sdk.ClassifierFunc does not implement runner (missing method Config)`.

**Action required:** consolidate the `Plugin` type into a single file (likely `internal/router/plugin.go` since `router.go` already depends on its methods). Either keep both definitions and remove one, or have `router.go` reference an interface defined in `plugin.go` and remove the concrete `Plugin struct` declaration.

---

## 3. Test state — FAIL

```
$ go test ./... -count=1 -timeout 30s
# github.com/KooshaPari/phenotype-router/internal/router
internal/router/router.go:33:6: Plugin redeclared in this block
...
--- FAIL: TestApplyProfile_ReordersByPreferred (0.00s)
    routing_test.go:38: applyProfile reorder = [a b c], want [b a c]
FAIL  github.com/KooshaPari/phenotype-router/internal/plugins/toolrouter  0.260s
--- FAIL: TestE2E_RouterThroughMockOpenAI (0.00s)
    e2e_test.go:465: response.Model = "gpt-4o", want "gpt-4o-mock" (echo from mock)
FAIL  github.com/KooshaPari/phenotype-router/e2e                          0.166s
FAIL  github.com/KooshaPari/phenotype-router/internal/router            [build failed]
?     github.com/KooshaPari/phenotype-router/internal/sdk               [no test files]
$ echo $?
1
```

**Test counts:** 23 PASS / 2 FAIL across 3 packages (excluding the build-broken `router` package which contributes 0 tests). The two failures are:

| Test | Package | Symptom | Likely fix |
|------|---------|---------|------------|
| `TestApplyProfile_ReordersByPreferred` | `toolrouter` | actual `[a b c]`, want `[b a c]` — the reorder is a no-op | inspect `applyProfile` impl in `internal/plugins/toolrouter/routing.go`; the sort/priority logic is not reordering as the test expects |
| `TestE2E_RouterThroughMockOpenAI` | `e2e` | `response.Model = "gpt-4o"`, want `"gpt-4o-mock"` — the mock backend is being bypassed | check the e2e fixture at `e2e/e2e_test.go:465` and the mock wiring; possibly the router is hitting a real provider instead of the mock |

`internal/sdk/` has zero test files — `classifier.go` (53 lines) and `sdk.go` (153 lines) are entirely untested.

**Action required:** fix the two failing tests AND add tests for `internal/router/` and `internal/sdk/`. The spike's test-to-LOC ratio is currently ~20% (561 test LOC / 2,227 src LOC excluding `e2e/`), well below ADR-040's 70% framework floor.

---

## 4. Why the destructive steps were skipped

The non-negotiable verification-before-completion gate is **"`builds and tests pass`"**. Both fail:
- `go build ./...` exits 1 (`Plugin redeclared`, 6 undefined-method errors).
- `go test ./... -count=1 -timeout 30s` exits 1 (2 test failures + the build failure).

Creating `KooshaPari/phenotype-router` as a public repo with the description *"Phenotype router — Bifrost transport + Phenotype decision layer per ADR-050"* and pushing the broken code would:

1. Publish a non-compiling module under the user's GitHub org name (public, irreversible except via `gh repo delete`, which is itself a public action).
2. Ship a module whose README claims test coverage that does not exist.
3. Establish a v0.0.0 commit that future PRs would have to build on top of, multiplying the cleanup cost.
4. Violate the verification-before-completion principle: the gate was specified, it failed, executing the gated steps anyway would be acting against the explicit task precondition.

The token has `delete_repo` scope (verified via `gh auth status`), but the right action is to **not create the artifact in the first place**, not to create-and-delete.

---

## 5. Repo state check (pre-publish)

```
$ gh auth status
github.com
  ✓ Logged in to github.com account KooshaPari (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'delete_repo', 'gist', 'read:org', 'repo', 'workflow'
```

Auth is healthy and has the scopes needed for `gh repo create` (would have worked if the gate passed). No repo was created.

```
$ gh api /repos/KooshaPari/phenotype-router
HTTP 404
```

Repo `KooshaPari/phenotype-router` does not exist yet.

---

## 6. Unblock criteria — what needs to be true before V12-T01 can resume

1. `go build ./...` exits 0 (currently 1) — fix `Plugin` redeclaration + add the 6 missing methods (`Init`, `Shutdown`, `Kind`).
2. `go test ./... -count=1 -timeout 30s` exits 0 (currently 1) — fix `TestApplyProfile_ReordersByPreferred` and `TestE2E_RouterThroughMockOpenAI`.
3. Test coverage meets ADR-040 floor (70% for framework, 80% for lib) — currently `internal/router/` and `internal/sdk/` are 0% covered.
4. README matches reality — either remove the references to `cmd/routerd/main.go`, `hotreload_test.go`, `testdata/` or land those files.
5. Spike is committed to a branch (currently all 11 files are untracked working-tree state) so the publish isn't capturing a moving target.

Once (1)–(4) hold for two consecutive `go build && go test` runs spaced 60 s apart (stability check, since the spike has been actively mutating during this task), V12-T01 can be re-issued. The promotion steps (3)–(6) from the original brief are still valid and can run as-is at that point.

---

## 7. Recommended next action

Run `spikes/go/phenotype-router` to green, commit it to a branch on this monorepo (so the spike has a stable canonical home), then re-issue V12-T01. The promotion itself is mechanical and low-risk once the spike is green.

If the user wants to proceed with a **provisional** v0.0.1-alpha tag despite the failures (e.g. to make a public-facing placeholder visible while the spike matures), that is a policy decision the user should make explicitly — this report does not authorize it.

---

## 8. Cross-references

- ADR-050 / ADR-051 — router architecture decision (Bifrost-as-library + Phenotype-owned decision layer), ACCEPTED 2026-06-20 per AGENTS.md §8.
- ADR-040 — test coverage gates per tier (80 % lib / 70 % framework / 60 % federated).
- AGENTS.md §"App substrate placement (no 'random phenoShared')" — phenotype-router is a federated service under ADR-023 Rule 3.
- `findings/2026-06-21-V12-T15-security-review.md` — prior task captured the spike as non-existent; this task captured it as 13 files / 2,788 LOC / 2 failing tests / 1 build failure. The spike is genuinely under active development.
- v11 closure (`plans/2026-06-20-v11-dag-router-rebuild.md`) — §8 router-architecture decision accepted, L1 (Bifrost `v1.5.21` pin + 9-plugin regression) and L2 (`phenotype-router` v0.1.0) on the 6.5-week critical path.

---

## 9. File inventory of THIS finding

- **Created:** `findings/2026-06-21-V12-T01-router-repo-publish.md` (this file)
- **Modified:** none
- **Deleted:** none
- **External:** no `gh repo create`, no `git push`, no commits authored — repository state on GitHub is unchanged.
- **Local ephemeral:** `/tmp/spike-snapshot/` (stable copy taken during this task for verification; can be removed with `rm -rf /tmp/spike-snapshot`).
