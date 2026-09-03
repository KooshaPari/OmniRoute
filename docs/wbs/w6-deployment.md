# W6 — Deployment, Ops, Observability

**Wave:** W6
**Priority:** P2
**Generated:** 2026-09-02

## W6.1 — Multi-Stage Dockerfile Polish (P1)

**Why:** Current Dockerfile pulls `node:20-bookworm` and never prunes; the image is ~1.2GB.

**What:** Multi-stage build with:
1. `node:20-bookworm-slim` for runtime (~150MB base)
2. `node:20-bookworm` for build
3. `--ignore-scripts` during install (skip the native postinstalls in the runtime)
4. `dumb-init` for proper PID 1 signal handling
5. Healthcheck: `HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1`

**Files:** `Dockerfile`, `.dockerignore`

**Acceptance:**
- [ ] Final image <400MB
- [ ] Container starts and serves /healthz
- [ ] `docker run` survives SIGTERM and exits cleanly

**Verify:** `docker build -t omniroute:test . && docker run --rm -p 3000:3000 omniroute:test`

---

## W6.2 — docker-compose for Local Dev (P2)

**Why:** New contributors need `docker compose up` to work.

**What:** `docker-compose.yml` with the app, a redis cache, and an ollama LLM.

**Files:** `docker-compose.yml`, `docker-compose.override.example.yml`

**Acceptance:**
- [ ] `docker compose up` brings up a working stack
- [ ] README references this in the "Local dev" section

**Verify:** `docker compose up -d && curl localhost:3000/v1/chat/completions ...`

---

## W6.3 — GitHub Actions: Auto-Deploy on Tag (P2)

**Why:** Currently deploys are manual.

**What:** A new workflow that on `v*` tag:
1. Builds the multi-arch image
2. Pushes to GHCR
3. Posts a comment to the release

**Files:** `.github/workflows/deploy-on-tag.yml`

**Acceptance:**
- [ ] Tag `v1.2.3-test` triggers the workflow
- [ ] Image appears in `ghcr.io/kooshapari/omniroute:v1.2.3`
- [ ] Comment posted on the release

**Verify:** `git tag v1.2.3-test && git push --tags`

---

## W6.4 — SBOM Generation (P1)

**Why:** Security review requires a software bill of materials.

**What:** CycloneDX SBOM generated in CI, attached to every release.

**Files:** `scripts/ci/sbom.sh`, `.github/workflows/sbom.yml`

**Acceptance:**
- [ ] CycloneDX JSON + SPDX tag-value uploaded to the release
- [ ] SBOM includes every runtime dep

**Verify:** Download from the latest release, validate with `cyclonedx-cli validate`

---

## W6.5 — Cosign Signing (P1)

**Why:** Image integrity. Without signatures, anyone can publish a `v1.2.3` that points to malicious code.

**What:** `cosign sign --keyless` on every push to GHCR. Verification instructions in the README.

**Files:** `.github/workflows/cosign-sign.yml`, `docs/security/IMAGE_VERIFICATION.md`

**Acceptance:**
- [ ] Every image has a signature in the registry
- [ ] `cosign verify --certificate-identity ...` succeeds
- [ ] README has the verify command

**Verify:** `cosign verify ghcr.io/kooshapari/omniroute:main --certificate-identity-regexp ".*"`

---

## W6.6 — Prometheus Metrics (P2)

**Why:** Production observability.

**What:** A `/metrics` endpoint with `prom-client`. Metrics:
- `omniroute_requests_total{provider,model,status}`
- `omniroute_request_duration_seconds{provider,model,le}`
- `omniroute_active_streams`
- `omniroute_token_cache_hits_total`

**Files:** `src/observability/metrics.ts`, `src/server/routes/metrics.ts`

**Acceptance:**
- [ ] `/metrics` returns valid Prometheus text
- [ ] All four metrics present and labeled
- [ ] Scrape interval-friendly (1s updates)

**Verify:** `curl localhost:3000/metrics | grep omniroute_`

---

## W6.7 — OpenTelemetry Tracing (P2)

**Why:** Distributed tracing across providers.

**What:** OTLP exporter, with spans for: http receive → auth → rate-limit → provider call → response. Sampled at 1% by default.

**Files:** `src/observability/tracing.ts`

**Acceptance:**
- [ ] Each request gets a trace ID returned in `X-Trace-Id` header
- [ ] Spans visible in a Honeycomb/Tempo test instance
- [ ] Sampler configurable via `OTEL_SAMPLER=always|probability`

**Verify:** `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 npm start`
