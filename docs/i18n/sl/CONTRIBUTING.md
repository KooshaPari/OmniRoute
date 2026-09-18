# Contributing to OmniRoute (Slovenščina)

🌐 **Languages:** 🇺🇸 [English](../../../CONTRIBUTING.md) · 🇸🇦 [ar](../ar/CONTRIBUTING.md) · 🇦🇿 [az](../az/CONTRIBUTING.md) · 🇧🇬 [bg](../bg/CONTRIBUTING.md) · 🇧🇩 [bn](../bn/CONTRIBUTING.md) · 🇨🇿 [cs](../cs/CONTRIBUTING.md) · 🇩🇰 [da](../da/CONTRIBUTING.md) · 🇩🇪 [de](../de/CONTRIBUTING.md) · 🇬🇷 [el](../el/CONTRIBUTING.md) · 🇪🇸 [es](../es/CONTRIBUTING.md) · 🇪🇪 [et](../et/CONTRIBUTING.md) · 🇮🇷 [fa](../fa/CONTRIBUTING.md) · 🇫🇮 [fi](../fi/CONTRIBUTING.md) · 🇫🇷 [fr](../fr/CONTRIBUTING.md) · 🇮🇪 [ga](../ga/CONTRIBUTING.md) · 🇮🇳 [gu](../gu/CONTRIBUTING.md) · 🇮🇱 [he](../he/CONTRIBUTING.md) · 🇮🇳 [hi](../hi/CONTRIBUTING.md) · 🇭🇷 [hr](../hr/CONTRIBUTING.md) · 🇭🇺 [hu](../hu/CONTRIBUTING.md) · 🇮🇩 [id](../id/CONTRIBUTING.md) · 🇮🇹 [it](../it/CONTRIBUTING.md) · 🇯🇵 [ja](../ja/CONTRIBUTING.md) · 🇰🇷 [ko](../ko/CONTRIBUTING.md) · 🇱🇹 [lt](../lt/CONTRIBUTING.md) · 🇱🇻 [lv](../lv/CONTRIBUTING.md) · 🇮🇳 [mr](../mr/CONTRIBUTING.md) · 🇲🇾 [ms](../ms/CONTRIBUTING.md) · 🇲🇹 [mt](../mt/CONTRIBUTING.md) · 🇳🇱 [nl](../nl/CONTRIBUTING.md) · 🇳🇴 [no](../no/CONTRIBUTING.md) · 🇵🇭 [phi](../phi/CONTRIBUTING.md) · 🇵🇱 [pl](../pl/CONTRIBUTING.md) · 🇵🇹 [pt](../pt/CONTRIBUTING.md) · 🇧🇷 [pt-BR](../pt-BR/CONTRIBUTING.md) · 🇷🇴 [ro](../ro/CONTRIBUTING.md) · 🇷🇺 [ru](../ru/CONTRIBUTING.md) · 🇸🇰 [sk](../sk/CONTRIBUTING.md) · 🇷🇸 [sr](../sr/CONTRIBUTING.md) · 🇸🇪 [sv](../sv/CONTRIBUTING.md) · 🇰🇪 [sw](../sw/CONTRIBUTING.md) · 🇮🇳 [ta](../ta/CONTRIBUTING.md) · 🇮🇳 [te](../te/CONTRIBUTING.md) · 🇹🇭 [th](../th/CONTRIBUTING.md) · 🇹🇷 [tr](../tr/CONTRIBUTING.md) · 🇺🇦 [uk-UA](../uk-UA/CONTRIBUTING.md) · 🇵🇰 [ur](../ur/CONTRIBUTING.md) · 🇻🇳 [vi](../vi/CONTRIBUTING.md) · 🇨🇳 [zh-CN](../zh-CN/CONTRIBUTING.md) · 🇹🇼 [zh-TW](../zh-TW/CONTRIBUTING.md)

---

Hvala za zanimanje za sodelovanje! Ta vodnik zajema vse, kar potrebujete za začetek.

Za uradni potek dela za posamezno spremembo začnite z dokumentom
[Zlata pot prispevanja](docs/ops/CONTRIBUTION_GOLDEN_PATH.md). Ta povezuje spremembe ponudnikov, usmerjanja,
UI/UX, i18n, CLI-ja, podatkovne zbirke ter gradnje/uvajanja z njihovimi pogodbami, ciljno usmerjenimi preizkusi, pokritostjo
CI in koraki usklajevanja.

---

## Nastavitev razvojnega okolja

### Predpogoji

- **Node.js** `>=22.22.3 <23` ali `>=24.0.0 <27` (priporočeno: 24 LTS)
- **npm** 10+

