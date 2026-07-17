# ADR 0001 — Routing-layer boundary: phenotype-gateway, phenotype-router, OmniRoute

- **Status:** PROPOSED (awaiting sponsor go/no-go on the convergence direction)
- **Date:** 2026-06-29
- **Source:** v37 fleet encyclopedia audit (`audits/2026-06-26-v37/_META-RETROSPECTIVE.md` §5)
- **Deciders:** sponsor (boundary call) + routing maintainers
- **Tracking:** issue #64

---

## Context

The v37 audit found three repos in the org that all sit on the "routing" concern, with
overlapping-but-not-identical responsibilities and no documented boundary between them:

| Repo | Audit role | Score | What it actually is today |
|------|-----------|-------|---------------------------|
| **OmniRoute** | Live routing layer | 2.19 (L3) | 993-commit value-fork; the real, deployed transport/blend layer — provider dispatch, fallback, combo strategies, SSE. Highest-maturity repo in the fleet. |
| **phenotype-router** | Decision kernel | (mid-L2) | A routing *decision* kernel (policy/scoring "which target") — complementary to, not a duplicate of, OmniRoute's transport. |
| **phenotype-gateway** | Gateway scaffold | 0.84 (early/L1) | Thin, largely-unbuilt gateway scaffold. Redundant with OmniRoute's ingress in intent; little independent runtime. |

The risk is **uncoordinated drift**: three repos converging on the same concern, callers
unsure which to depend on, and `phenotype-gateway` accreting scope that OmniRoute already owns.

## Decision drivers

- OmniRoute is the proven, deployed implementation — it should not be destabilized by a blind merge.
- `phenotype-router` provides a genuinely distinct capability (the *decision*, not the *transport*).
- `phenotype-gateway` is the weakest of the three and the clearest consolidation candidate.
- Org policy: forward-only migration (extract → update callers → delete duplicate), never a destructive rewrite.

## Considered options

1. **Blind-merge all three into OmniRoute.** Rejected — destroys the clean decision/transport
   separation and risks the most mature repo in the fleet.
2. **Keep all three independent.** Rejected — perpetuates the drift and caller confusion the audit flagged.
3. **Converge with a defined boundary (RECOMMENDED).** Keep router as the decision kernel, fold the
   gateway into OmniRoute, integrate via a thin adapter. Preserves what works, removes the redundant repo.

## Decision (PROPOSED)

Adopt option 3 — a **three-way boundary**, not a merge:

- **OmniRoute = transport + blend (the data plane).** Owns provider dispatch, fallback, combo
  routing, streaming. Remains the deployed product. Drop the "tracking-fork" framing — it is a value-fork.
- **phenotype-router = decision kernel (the control plane).** Owns "which target, under which policy" —
  scoring, policy, cost rules. OmniRoute consumes router decisions; router does not move bytes.
- **phenotype-gateway → fold into OmniRoute.** Its ingress responsibilities are a subset of OmniRoute's.
  Migrate any unique gateway logic into OmniRoute, then **deprecate** phenotype-gateway (archive, do not delete).
- **Integration seam: a stubbed `BifrostAdapter`** in OmniRoute is the convergence point where the
  router's decision kernel plugs into OmniRoute's transport. Implementing it is the concrete first step (#64 → P2.6).

```
                ┌──────────────────────┐
  request ─────►│ OmniRoute (transport)│◄── decisions ── phenotype-router (kernel)
                │  dispatch/fallback/  │                  scoring · policy · cost
                │  combo · SSE         │
                └──────────┬───────────┘
                           │  BifrostAdapter (seam)
                phenotype-gateway → folded in, then deprecated/archived
```

## Consequences

**Positive:** one data plane, one control plane, one fewer redundant repo; clear caller guidance
(depend on OmniRoute for transport, router for decisions); no destabilizing merge.

**Negative / risk:** requires implementing `BifrostAdapter` (non-trivial); migrating gateway logic
must be inventoried first so nothing unique is lost before deprecation.

**Follow-on work:** P2.6 (implement BifrostAdapter, fold gateway, deprecate) is gated on this ADR
being ACCEPTED.

## Sponsor go/no-go (the gate)

This ADR is **PROPOSED**, not ACCEPTED. The boundary direction — especially *folding phenotype-gateway
into OmniRoute* and *router-as-control-plane* — is an ownership-impacting decision per the org
Cross-Project Reuse Protocol. **No code convergence (P2.6) should begin until the sponsor confirms
this boundary.** Open questions for the sponsor:

1. Confirm OmniRoute as the single data plane (drop gateway as an independent ingress)?
2. Confirm phenotype-router as the decision kernel OmniRoute consumes (vs. inlining decisions into OmniRoute)?
3. Approve deprecating + archiving phenotype-gateway after its unique logic is migrated?
