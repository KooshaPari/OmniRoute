# Master Synthesis -- Polyrepo Audit + Plan

**Session:** 2026-07-05 fork-rewrite + portfolio audit
**Date:** 2026-07-05 02:30Z -- 03:04Z
**Author:** root (manager)
**Mode:** Sponsor-facing. Top bracket first, then evidence.

```
[omniroute wip 72% | byteport wip 58% | phenodag wip 70% -> synth ok |
 triage done x4 | authkit keep / authvault archive | org-audits spine |
 apps spine | 3 strict-pause archive | 2 deep audits still running |
 1 research queued | 0 blocked-on-deps | 0 failed]
```

## Effective progress

```
Polyrepo audit+plan     ########....  ~78%   4/7 lanes done, 3/3 deep audits wip
+- L1 OmniRoute reqwrite  #######.... ~72%   audit deep-running; Rust/Go split pending
+- L2 Byteport Surface    ######..... ~58%   plan deep-running; substrate trait drafted
+- L3 Phenodag absorb     #######.... ~70%   spec-level merge plan deep-running
+- L4 AuthKit/Authvault   ########## 100%   DONE -- KEEP AuthKit, ARCHIVE Authvault
+- L5 org-audits spine    ########## 100%   DONE -- spine charter drafted
+- L6 apps spine          ########## 100%   DONE -- spine charter + prune plan
+- L7 Archive 3 repos     ########## 100%   DONE -- strict-pause banner template ready
```

## Source-of-truth files (this turn)

| Lane | File | Bytes | Status |
|------|------|-------|--------|
| L4   | `04-triage/01-AUTH-TRIAGE.md` | 5390 | DONE |
| L5   | `04-triage/02-ORG-AUDITS-PLAN.md` | 4326 | DONE |
| L5'  | `2026-07-05-polyrepo-portfolio-strategy/04-plans/01-phenotype-org-audits-spine.md` | 2813 | DONE (prior subagent) |
| L6   | `04-triage/03-APPS-PLAN.md` | 3598 | DONE |
| L6'  | `2026-07-05-polyrepo-portfolio-strategy/04-plans/02-phenotype-apps-spine.md` | 3357 | DONE (prior subagent) |
| L7   | `04-triage/04-ARCHIVE-PLAN.md` | 5465 | DONE |
| L7'  | `2026-07-05-polyrepo-portfolio-strategy/05-decisions/01-authvault-vs-authkit.md` | 4112 | DONE (prior subagent) |
| ALL  | `04-triage/00-EXECUTIVE-SUMMARY.md` | 4436 | DONE |
| OPS  | `04-triage/05-MIGRATION-CHECKLIST.md` | 6006 | DONE (5 phases, ready to execute) |
| RISK | `04-triage/06-RISKS-AND-OPEN-QUESTIONS.md` | 4957 | DONE (R-1..R-6, 6 open Qs) |
| L1-L3 wip | `01-omniroute/*.md`, `02-byteport/*.md`, `03-phenodag/*.md` | -- | IN FLIGHT |

## Decisions awaiting sponsor (6 quick yes/no)

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | Keep AuthKit, delete Authvault | YES (AuthKit README self-declares successor; c7994b9 self-archive marker) |
| D2 | Promote `phenotype-org-audits` as audit/inventory spine | YES (165-repo registry, no other spine can host whole-org view) |
| D3 | Promote `phenotype-apps` as apps-catalog spine | YES (324+ entries, meta-portfolio, one-stop catalog) |
| D4 | Archive AtomsBot/GDK/KaskMan with strict-pause README + GitHub Archived | YES (banner template already exists in phenotype-apps/GDK/README.md) |
| D5 | Byteport scope: Surface only, or Surface + identity? | Surface only; integrate with AuthKit for identity |
| D6 | Phenodag deletion: hard-archive or thin-redirector for 1 release? | thin redirector for 1 release, then archive |
| D7 | OmniRoute language split | Rust hot-path + Go orchestration + TS SDK glue + Zig FFI; Mojo not used (no production HTTP stack 2026-07) |
| D8 | Strangler-fig for OmniRoute rewrite | YES; parallel-run 1 quarter behind feature flag |

## Top risks (sponsor awareness)

- **R-A** PhenoCompose (55/100 D+) and nanovms (52/100 D+) are the layer below
  Byteport. Byteport Surface 100% cannot land until both lift. Currently the
  compute layer is the bottleneck.
- **R-B** 2 deep audits still running (OmniRoute, Byteport). Phases 0-1
  (Authvault delete, AtomsBot/GDK/Kaskman archive) can start TODAY without
  them; they only block the OmniRoute rewrite phases.
- **R-C** `apps-extract` branch on phenotype-apps is in flight; prune may
  collide. Coordinate with branch owner before mutating.
- **R-D** Subagent slot ceiling (4) is binding. Research pack is queued.
- **R-E** `04-ARCHIVE-PLAN.md` references `KooshaPari/KaskMan`; on disk the
  top-level dir is `KaskMan/` (capital M, capital K). Case-correct before commit.

## Cross-project topology (current -> target)

```
                                          HUMAN (sponsor)
                                                |
                          +---------------------+---------------------+
                          |                     |                     |
                  phenotype-org-audits    phenotype-apps        OmniRoute
                  (audit/inventory SPINE)  (apps catalog SPINE)  (non-frontend reqwrite
                  165-repo registry        324+ meta-portfolio   to enterprise Rust/Go)
                          |                     |
                  (consumed by)          (consumed by)
                          \                     /
                           \\                   ////
                          substrate   AgilePlus  Tracera
                          (dispatch)  (cockpit)  (trace)
                                \\         |         ////
                                 \\        |        ////
                                BytePort (Surface 100%)
                                 |     \\   |   ////
                                 |      \\  |  ////
                            AuthKit  PhenoCompose  nanovms
                            (KEEP)   (driver+adapter) (OS)
                              |
                         (consumes)
                              |
                        phenotype-sdk / pheno-*
```

Phenodag ->(absorbed into)-> Tracera + AgilePlus ->(phenodag repo)-> thin redirector -> archive
Authvault ->(DELETE)-> AuthKit is canonical (FR-AUTHV-018 SHIPPED; AUT-SOTA-001..007 planned)
AtomsBot/GDK/Kaskman -> strict-pause banner + GitHub Archived + topics

## Open questions for sponsor

1. AuthKit/Authvault -- confirm KEEP AuthKit, DELETE Authvault?
2. Byteport scope -- Surface only, or Surface + identity?
3. Phenodag deletion -- thin redirector 1 release then archive, or force-archive?
4. OmniRoute language split -- accept Rust-hot + Go-orchestration + TS-glue + Zig-FFI?
5. Migration start today -- start Phases 0-1 (Authvault delete + 3-repo archive)
   before deep audits finish, or wait for full plan?
6. Subagent quota -- let all 3 deep audits finish, or kill byteport to spawn research now?

## Next steps (auto, no sponsor action needed)

1. Wait 10-30 more minutes for the 2 remaining deep audits.
2. On completion, fold their findings into
   `2026-07-05-polyrepo-portfolio-strategy/03-audits/`.
3. Synthesize `00_MASTER_PLAN.md` in that session.
4. On sponsor go, execute Phases 0-1 immediately.
   Phases 2-5 (Phenodag absorption, spine charter commits, OmniRoute rewrite
   phases) gated on deeper audit + sponsor sign-off.