> **Uporabniki npm v11+ (Node 24+):** Po ukazu `npm install` preverite, ali so bili izvorni moduli nameščeni:
> `node -e "require('better-sqlite3')"`. Če ukaz ne uspe z napako `MODULE_NOT_FOUND`,
> zaženite `npm approve-scripts better-sqlite3 && npm install`. Glejte
> [Odpravljanje težav](docs/guides/TROUBLESHOOTING.md#npm-v11-better-sqlite3-not-installed-cannot-find-module).

- **Git**

### Kloniranje in namestitev

```bash
git clone https://github.com/diegosouzapw/OmniRoute.git
cd OmniRoute
npm install
```

### Okoljske spremenljivke

```bash
# Ustvarite datoteko .env iz predloge
cp .env.example .env

# Ustvarite zahtevane skrivnosti
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env
echo "API_KEY_SECRET=$(openssl rand -hex 32)" >> .env
```

Ključne spremenljivke za razvoj:

| Spremenljivka          | Privzeta vrednost za razvoj | Opis                               |
| ---------------------- | --------------------------- | ---------------------------------- |
| `PORT`                 | `20128`                     | Vrata strežnika                    |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:20128`    | Osnovni URL za uporabniški vmesnik |
| `JWT_SECRET`           | (ustvarite zgoraj)          | Skrivnost za podpisovanje JWT      |
| `INITIAL_PASSWORD`     | `CHANGEME`                  | Geslo za prvo prijavo              |
| `APP_LOG_LEVEL`        | `info`                      | Raven podrobnosti dnevnika         |

### Nastavitve nadzorne plošče

Nadzorna plošča ponuja preklopnike uporabniškega vmesnika za funkcije, ki jih je mogoče nastaviti tudi prek okoljskih spremenljivk:

| Mesto nastavitve      | Preklopnik                  | Opis                                               |
| --------------------- | --------------------------- | -------------------------------------------------- |
| Nastavitve → Napredno | Način za odpravljanje napak | Omogoči dnevnike zahtev za odpravljanje napak (UI) |
| Nastavitve → Splošno  | Vidnost stranske vrstice    | Prikaže/skrije razdelke stranske vrstice           |

Te nastavitve so shranjene v podatkovni zbirki in se ohranijo med ponovnimi zagoni, pri čemer po nastavitvi preglasijo privzete vrednosti okoljskih spremenljivk.

### Lokalni zagon

```bash
# Razvojni način (samodejno ponovno nalaganje)
npm run dev

# Produkcijska gradnja
npm run build    # next build → .build/next/, nato assembleStandalone → dist/
npm run start

# Hitro prevajanje samo zaledja/API-ja za spremembe sodelujočih
npm run build:contributor

# Izdajna gradnja (čista ponovna gradnja + kontrolna oznaka HEAD — zahtevano za uvedbo)
npm run build:release   # rm -rf .build dist, nato gradnja + zapis dist/BUILD_SHA

# Običajna nastavitev vrat
PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev
```

Gradnja za sodelujoče izvede samo preverjanje prevajanja: ne sestavi samostojne
distribucije in ne zgradi izbirnih sredstev izvornega pakiranja. Običajno produkcijsko gradnjo uporabite, ko
morate preveriti paket, pripravljen za distribucijo.

### Razporeditev izhodnih datotek gradnje

| Imenik    | Vsebina                                                                       | Sledeno |
| --------- | ----------------------------------------------------------------------------- | ------- |
| `src/`    | Izvorna koda aplikacije (TypeScript / TSX)                                    | Da      |
| `.build/` | Vmesne datoteke — izhod `next build` (prezrt v Gitu, `distDir = .build/next`) | Ne      |
| `dist/`   | Paket za distribucijo — sestavi ga `assembleStandalone` (prezrt v Gitu)       | Ne      |

Gradbeni cevovod se izvede v enem prehodu:

```
npm run build
  └─ next build → .build/next/standalone  (izhod Next.js)
  └─ assembleStandalone()                 (kopira standalone + static + public + izvorna sredstva)
       └─ izhod: dist/                    (server.js, .next/static/, public/, node_modules/)
```

`npm run build:release` poleg tega najprej počisti oba imenika in zapiše
`dist/BUILD_SHA` (= `git rev-parse --short HEAD`) kot kontrolno oznako celovitosti uvedbe.

`npm run build:contributor` uporablja profil gradnje samo za zaledje. Med gradnjo začasno nadomesti
datoteke uporabniškega vmesnika nadzorne plošče z nadomestnimi datotekami, ohrani obdelovalnike poti API in po gradnji obnovi izvirne datoteke.
Za spremembe, ki vplivajo na uporabniški vmesnik nadzorne plošče, ali za celovito preverjanje izdaje uporabite `npm run build`;
profil za sodelujoče ni nadomestilo za izdajno gradnjo.

> **Opomba za uvedbo na VPS:** oddaljeni imenik slike `/usr/lib/node_modules/omniroute/app/`
> ostaja nespremenjen. Orodja za uvedbo z rsync sinhronizirajo vsebino imenika `dist/` vanj.
> Spremenila se je le pot izhoda gradnje znotraj repozitorija (`app/` → `dist/`).

Privzeti URL-ji:

- **Nadzorna plošča**: `http://localhost:20128/dashboard`
- **API**: `http://localhost:20128/v1`

---

## Running Tests

```bash
# All tests (unit + vitest + ecosystem + e2e)
npm run test:all

# Single test file (Node.js native test runner — most tests use this)
node --import tsx/esm --test tests/unit/your-file.test.ts

# Only the unit tests impacted by your change (same TIA selector as the CI gate, #8084)
npm run test:scoped            # changes in the last commit (or the working tree)
npm run test:scoped:staged     # staged changes only — pairs well with a pre-commit run
npm run test:scoped:full       # rebuild the import-graph map first (after adding/moving files)
# Exit 1 + "run the full suite" means a hub file (tsconfig, package.json, …) or an
# unmapped source changed — the selector fails safe, it never silently skips.

# Vitest (MCP server, autoCombo, cache)
npm run test:vitest

# E2E tests (requires Playwright)
npm run test:e2e

# Protocol clients E2E (MCP transports, A2A)
npm run test:protocols:e2e

# Ecosystem compatibility tests
npm run test:ecosystem

# Coverage gate: 60% statements/lines/functions/branches
npm run test:coverage
npm run coverage:report

# Lint + format check
npm run lint
npm run check

# Gated real-upstream combo smoke (requires VPS access + real provider credits)
# Hits REAL providers — costs a little. NEVER runs in CI. Skips cleanly without the gate.
# Needs: ssh root@192.168.0.15 access (sources a read-only DB snapshot from the VPS).
RUN_COMBO_LIVE=1 npm run test:combo:live

# Phase-3 VPS live smoke — plain Node ESM scripts, hit the live .15 server directly.
# Requires: ssh root@192.168.0.15 access (combos created/torn down via SSH sqlite).
# Hits REAL providers (small cost). Creates/deletes only __live_test__* combos. NEVER runs in CI.
# REQUIRE_API_KEY=false on .15 so no API key needed, but honors COMBO_LIVE_BASE_URL / COMBO_LIVE_API_KEY if set.
npm run test:combo:live:vps              # 7 HTTP scenarios (priority/round-robin/weighted/cost/fusion/auto + health)
npm run test:combo:live:vps:failover     # adds a real cross-provider failover scenario (8 total)
```

Coverage notes:

- `npm run test:coverage` measures source coverage for the main unit test suite, excludes `tests/**`, and includes `open-sse/**`
- Pull requests must keep the coverage gate at **60%+** statements/lines/functions/branches
- If a PR changes production code in `src/`, `open-sse/`, or `bin/`, it must add or update automated tests in the same PR
- `npm run coverage:report` prints the detailed file-by-file report from the latest coverage run
- `npm run test:coverage:legacy` preserves the older metric for historical comparison
- See `docs/ops/COVERAGE_PLAN.md` for the phased coverage improvement roadmap

### Pull Request Requirements

Before opening a PR, use the
[Contribution Golden Path](docs/ops/CONTRIBUTION_GOLDEN_PATH.md) to run the focused loop for
what you changed. The full unit suite (4 CI shards), Vitest, the **60%+** coverage gate, and
the production build are CI's responsibility — running them locally adds no signal the PR
checks will not already give you, and on smaller machines it can saturate the host (#8084):

- Run the test files that cover your change: `node --import tsx/esm --test tests/unit/<file>.test.ts`
- Run `npm run lint`
- Include or update automated tests in the same PR whenever production code changes
- Include the changed or added test files in the PR description when production code changed
- Check the SonarQube result on the PR when the project secrets are configured in CI

Current test status: **122 unit test files** covering:

- Provider translators and format conversion
- Rate limiting, circuit breaker, and resilience
- Semantic cache, idempotency, progress tracking
- Database operations and schema (21 DB modules)
- OAuth flows and authentication
- API endpoint validation (Zod v4)
- MCP server tools and scope enforcement
- Memory and Skills systems

---

## Code Style

- **ESLint** — Run `npm run lint` before committing
- **Prettier** — Auto-formatted via `lint-staged` on commit (2 spaces, semicolons, double quotes, 100 char width, es5 trailing commas)
- **TypeScript** — All `src/` code uses `.ts`/`.tsx`; `open-sse/` uses `.ts`/`.js`; document with TSDoc (`@param`, `@returns`, `@throws`)
- **No `eval()`** — ESLint enforces `no-eval`, `no-implied-eval`, `no-new-func`
- **Zod validation** — Use Zod v4 schemas for all API input validation
- **Naming**: Files = camelCase/kebab-case, components = PascalCase, constants = UPPER_SNAKE

### Error handling / empty catch blocks

Never leave a `catch` unexplained. Classify it into one of two buckets (operationalizes
the hard rule "never silently swallow errors in SSE streams"):

- **Intentional (our own best-effort cleanup/telemetry)** — a failure here is expected and
  harmless; add a one-line rationale comment, no logging (logging on every request is the
  noise this convention avoids).

  ```ts
  } catch {} // closing an already-closed controller after client disconnect is expected
  ```

- **Should log (external/caller-supplied code, or the swallow changes control flow)** — keep
  the catch (never let it break the stream) but emit a contextual `console.debug`/`warn` so the
  failure is discoverable.

  ```ts
  } catch (e) {
    console.debug("[STREAM] onFailure callback error:", e);
  }
  ```

See `open-sse/utils/stream.ts` and `open-sse/utils/streamHandler.ts` for applied examples.

---

## Project Structure

```
src/                        # TypeScript (.ts / .tsx)
├── app/                    # Next.js 16 App Router
│   ├── (dashboard)/        # Dashboard pages (23 sections)
│   ├── api/                # API routes (51 directories)
│   └── login/              # Auth pages (.tsx)
├── domain/                 # Policy engine (policyEngine, comboResolver, costRules, etc.)
├── lib/                    # Core business logic (.ts)
│   ├── a2a/                # Agent-to-Agent v0.3 protocol server
│   ├── acp/                # Agent Communication Protocol registry
│   ├── compliance/         # Compliance policy engine
│   ├── db/                 # SQLite domain modules + 130 migrations
│   ├── memory/             # Persistent conversational memory
│   ├── oauth/              # OAuth providers, services, and utilities
│   ├── skills/             # Extensible skill framework
│   ├── usage/              # Usage tracking and cost calculation
│   └── localDb.ts          # Re-export layer only — never add logic here
├── middleware/              # Request middleware (promptInjectionGuard)
├── mitm/                   # MITM proxy (cert, DNS, target routing)
├── shared/
│   ├── components/         # React components (.tsx)
│   ├── constants/          # Provider definitions (329), MCP scopes, 19 routing strategies
│   ├── utils/              # Circuit breaker, sanitizer, auth helpers
│   └── validation/         # Zod v4 schemas
└── sse/                    # SSE proxy pipeline

open-sse/                   # @omniroute/open-sse workspace
├── executors/              # 89 executor implementation modules
├── handlers/               # 11 request handlers (chat, responses, embeddings, images, etc.)
├── mcp-server/             # MCP server (110 unique tools, 3 transports, 33 scopes)
├── services/               # 178 top-level services (combo, autoCombo, rateLimitManager, etc.)
├── translator/             # Format translators (OpenAI ↔ Claude ↔ Gemini ↔ Responses ↔ Ollama)
├── transformer/            # Responses API transformer
└── utils/                  # 22 utility modules (stream, TLS, proxy, logging)

apps/desktop/               # Tauri 2 desktop app (cross-platform)

tests/
├── unit/                   # Node.js test runner (1,574 test files)
├── integration/            # Integration tests
├── e2e/                    # Playwright tests
├── security/               # Security tests
├── translator/             # Translator-specific tests
└── load/                   # Load tests

docs/
├── adr/                     # Architecture Decision Records
├── architecture/            # System architecture & resilience
├── comparison/              # OmniRoute vs alternatives
├── compression/             # Compression guides & rules
├── dev/                     # Development guides
├── diagrams/                # Architecture diagrams
├── frameworks/              # MCP, A2A, OpenCode, Memory, Skills
├── guides/                  # User guide, Docker, setup, troubleshooting
├── i18n/                    # Internationalized README translations
├── marketing/               # Marketing materials
├── ops/                     # Deployment, proxy, coverage, releases
├── providers/               # Provider-specific docs
├── reference/               # API reference, env vars, CLI tools, free tiers
├── releases/                # Release notes
├── routing/                 # Auto-combo engine, reasoning replay
├── screenshots/             # Dashboard screenshots
├── security/                # Guardrails, compliance, stealth, tokens
└── specs/                   # Design specs
```

---

## Adding a New Provider

### Step 1: Register Provider Constants

Add to `src/shared/constants/providers.ts` — Zod-validated at module load.

### Step 2: Add Executor (if custom logic needed)

Create executor in `open-sse/executors/your-provider.ts` extending the base executor.

### Step 3: Add Translator (if non-OpenAI format)

Create request/response translators in `open-sse/translator/`.

### Step 4: Add OAuth Config (if OAuth-based)

Add OAuth credentials in `src/lib/oauth/constants/oauth.ts` and service in `src/lib/oauth/services/`.

If the upstream provider distributes a public OAuth client_id/secret or Firebase Web API key inside its public CLI / browser bundle, **do not** embed it as a string literal. Use `resolvePublicCred()` from `open-sse/utils/publicCreds.ts` and add a masked byte entry to `EMBEDDED_DEFAULTS`. The full mandatory workflow is documented in [`docs/security/PUBLIC_CREDS.md`](./docs/security/PUBLIC_CREDS.md).

Inside handlers/executors, error messages reaching the client must go through `buildErrorBody()` / `sanitizeErrorMessage()` from `open-sse/utils/error.ts` — never put raw `err.stack` or `err.message` in a Response body. See [`docs/security/ERROR_SANITIZATION.md`](./docs/security/ERROR_SANITIZATION.md).

### Step 5: Register Models

Add model definitions in `open-sse/config/providerRegistry.ts`.

### Step 6: Add Tests

Write unit tests in `tests/unit/` covering at minimum:

- Provider registration
- Request/response translation
- Error handling

---

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] TypeScript types added for new public functions and interfaces
- [ ] No hardcoded secrets or fallback values
- [ ] Public upstream credentials embedded via `resolvePublicCred()` (see [`docs/security/PUBLIC_CREDS.md`](./docs/security/PUBLIC_CREDS.md)), never as literals
- [ ] Error responses route through `buildErrorBody()` / `sanitizeErrorMessage()` — no raw stack traces in response bodies (see [`docs/security/ERROR_SANITIZATION.md`](./docs/security/ERROR_SANITIZATION.md))
- [ ] Shell commands (`exec` / `spawn`) pass runtime values via `env`, not via string interpolation
- [ ] All inputs validated with Zod schemas
- [ ] Changelog **fragment** added under `changelog.d/{features|fixes|maintenance}/<PR>-<slug>.md` for user-facing changes (see [`changelog.d/README.md`](./changelog.d/README.md)) — do **not** edit `CHANGELOG.md` directly; fragments are aggregated at release time and never conflict between PRs
- [ ] Documentation updated (if applicable)
- [ ] No new CodeQL / Secret-Scanning alerts opened, or each one dismissed with technical justification referencing the relevant `docs/security/` doc
- [ ] Routes that spawn child processes (`/api/mcp/`, `/api/cli-tools/runtime/`) classified as `isLocalOnlyPath()` in `src/server/authz/routeGuard.ts` — see [Hard Rule #15](docs/security/ROUTE_GUARD_TIERS.md)
- [ ] No `Co-Authored-By` trailers in commit messages — commits must appear solely under the repository owner's Git identity (Hard Rule #16)

---

## Releasing

Releases are managed via the `/generate-release` workflow. When a new GitHub Release is created, the package is **automatically published to npm** via GitHub Actions.

For VPS deploys, use `npm run build:release` (not `npm run build`) — it performs a clean
rebuild, assembles the bundle into `dist/`, and writes the `dist/BUILD_SHA` sentinel.
Then use the `/deploy-vps-*-cc` skills which rsync `dist/` to the remote `app/` directory.

---

## Getting Help

- **Architecture**: See [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)
- **API Reference**: See [`docs/reference/API_REFERENCE.md`](docs/reference/API_REFERENCE.md)
- **Security docs**: [`docs/security/CLI_TOKEN.md`](docs/security/CLI_TOKEN.md), [`docs/security/ROUTE_GUARD_TIERS.md`](docs/security/ROUTE_GUARD_TIERS.md), [`docs/security/ERROR_SANITIZATION.md`](docs/security/ERROR_SANITIZATION.md), [`docs/security/PUBLIC_CREDS.md`](docs/security/PUBLIC_CREDS.md)
- **Ops docs**: [`docs/ops/SQLITE_RUNTIME.md`](docs/ops/SQLITE_RUNTIME.md)
- **Issues**: [github.com/diegosouzapw/OmniRoute/issues](https://github.com/diegosouzapw/OmniRoute/issues)
- **ADRs**: See `docs/adr/` for architectural decision records
