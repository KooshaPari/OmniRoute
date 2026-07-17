# L108–L122 — Packaging, Deployment & Distribution (Cluster C11)

**Tier:** 2 (Time-2 "shippable" contract; a repo is not "done" until a user can install/run/deploy it)
**Sources:** operator Time-2 directive (installed/deployed/published/packaged with QOL: installers, tray clients, auto-update); 12-Factor (build/release/run, deploy parity); AWS Well-Architected (operational readiness); org app-packaging standards (native installer + CLI, Electrobun/Tauri/Dioxus/Qt, OCI-not-Docker, proc-compose)
**Cross-cuts:** L51–L60 (supply-chain/release provenance), L61–L70 (portability/12-factor), L96–L107 (installer/tray visual polish)

## Scope

Can a real user **get** this software and **run** it, on every surface it claims to support, with QOL polish? This category scores the delivery surface end-to-end: installers, CLI packaging, desktop/tray clients, auto-update, code-signing, every deploy target's robustness, the mobile-app question, and release automation. It operationalizes the operator's "deployment/packaging quality/robustness, distribution (mobile app, tray app, similar extraneous asks)" mandate.

Score in context by repo-type profile (CLI / library / service / web-app / desktop / CLI+daemon): a pure library scores L108–L112 on crate/package publishing; a service scores L116–L120 on deploy surfaces; a desktop app scores installers + signing + auto-update. Mark `NOT_APPLICABLE` with a reason where a surface genuinely doesn't apply.

---

## Sub-Pillars

### L108 — Native Installer(s)

**Name:** First-class native installers for every target OS the product claims.

**Acceptance criterion:** For a desktop/GUI app: signed native installers exist per claimed OS — macOS `.app`/`.dmg`, Windows `.msi`/`.exe`, Linux `.deb`/`.rpm`/AppImage — produced by a repeatable build (org standard: Electrobun/Tauri/Dioxus/Qt). Installer actually produces a launchable app (not an exit-0 no-op — see [[feedback_electrobun_codesign_noop_build]]). Verified in a clean checkout.

**Evidence model:**
- Build config produces installers: `grep -rn "dmg\|msi\|deb\|rpm\|AppImage\|bundle" package.json Cargo.toml Taskfile.yml`
- CI matrix builds per-OS artifacts: `.github/workflows/*.yml` with a release/build job producing installers
- Clean-build verification: `rm -rf build && <build> && find . -name '*.app' -o -name '*.dmg' -o -name '*.msi'` yields a real bundle with `Contents/Info.plist` + `Contents/MacOS/*`
- Not a no-op: build exit-0 corroborated by an actual artifact on disk

**Soft-optimizing goal:** One-command release for all OSes; delta installers; installer UX themed (L96–L107); Homebrew cask + winget + Flatpak in addition.

---

### L109 — CLI Packaging & Install Channels

**Name:** The CLI is installable through standard package channels, not "clone and build".

**Acceptance criterion:** The CLI is published/installable via the ecosystem-standard channel: Homebrew tap/formula, `cargo install`, `npm i -g`/`bunx`, `uv tool install`/`pipx`, or `go install` — with a documented one-liner in the README. A pinned version is resolvable; `--version` works.

**Evidence model:**
- Publish config present: `grep -rn "\[\[bin\]\]\|bin\"\s*:" Cargo.toml package.json` + a Homebrew formula / tap ref / crates.io publish
- README has an install one-liner: `grep -rn "brew install\|cargo install\|npm i -g\|uv tool\|pipx install\|go install" README.md`
- `--version`/`-V` implemented: `grep -rn "version\|clap.*version" src/`
- Release workflow publishes to the channel

**Soft-optimizing goal:** Multi-channel (brew + cargo + npm); shell-completions shipped; `self-update` subcommand; checksums + signatures published.

---

### L110 — Tray / Menubar Client

**Name:** Where it fits, a tray/menubar companion for at-a-glance status and quick actions.

