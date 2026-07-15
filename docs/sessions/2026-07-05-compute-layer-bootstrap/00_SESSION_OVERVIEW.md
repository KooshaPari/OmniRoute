# 2026-07-05 Compute-Layer Bootstrap -- Session Overview

## Sponsor direction (verbatim, distilled)

- "You own all backend/api/sdk/cli etc non-frontend aspects of [OmniRoute] fork and finishing the optimal/mature/enterprise/prod grade version"
- "NVMS/phenocompose and other layers should sit below as relevant. BytePort remains a deep evolution ... I do NOT own byteport nor omniroute, solely the absorptions"
- "start compute layer"
- "spawn agents via task tool as needed. audit and plan. remember how we feel about code: rust/go/zig/mojo"
- "5 yes skip omni till after 6"
- Existing root plans (01-06) define: Authvault delete, AtomsBot/KaskMan/GDK strict-pause archive, org-audits + apps promoted to spine, phenodag redirect to AgilePlus+Tracera
- AuthKit migration guide (3548a54) and phenodag redirector already shipped in HEAD

## Owns (this session)

| Domain | Owner | Action |
|--------|-------|--------|
| Compute-layer stack (nanovms, PhenoCompose, Eidolon, KDesktopVirt, Tracely) | this session | audit, plan, evolve to mature/enterprise |
| Absorptions (phenodag->AgilePlus/Tracera, AtomsBot/GDK/KaskMan archive, Authvault delete) | this session | execute per root 01-06 plans |
| org-audits + apps spine-promote | this session | execute per root 02 + 03 plans |
| BytePort surface | USER (not this session) | we provide compute primitives, they own the surface |
| OmniRoute fork | USER (not this session) | skip until after item 6 (absorptions complete) |

## Stack preferences (sponsor)

- Preferred languages (in order): **Rust > Go > Zig > Mojo > TS/Python for glue**
- "Always use oxlint/oxc/void zero + bun ts7/tsgo stacks" (TS work)
- No backwards-compat shims, no migration cruft
- No ESLint
- Production-grade, mature, enterprise from day one
- Manager mode: parent coordinates, child agents do decomposable work
- Cockpit with top bracket, progress trees, DAG, agent table, next-steps

## What "compute layer" means here

A polyrepo of compute primitives that BytePort will sit on top of. It must:
1. Provide container + microVM + unikernel orchestration across multiple substrates
2. Abstract AWS / GCP / Vercel / Supabase / Fly / bare-metal / local as fungible providers
3. Expose a stable Rust+Go surface SDK
4. Keep TypeScript/React frontends OUT of scope (those are BytePort's domain)
5. Ship with observability, dispatch, scheduling, and policy gates that match enterprise bar

## Subagent lanes (this turn)

| Lane | Agent | Goal |
|------|-------|------|
| compute-stack-audit | audit-1 | Map current state of nanovms / PhenoCompose / Eidolon / KDesktopVirt / Tracely: maturity, gaps, redundancies, deps |
| byteport-requirements | audit-2 | What compute primitives does BytePort need that don't yet exist? Cross-ref with BytePort ARCHITECTURE.md |
| multi-cloud-research | audit-3 | Web research: AWS/GCP/Vercel/Supabase/Fly compute patterns, microVM orchestration 2026, polyrepo compute SDK design |
| absorption-execution | audit-4 | Apply root plans 01-06: Authvault tag+archive, AtomsBot/KaskMan/GDK strict-pause banners, phenodag redirect, org-audits+apps spine charter blocks |

## Success criteria (this session)

- Compute-layer audit + plan documents land in this session folder
- All absorptions executed (commits pushed, gh archive + topics set where possible)
- A spec for the next-generation compute SDK exists with cross-provider abstractions
- Cockpit reports updated on every step
- Parent agent remains in coordinator mode, does NOT hand-edit code

