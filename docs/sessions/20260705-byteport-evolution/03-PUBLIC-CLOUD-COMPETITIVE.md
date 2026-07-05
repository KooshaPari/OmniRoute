# Public-Cloud Competitive Scan — 2026 patterns Byteport should adopt

**Date:** 2026-07-05 08:20Z | **Web-research informed; URLs cited**

## 1. Vercel (the reference DX for app deployment)
- **What they got right:** one-click deploys, preview URLs per PR, edge functions, KV/D1/Postgres/Blob storage primitives, AI SDK, agent-friendly docs
- **What Byteport should adopt:** the **preview URL per PR** pattern. PhenoCompose already has PR-driven DAGs; Byteport can wire preview deploys
- **URLs:**
  - https://vercel.com/docs (Vercel docs)
  - https://vercel.com/docs/functions/edge-functions (Edge runtime)
  - https://vercel.com/docs/storage (KV, Postgres, Blob)
  - https://ai-sdk.dev/ (Vercel AI SDK; we have omni-sdk for OmniRoute, not for Byteport)

## 2. Cloudflare (the reference for the "edge + primitives" composite)
- **What they got right:** Workers (V8 isolates), R2 (S3-compatible with no egress), D1 (sqlite-at-the-edge), KV, Pages, Workers AI, Durable Objects
- **What Byteport should adopt:** the **primitives-as-separate-products** pattern. Don't make Byteport one monolith; ship byteport-queue, byteport-blob, byteport-kv, etc as separable primitives with their own pricing/docs
- **URLs:**
  - https://developers.cloudflare.com/workers/ (Workers)
  - https://developers.cloudflare.com/r2/ (R2)
  - https://developers.cloudflare.com/d1/ (D1)
  - https://developers.cloudflare.com/durable-objects/ (Durable Objects)
  - https://blog.cloudflare.com/ (release notes; many patterns)

## 3. Supabase (the reference for "OSS Firebase alternative")
- **What they got right:** Postgres-first, Row-Level Security (RLS), Realtime, Edge Functions, Auth, Storage, Vector (pgvector)
- **What Byteport should adopt:** the **RLS-style row-level authorization** pattern. Every byteport-* object should be org-scoped at the row level, not the API level
- **URLs:**
  - https://supabase.com/docs (Supabase docs)
  - https://supabase.com/docs/guides/auth/row-level-security (RLS)
  - https://supabase.com/docs/guides/database/extensions/pgvector (Vector)
  - https://supabase.com/blog (engineering blog; great patterns)

## 4. SST (the reference for "self-hostable Vercel")
- **What they got right:** Ion (the next-gen SST), Live Lambda (real-time), CDK constructs for AWS, "skip the framework" philosophy
- **What Byteport should adopt:** the **CDK-for-BigCloud** pattern. Byteport is NOT SST (we don't target AWS specifically) but the "ship your own CDK" idea is right
- **URLs:**
  - https://sst.dev/docs (SST docs)
  - https://ion.sst.dev/ (Ion — the new SST)
  - https://github.com/sst/sst (OSS repo)

## 5. Coolify / Dokku / CapRover (the reference for "self-hostable PaaS")
- **What they got right:** Docker-based, single-server, simple to operate, no Kubernetes required
- **What Byteport should adopt:** the **single-binary single-server** deploy mode. Byteport should be installable via `curl | bash` and run on a single VM
- **URLs:**
  - https://coolify.io/docs (Coolify)
  - https://dokku.com/docs (Dokku)
  - https://caprover.com/docs (CapRover)

## 6. Modal / Replicate / E2B (the reference for "AI-first compute")
- **What they got right:** sub-second cold start, image-based, GPU/CPU interchangeable, decorator-style function definition
- **What Byteport should adopt:** the **image-based + sub-second** deploy story. Don't make users write Dockerfile; just point at a binary or an OCI image
- **URLs:**
  - https://modal.com/docs (Modal)
  - https://replicate.com/docs (Replicate)
  - https://e2b.dev/docs (E2B)

## 7. Render / Fly.io (the reference for "Heroku successors")
- **What they got right:** simple deploys, no Kubernetes, regional pinning, persistent volumes, private networking
- **What Byteport should adopt:** the **regional pinning** primitive. A user should be able to say `region: eu-west-1` and get exactly that
- **URLs:**
  - https://docs.render.com (Render)
  - https://fly.io/docs (Fly.io)
  - https://fly.io/docs/reference/regions/ (Fly regions)

## 8. Encore / Wasp (the reference for "framework-aware backend")
- **What they got right:** type-safe APIs from your code (Encore), React+Node+Prisma full-stack (Wasp)
- **What Byteport should adopt:** the **declarative infrastructure derived from code** pattern. Encore reads your Go and generates the infra; Byteport should read the manifest and generate the deployment

## 9. Adopted patterns (the short list)

The 7 patterns Byteport should adopt explicitly:

1. **Preview URL per PR** (Vercel) — wire PhenoCompose PR-DAGs to Byteport preview deploys
2. **Primitives as separate products** (Cloudflare) — ship byteport-queue, -blob, -kv, -otel as separable crates/products
3. **Row-Level Security / org-scoped** (Supabase) — every byteport object is org-scoped at the row level
4. **Self-hostable single-binary** (Coolify/Dokku) — `curl | bash` install, single VM
5. **Image-based + sub-second cold start** (Modal/Replicate) — point at OCI image or binary, no Dockerfile
6. **Regional pinning** (Fly.io) — `region: eu-west-1` declarative
7. **Declarative infra from manifest** (Encore) — manifest → deploy, no UI required

## 10. Anti-patterns to avoid

- **Vendor lock-in** (most clouds) — every Byteport adapter is OSS, swappable
- **Hidden billing** (every cloud) — usage_history is exposed per-org, per-resource
- **Magic AI-DD** (KaskMan, AtomsBot mistakes) — Byteport is documented, debuggable, reproducible
- **Per-tenant dashboards-as-a-service** (Vercel, Cloudflare) — we ship the dashboard, you self-host
- **Closed SDKs** (AWS, Azure) — every Byteport API has an OSS reference client