**Acceptance criterion:** For daemon/background/monitoring products: a tray (Win/Linux) or menubar (macOS) client exists showing live status and offering quick actions (start/stop, open, quit), with a themed tray icon (L98). This is the operator's explicit "tray app" QOL ask. If the product is genuinely not daemon-shaped, `NOT_APPLICABLE` with reason.

**Evidence model:**
- Tray/menubar code: `grep -rn "tray\|menubar\|SystemTray\|status.*item\|NSStatusItem" src/`
- Tray icon asset present (see L98 icon evidence)
- Quick actions wired (menu items → commands)
- Status reflects live daemon state (not static)

**Soft-optimizing goal:** Tray shows rich live telemetry (thermal/queue/progress — cf. sharecli thermal TUI); notifications on state change; launch-at-login option; tray + CLI + GUI share one core.

---

### L111 — Auto-Update

**Name:** The product can update itself safely.

**Acceptance criterion:** Installed desktop/CLI clients have an update path: an auto-updater (Sparkle/electrobun-updater/tauri-updater), a `self-update` subcommand, or a clearly documented update channel. Updates are signature-verified. Users are not stranded on old versions.

**Evidence model:**
- Updater config/code: `grep -rn "updater\|auto.*update\|self.update\|Sparkle\|appcast" src/ package.json Cargo.toml tauri.conf.json`
- Update manifest/appcast published in the release pipeline
- Signature verification on update: `grep -rn "verify\|signature\|pubkey" <updater config>`
- README documents the update path

**Soft-optimizing goal:** Staged/rolling rollout; delta updates; rollback on failed update; update respects a `--channel stable|beta`.

---

### L112 — Code-Signing & Notarization

**Name:** Artifacts are signed and (macOS) notarized — no scary OS warnings.

**Acceptance criterion:** macOS artifacts are Developer-ID-signed + notarized + stapled; Windows artifacts are Authenticode-signed; the release pipeline performs signing with secrets (not ad-hoc local signing). A user double-clicking the installer sees no Gatekeeper/SmartScreen block. (Ad-hoc `codesign --sign -` is acceptable only as a documented dev-build fallback — see [[feedback_electrobun_codesign_noop_build]].)

**Evidence model:**
- Signing step in release CI: `grep -rn "codesign\|notarytool\|signtool\|Authenticode\|xcrun.*notary" .github/workflows/`
- Secrets referenced (not hardcoded certs): `grep -rn "secrets\.\|APPLE_ID\|CERT" .github/workflows/`
- Notarization + stapling for macOS: `grep -rn "staple\|notarize" .github/workflows/`
- Documented signing process in `docs/` or release runbook

**Soft-optimizing goal:** Hardened runtime + entitlements minimized; timestamped signatures; reproducible signed builds; SLSA provenance on signed artifacts (ties to L51–L60).

---

### L113 — Deploy Surface: Container / OCI

**Name:** A working container image, org-standard OCI (Apple `container`) first.

**Acceptance criterion:** A `Containerfile`/`Dockerfile` builds a minimal, working image that actually boots the service; org standard prefers Apple `container` OCI (native per-container VM) with `Dockerfile`/OrbStack as fallback; image is multi-stage (small final), runs as non-root, and has a healthcheck. `proc-compose`-native local run documented.

**Evidence model:**
- `Containerfile` or `Dockerfile` present and multi-stage: `grep -c "^FROM" Dockerfile Containerfile`
- Non-root user: `grep -rn "USER \|runAsNonRoot" Dockerfile Containerfile`
- Healthcheck: `grep -rn "HEALTHCHECK\|healthcheck" Dockerfile Containerfile compose*.yml`
- Image boots: build succeeds + container responds (cf. Tracera Docker/Caddy proof)
- `proc-compose`/`process-compose` config for local: `ls process-compose.y*ml compose.y*ml`

**Soft-optimizing goal:** Distroless/scratch final stage; SBOM attached to image; image signed (cosign); size-budgeted; `container`-native + Docker both verified.

---

### L114 — Deploy Surface: Serverless / Edge (Vercel / Workers)

**Name:** Serverless/edge deploy targets are configured and proven.

**Acceptance criterion:** Where the product has a web/API surface, edge/serverless targets are wired and deploy successfully: Vercel (`vercel.ts`/`vercel.json`) and/or Cloudflare Workers (`wrangler.toml` with real bindings, not `to-be-set` placeholders — cf. Tracera KV id gap). A deploy produces a reachable URL.

**Evidence model:**
- Config present + real: `ls vercel.ts vercel.json wrangler.toml` and `grep -rn "to-be-set\|TODO\|placeholder" wrangler.toml` returns 0 for binding IDs
- Deploy proof: a recorded deploy URL / preview URL in README or CI output
- KV/D1/R2 bindings have real IDs (Workers) or storage configured (Vercel marketplace)
- Framework detected + build command set

**Soft-optimizing goal:** Preview deploys per PR; edge caching/ISR configured; rollback documented; multi-region.

---

### L115 — Deploy Surface: Traditional Server (Caddy / systemd / Reverse-Proxy)

**Name:** A self-hosted deploy path with a real reverse-proxy config.

**Acceptance criterion:** A self-host path exists: a working `Caddyfile`/nginx config (TLS, correct upstream, forwarded headers), a `systemd` unit or process-manager config, and a runbook. TLS terminates correctly; the reverse proxy forwards to the app upstream without misconfigured load-balancer policy (cf. current branch's caddy lb-policy fix).

**Evidence model:**
- Reverse-proxy config present: `ls Caddyfile nginx.conf` + correct `reverse_proxy`/`upstream` block
- TLS configured (auto or cert paths)
- Forwarded headers / lb policy correct: `grep -rn "forward\|lb_policy\|X-Forwarded" Caddyfile`
- systemd unit or process-compose for the server: `ls *.service process-compose.y*ml`
- Deploy runbook in `docs/`

**Soft-optimizing goal:** Zero-downtime reload; health-gated rollout; config templated per-env; observability sidecar wired.

---

### L116 — Deploy-Surface Parity & Robustness

**Name:** Every claimed deploy surface actually works and is kept in parity.

**Acceptance criterion:** For a product claiming N surfaces (e.g. Tracera's Vercel/Workers/Docker/Apple-container/WSL/desktop), each is proven working (a recorded successful deploy/build), env/secret handling is documented per surface, and there is no "works on laptop, fails in prod" drift (12-factor dev/prod parity). A surface matrix documents status per target.

**Evidence model:**
- Surface matrix in README/`docs/deploy.md`: table of surface → status → proof
- Each surface has a config file AND a proof (deploy URL, build log, or passing deploy test)
- `.env.example` covers every surface's required vars
- No surface silently broken (each has been exercised, not just scaffolded)

**Soft-optimizing goal:** A `task deploy:<surface>` per target; deploy smoke-tests in CI; parity test asserting identical behavior across surfaces; surface health dashboard.

---

### L117 — Mobile Presence Decision

**Name:** The "should this have a mobile app?" question is deliberately answered.

**Acceptance criterion:** The repo documents a deliberate decision on mobile presence (native app / PWA / responsive-web-only / N/A) with a rationale in `docs/` — the operator's explicit "should we have a mobile app" extraneous-ask. If mobile IS warranted, there is at least a responsive/PWA baseline or a tracked plan (Expo/native). A decision of "no mobile, here's why" scores 3; an unconsidered absence scores ≤1.

**Evidence model:**
- Mobile decision documented: `grep -rn "mobile\|PWA\|responsive\|Expo\|iOS\|Android" docs/ README.md`
- If PWA: `manifest.webmanifest` + service worker present
- If responsive-only: viewport meta + responsive breakpoints in CSS/tokens
- If native planned: a tracked issue/plan; if N/A: rationale recorded

**Soft-optimizing goal:** PWA installable + offline; Expo app for daemon/monitor products; push notifications; mobile-specific UX (not just shrunk desktop).

---

### L118 — Release Automation

**Name:** Releases are one-command / one-tag automated, not manual.

**Acceptance criterion:** Tagging a version (or a release workflow) automatically builds artifacts, generates a changelog, creates a GitHub Release with assets, and publishes to package channels — no manual asset uploads. Version bumping is scripted (release-please/cargo-release/changesets/semantic-release).

**Evidence model:**
- Release workflow: `ls .github/workflows/release*.yml` and it builds+uploads assets
- Version automation config: `grep -rn "release-please\|cargo-release\|changesets\|semantic-release" .`
- `CHANGELOG.md` is generated/maintained (not empty)
- Release assets attached automatically (installers, checksums)

**Soft-optimizing goal:** Fully hands-off tag→release; signed checksums + SBOM attached; release notes categorized; pre-release/beta channel.

---

### L119 — Versioning & Compatibility Policy

**Name:** A clear versioning scheme and compatibility guarantees.

**Acceptance criterion:** SemVer (or a documented scheme) is followed; breaking changes are called out in the changelog; for libraries, an MSRV/engine-version policy is stated; deprecations have a migration note. Users can reason about upgrade safety.

**Evidence model:**
- SemVer tags: `git tag | head` shows `vMAJOR.MINOR.PATCH`
- `CHANGELOG.md` sections (Added/Changed/Breaking/Fixed)
- Library: MSRV/`engines` declared: `grep -rn "rust-version\|engines\|python_requires" Cargo.toml package.json pyproject.toml`
- Deprecation/migration notes present when applicable

**Soft-optimizing goal:** Automated breaking-change detection (cargo-semver-checks/api-extractor); deprecation warnings in-product; upgrade guides per major.

---

### L120 — Distribution Channels & Discoverability

**Name:** The product is findable and gettable through real channels.

**Acceptance criterion:** The product is published where its users look: package registries (crates.io/npm/PyPI), a Homebrew tap, a GitHub Releases page with assets, and a landing/README with install instructions and a project URL. A new user can find and install it without insider knowledge.

**Evidence model:**
- Published to ≥1 registry (crates.io/npm/PyPI badge or publish step)
- GitHub Releases has downloadable assets: `gh release list` shows releases with assets
- README has badges (version, downloads, CI) + install section
- A homepage/docs URL exists

**Soft-optimizing goal:** Landing site/docsite; listed in awesome-lists/directories; social preview card; download analytics.

---

### L121 — Install/Uninstall Cleanliness & QOL

**Name:** Install is smooth and uninstall leaves no mess.

**Acceptance criterion:** Installation is a single documented step and succeeds on a clean machine; the app declares where it stores config/data/cache (XDG/AppData/Library conventions); an uninstall path removes binaries and (optionally) data with consent — no orphaned files, no requiring manual cleanup. First-run works without hidden prerequisites.

**Evidence model:**
- Config/data paths follow platform conventions: `grep -rn "XDG\|dirs::\|AppData\|Library/Application Support\|config_dir" src/`
- Uninstall documented / scripted: `grep -rn "uninstall" README.md scripts/`
- Clean first-run: no undocumented deps (cf. L30.5 hermetics)
- No writes outside declared dirs

**Soft-optimizing goal:** `uninstall` subcommand; data-export before uninstall; migration of config across versions; install doctor (`app doctor`).

---

### L122 — Deploy Observability & Health Endpoints

**Name:** Deployed instances are observable — health, readiness, and telemetry.

**Acceptance criterion:** A deployed service exposes a health/readiness endpoint (`/health`, `/ready`), emits structured logs to stdout (12-factor XI), and exports basic metrics/traces (OpenTelemetry or equivalent). Deploy surfaces wire these to the platform (Workers analytics, Vercel logs, container healthcheck). Operators can tell if an instance is up and healthy.

**Evidence model:**
- Health endpoint: `grep -rn "/health\|/ready\|/livez\|/readyz\|healthcheck" src/`
- Structured logs to stdout: `grep -rn "tracing\|slog\|structured\|json.*log\|pino" src/`
- Metrics/traces exported: `grep -rn "opentelemetry\|otel\|prometheus\|metrics" src/ Cargo.toml package.json`
- Container/deploy healthcheck references the endpoint

**Soft-optimizing goal:** SLO dashboards; alerting wired; distributed tracing across surfaces; synthetic uptime checks; ties to L41–L50 observability pillars.
