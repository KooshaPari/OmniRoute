---
title: "Checklista wydania"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Checklista wydania

> **Ostatnia aktualizacja:** 2026-06-28 — v3.8.40
> Uproszczony przepływ wydania wykorzystujący skill-e Claude Code do automatyzacji.
>
> **Utrzymuj kolejkę/gałąź na zielono między wydaniami:** zobacz [RELEASE_GREEN.md](./RELEASE_GREEN.md)
> (rodzina `/green-prs` + `npm run check:release-green` + `/babysit` + nightly). Uruchamianie
> tego okresowo — a zwłaszcza **przed** tą checklistą — sprawia, że PR wydania startuje na zielono.

## TL;DR

```bash
# 1. Bump version + generate CHANGELOG (skill)
/version-bump-cc patch    # or minor/major

# 2. Run quality gate locally
npm run check              # lint + tests
npm run test:coverage      # full coverage gate (60/60/60/60)

# 3. Build & smoke
npm run build
npm run test:e2e           # optional but recommended

# 4. Generate release (skill)
/generate-release-cc

# 5. Deploy (skill)
/deploy-vps-both-cc        # or akamai-cc / local-cc

# 6. Capture release evidences (skill)
/capture-release-evidences-cc
```

## Publikacja etapowa npm (domyślnie od v3.8.49 — WS1.3/D2)

Workflow npm-publish nie publikuje już bezpośrednio: bootuje spakowany tarball
(`check:pack-boot`), a następnie uruchamia `npm stage publish` — dokładne bajty są parkowane w
rejestrze, **nie da się ich zainstalować**, dopóki właściciel nie zatwierdzi. Ludzka bramka 2FA
przeniosła się na PO dowodzie, a nie przed nim.

**Przepływ właściciela po zejściu workflow na zielono:**

1. `npm stage list omniroute` — znajdź stage id (wypisywany też w podsumowaniu workflow).
2. Zweryfikuj zaparkowane bajty (zalecane): `npm stage download <id>`, potem zainstaluj
   pobrany tarball do tymczasowego prefiksu i zbootuj go (`npm run check:pack-boot` automatyzuje
   ten sam werdykt pack→install→boot w CI).
3. `npm stage approve <id>` — monity 2FA TO jest publikacja. `npm stage reject <id>` odrzuca.
4. Siatka po publikacji: weryfikator post-publish (WS1.4 planu v3.8.49) instaluje
   opublikowaną wersję z publicznego rejestru w czystym kontenerze i ją bootuje.

**Awaryjny fallback:** `workflow_dispatch` z `publish_mode=direct` przywraca
legacy natychmiastowe `npm publish` (używaj tylko gdy sam staging się psuje; zanotuj dlaczego).

**Jednorazowe utwardzenie (właściciel, npmjs.com):** skonfiguruj Trusted Publisher dla
`omniroute` w trybie stage-only, żeby wycieknięty długotrwały token nie mógł `npm publish`
bezpośrednio skądkolwiek — CI może tylko stage'ować; tylko 2FA właściciela wypuszcza.

**Playbook zepsutego artefaktu (bez zmian):** `npm deprecate omniroute@<bad> "<reason> — use <fixed>"`
jako domyślny odruch (minuty, odwracalne); `npm unpublish` tylko w oknie 72h/no-dependents
i nigdy jako pierwszy ruch. Docker: nigdy nie nadpisuj tagu wersji — rollback to
przepięcie `latest` na ostatni dobry digest.

## Szybki pas hotfix (etykieta `hotfix`)

PR z etykietą `hotfix` pomija ciężką macierz CI (9-shard E2E, coverage ratchet,
quality-gate, quality-extended) i zostawia szybkie, wysokosygnałowe bramki: build,
unit shards, integration, vitest, lint/typecheck, docs-sync, `check:pack-artifact`
oraz tarball boot-smoke (`check:pack-boot`). Cel: zieleń w ≤15 min zamiast ~33 min.

**Polityka wejścia — wszystkie cztery wymagane (wzorowane na pasach awaryjnych Chromium/VS Code/Node):**

1. **Severity**: produkcja jest zepsuta — opublikowany artefakt pada przy bootcie / poprawka
   bezpieczeństwa / każdy użytkownik wydania jest dotknięty. „Ważne” to nie „zepsute”.
2. **Authority**: tylko właściciel repozytorium nakłada etykietę `hotfix`. Etykieta JEST
   zatwierdzeniem — nigdy self-serve na PR-ze kampanii.
3. **Evidence**: treść PR linkuje poprzedni w pełni zielony heavy run (suite, którą
   pominięte joby by ponownie walidowały) plus własny test poprawki failing-then-passing.
4. **Scope**: wyłącznie cherry-pick — minimalna poprawka, bez refaktorów, bez ride-alongów.

Pominięta powierzchnia coverage/ratchet jest ponownie walidowana przez kolejny pełny run na
gałęzi release (continuous release-green) — pas pomija OCZEKIWANIE, nigdy walidację.
Diffy tylko-testowe (wszystkie pliki pod `tests/`, żaden pod `tests/e2e/`) pomijają macierz E2E
automatycznie, bez żadnej etykiety.

## Szczegółowa checklista

### Przed wydaniem

- [ ] Wszystkie PR-y celujące w to wydanie są zmergowane do `release/vX.Y.0`
- [ ] Wszystkie otwarte pozycje Linear/issue dla tej wersji są zamknięte lub przeniesione do następnego milestone
- [ ] CI zielone na gałęzi `release/vX.Y.0`
- [ ] Brak markerów `TODO(release)` w kodzie: `grep -r "TODO(release)" src/ open-sse/`
- [ ] Obraz bazowy Docker aktualny (obecnie `node:24.15.0-trixie-slim`)

### Wersja i changelog

- [ ] Uruchom `/version-bump-cc <patch|minor|major>` (skill Claude Code)
  - Podbija `package.json`, `apps/desktop/package.json`
  - Regeneruje `CHANGELOG.md` z commitów gita od ostatniego tagu
  - Aktualizuje badge'e w README.md
- [ ] Ręcznie przejrzyj CHANGELOG.md i w razie potrzeby wyczyść komunikaty commitów
- [ ] Upewnij się, że najnowsza sekcja semver w `CHANGELOG.md` równa się wersji z `package.json`
- [ ] Zachowaj `## [Unreleased]` jako pierwszą sekcję changelogu na nadchodzącą pracę
- [ ] Zaktualizuj `docs/openapi.yaml` → `info.version` musi równać się wersji z `package.json`

### Jakość kodu

- [ ] `npm run lint` — 0 błędów (ostrzeżenia są preexisting)
- [ ] `npm run typecheck:core` — czysto
- [ ] `npm run typecheck:noimplicit:core` — czysto (strict)
- [ ] `npm run check:cycles` — brak cyklicznych zależności
- [ ] `npm run check:any-budget:t11` — w budżecie
- [ ] `npm run check:route-validation:t06` — czysto
- [ ] `npm run check:node-runtime` — spełnione minimum wspieranego runtime (`>=22.22.2 <23`, `>=24.0.0 <27`, wg `SUPPORTED_NODE_RANGE` w `src/shared/utils/nodeRuntimeSupport.ts`; zgodne z `engines` w `package.json`)

### Testy

- [ ] `npm run test:unit` — pass
- [ ] `npm run test:vitest` — pass (MCP server, autoCombo, cache)
- [ ] `npm run test:coverage` — bramka 60/60/60/60 spełniona (statements/lines/functions/branches)
- [ ] `npm run test:integration` — pass (jeśli zmiany dotykają DB / handlerów)
- [ ] `npm run test:combo:matrix` — pass (macierz strategii combo: deterministycznie dowodzi decyzji selekcji wszystkich 19 publicznych strategii routingu; uruchamiaj przy zmianach combo routing, strategy resolution lub logiki fallback)
- [ ] `RUN_COMBO_LIVE=1 npm run test:combo:live` — **opcjonalne/ręczne** (bramkowany smoke na realnym upstreamie; bierze snapshot DB tylko do odczytu z VPS `root@192.168.0.15`; uderza w realnych providerów, zużywa kredyty; nigdy nie biegnie w CI; bez bramki pomija się czysto)
- [ ] `npm run test:combo:live:vps` — **opcjonalne/ręczne** (Phase-3 VPS live smoke: 7 scenariuszy HTTP przeciw żywemu serwerowi `.15` przez plain Node ESM; wymaga `ssh root@192.168.0.15`; tworzy/usuwa tylko combo `__live_test__*`; uderza w realnych providerów; nigdy nie biegnie w CI)
- [ ] `npm run test:e2e` — pass (zmiany UI)
- [ ] `npm run test:protocols:e2e` — pass (zmiany MCP/A2A)
- [ ] `npm run test:ecosystem` — pass

### Hooki (walidowane Husky)

Hooki Husky leżą w `.husky/` i uruchamiają się automatycznie przy operacjach gita.

- **pre-commit:** `npx lint-staged + node scripts/check/check-docs-sync.mjs + npm run check:any-budget:t11`
- **pre-push:** szybkie deterministyczne bramki — `npm run check:any-budget:t11 && npm run check:tracked-artifacts` (aktywowane 2026-06-13). Celowo wyklucza `test:unit` (wolne; pokryte przez job CI `test-unit`).
  - Uruchom `npm run test:unit` ręcznie przed pushem gałęzi release.

Jeśli hook padnie: napraw przyczynę, nie omijaj przez `--no-verify`.

### Conventional Commits

Wszystkie commity idące do wydania muszą mieć format `type(scope): subject`.

**Dozwolone typy:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `ci`

**Dozwolone scope'y:** `db`, `sse`, `oauth`, `dashboard`, `api`, `cli`, `docker`, `ci`, `mcp`, `a2a`, `memory`, `skills`, `cloud-agent`, `guardrails`, `compression`, `auto-combo`, `resilience`, `providers`, `executors`, `translator`, `domain`, `authz`

Breaking changes: dodaj stopkę `BREAKING CHANGE:` albo `!` po scope (np. `feat(api)!: drop /v0`).

### Dokumentacja

- [ ] `npm run check:docs-sync` przechodzi (auto-run w pre-commit)
- [ ] `npm run check:docs-all` przechodzi (parasol: docs-sync + docs-counts + env-doc-sync + deprecated-versions + doc-links)
- [ ] `npm run check:env-doc-sync` kończy się kodem 0 — kontrakt env code ↔ `.env.example` ↔ `docs/reference/ENVIRONMENT.md` jest nienaruszony
- [ ] `npm run check:doc-links` kończy się kodem 0 — brak zepsutych wewnętrznych referencji markdown po restrukturyzacji
- [ ] `docs/architecture/ARCHITECTURE.md` przejrzany pod dryf storage/runtime
- [ ] `docs/guides/TROUBLESHOOTING.md` przejrzany pod dryf env var i operacyjny
- [ ] Jeśli `.env.example` się zmienił: zaktualizowano `docs/reference/ENVIRONMENT.md`
- [ ] Jeśli nowa funkcja ma UI: `docs/guides/USER_GUIDE.md` o niej wspomina
- [ ] Jeśli nowa funkcja ma API: zaktualizowano `docs/reference/API_REFERENCE.md` + `docs/openapi.yaml`
- [ ] Jeśli nowa funkcja to moduł: istnieje dedykowany `docs/<MODULE>.md`
- [ ] Jeśli breaking change: `docs/guides/TROUBLESHOOTING.md` ma notatkę migracyjną

### i18n

- [ ] `npm run i18n:check` kończy się kodem 0 — stan tłumaczeń (`.i18n-state.json`) zsynchronizowany ze źródłowymi docs (brak dryfujących źródeł w trybie strict; doradztwo warn-mode jest akceptowalne przy last-minute poprawkach docs, ale przed tagowaniem powinno być 0)
- [ ] `npm run i18n:check-ui-coverage` kończy się kodem 0 — każdy locale UI na lub powyżej progu pokrycia 80%
- [ ] `npm run i18n:sync-ui:dry` raportuje 0 brakujących kluczy we wszystkich 42 locale
- [ ] Jeśli źródłowe angielskie docs się zmieniły, uruchom `npm run i18n:run` (wymaga `OMNIROUTE_TRANSLATION_API_KEY` w `.env`) przed tagowaniem
- [ ] Wkłady tłumaczeniowe można odłożyć na następne wydanie, jeśli drobne (śledź w CHANGELOG)

### Migracje bazy danych

- [ ] Jeśli `src/lib/db/migrations/` ma nowe pliki:
  - [ ] Każda migracja jest idempotentna (`CREATE TABLE IF NOT EXISTS` itd.)
  - [ ] Migracje owinięte w transakcje
  - [ ] Ponumerowane poprawnie (bez luk w sekwencji)
- [ ] Test na świeżej instalacji: usuń `~/.omniroute/omniroute.db` i uruchom `npm run dev`
- [ ] Test na istniejącej instalacji: backup DB, uruchom migrację, zweryfikuj schemat
- [ ] Pliki WAL (`-wal`, `-shm`) obsłużone poprawnie, jeśli migracja przepisuje tabele

### Katalog providerów (walidowany Zod)

- [ ] Schemat Zod `src/shared/constants/providers.ts` poprawny w czasie ładowania
  - [ ] Wszyscy providerzy mają wymagane pola (`id`, `label`, `kind` itd.)
  - [ ] `freeNote` podane dla nowych darmowych providerów
  - [ ] Providerzy OAuth mają `oauthConfig` zarejestrowany w `src/lib/oauth/constants/oauth.ts`
- [ ] Jeśli dodano nowego providera: odpowiadający executor w `open-sse/executors/`
- [ ] Jeśli format inny niż OpenAI: translator w `open-sse/translator/`
- [ ] Modele zarejestrowane w `open-sse/config/providerRegistry.ts`
- [ ] Testy jednostkowe w `tests/unit/` pokrywają klasyfikację i routing providerów

### Desktop (Tauri 2)

Jeśli zmieniło się `apps/desktop/`:

- [ ] `cargo tauri build && ./src-tauri/target/release/OmniRoute` przechodzi
- [ ] Buildy przetestowane dla co najmniej jednego z `:win`, `:mac`, `:linux`
- [ ] Certyfikaty code signing nie wygasły (jeśli signing)
- [ ] Wersja `apps/desktop/package.json` zgadza się z root `package.json`
- [ ] Wskaźnik kanału auto-update zaktualizowany, jeśli wypuszczasz na `stable`

### Układ buildu

Repozytorium używa trzech odrębnych katalogów wyjściowych — nigdy ich nie myl:

| Directory | Purpose                                                  | Tracked?        |
| --------- | -------------------------------------------------------- | --------------- |
| `src/`    | Application source (TypeScript / TSX)                    | Yes             |
| `.build/` | Build intermediates — `next build` output (`distDir`)    | No (gitignored) |
| `dist/`   | Shippable npm bundle — assembled by `assembleStandalone` | No (gitignored) |

> **Notatka operatorska:** zdalny katalog obrazu VPS pozostaje `/usr/lib/node_modules/omniroute/app/`.
> Przeniesione zostało tylko wyjście buildu **w repo** (`app/` → `dist/`). Skill-e deploy rsyncują
> zawartość `dist/` do zdalnego katalogu `app/` — nie wymagane żadne zmiany ścieżek VPS.

**Przepływ single-build:**

```
npm run build:release
  └─ rm -rf .build dist          (clean)
  └─ next build → .build/next/   (intermediates)
  └─ assembleStandalone          (copies standalone + static + public + natives → dist/)
  └─ writes dist/BUILD_SHA       (HEAD sentinel)
```

NIE uruchamiaj `npm run build` a potem osobnego `npm run build:cli` pod deploy — użyj
`npm run build:release`, które robi czysty rebuild + sentinel w jednej komendzie.

### Walidacja artefaktów

- [ ] `npm run build:release` kończy się sukcesem i `dist/BUILD_SHA` == `git rev-parse --short HEAD`
- [ ] `npm run check:pack-artifact` czysto — brak `app.__qa_backup`, `scripts/scratch`, `package-lock.json` ani innego lokalnego residualu
- [ ] `dist/server.js` istnieje po buildzie

### Tagowanie i release

- [ ] Uruchom `/generate-release-cc` (skill Claude Code):
  - Tworzy tag `vX.Y.Z`
  - Pushuje tag i gałąź
  - Otwiera GitHub Release z ciałem changelogu
  - Dołącza instalatory Tauri 2 (jeśli zbudowane)
- [ ] Albo ręcznie:
  ```bash
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  gh release create vX.Y.Z --notes-from-tag
  ```

### Deploy

Skill-e deploy używają lekkiego przepływu rsync — bez `npm pack`, bez `npm i -g`:

- [ ] Użyj skill-a deploy pasującego do celu:
  - `/deploy-vps-local-cc` — lokalny VPS (192.168.0.15)
  - `/deploy-vps-akamai-cc` — Akamai VPS (69.164.221.35)
  - `/deploy-vps-both-cc` — oba
- [ ] Przed deployem potwierdź `dist/BUILD_SHA` == `git rev-parse --short HEAD`
- [ ] Build musi iść tam, gdzie `node_modules` jest realne (główny checkout lub worktree po `npm ci` — NIE zlinkowany symlinkami worktree)
- [ ] Smoke test wdrożonej instancji:
  - Otwórz `/dashboard/health` → sprawdź, że string wersji pasuje do wydania
  - Uruchom request `/v1/chat/completions` przeciw znanemu providerowi
  - Zweryfikuj, że `/api/monitoring/health` zwraca circuit breakery `CLOSED`
  - Potwierdź, że transporty MCP odpowiadają (`/mcp` HTTP, `/mcp-sse` SSE)

### Po wydaniu

- [ ] Uruchom `/capture-release-evidences-cc` (skill Claude Code)
  - Przechwytuje zrzuty/nagrania WebP nowych funkcji
  - Dołącza do release notes / posta na blogu
- [ ] Zaktualizuj GitHub Discussions / Discord ogłoszeniem wydania
- [ ] Otwórz milestone na następną wersję
- [ ] Jeśli krytyczne: przypnij dyskusję lub wrzuć do `news.json` baner in-app

## Smoke embedded services (v3.8.4+)

Przed wypuszczeniem dowolnego wydania zawierającego zmiany embedded services zweryfikuj:

### Boot na świeżej DB (łapie kolizje migracji — dodane po hotfixie v3.8.4)

- [ ] `DATA_DIR=$(mktemp -d) npm start &` — poczekaj 10 s na boot
- [ ] `curl -s http://127.0.0.1:20128/api/services/9router/status | jq '.tool'` zwraca `"9router"` (NIE 404, NIE 500). Potwierdza, że migracja `071_services.sql` się zastosowała + wiersz zaseedowany.
- [ ] `sqlite3 $DATA_DIR/storage.sqlite "PRAGMA table_info(version_manager);" | grep -E "provider_expose|logs_buffer_path|last_sync_at"` zwraca 3 wiersze.
- [ ] `sqlite3 $DATA_DIR/storage.sqlite "PRAGMA table_info(webhooks);" | grep -E "kind|metadata_encrypted"` zwraca 2 wiersze (waliduje zastosowanie `070_webhooks_kind_metadata.sql`).
- [ ] `node --import tsx/esm --test tests/unit/db/no-migration-collisions.test.ts` przechodzi — strzeże przed przyszłymi kolizjami.

### 9Router

- [ ] `POST /api/services/9router/install` zwraca 200 z `installedVersion` w poniżej 2 min
- [ ] `POST /api/services/9router/start` zwraca 200 i `state: "running"` w poniżej 30 s
- [ ] `GET /api/services/9router/status` raportuje `health: "healthy"`
- [ ] `POST /v1/chat/completions` z `"model": "9router/auto/..."` zwraca 200 (routing end-to-end przez 9Router)
- [ ] `GET /dashboard/providers/services/9router/embed/dashboard` renderuje natywne UI 9Router wewnątrz proxy (bez bezpośredniego iframe `127.0.0.1:port`)
- [ ] `POST /api/services/9router/rotate-key` zwraca `{ keyRotated: true }` i usługa restartuje się czysto
- [ ] `POST /api/services/9router/stop` zwraca 200 i `state: "stopped"`
- [ ] `GET /api/services/9router/logs?tail=50` zwraca stream SSE z eventem `snapshot` zawierającym ostatnie linie
- [ ] Instalacja w środowisku bez `npm` w PATH zwraca 500 z przyjaznym (bez stack-trace) komunikatem błędu

### CLIProxyAPI

- [ ] `POST /api/services/cliproxy/install` zwraca 200 w poniżej 2 min
- [ ] `POST /api/services/cliproxy/start` zwraca 200 i `state: "running"` w poniżej 30 s
- [ ] `GET /api/services/cliproxy/status` raportuje `health: "healthy"`
- [ ] `POST /api/services/cliproxy/stop` zwraca 200 i `state: "stopped"`
- [ ] `GET /api/services/cliproxy/logs?tail=50` zwraca stream SSE

### Regresja bezpieczeństwa

- [ ] `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:20128/api/services/9router/start` zwraca `403 LOCAL_ONLY`
- [ ] `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:20128/api/services/cliproxy/start` zwraca `403 LOCAL_ONLY`
- [ ] Odpowiedzi błędów z `/api/services/*` nie zawierają `err.stack` ani bezwzględnych ścieżek plików

## Kontrole v3.8.0+

Przed wypuszczeniem dowolnego wydania v3.8.x zweryfikuj te dodatkowe pozycje:

- [ ] `omniroute --tray` bootuje na macOS (systray2 instalowany do `~/.omniroute/runtime/`)
- [ ] `omniroute --tray` bootuje na Linux (wymaga DISPLAY; graceful error jeśli nie ustawione)
- [ ] `omniroute --tray` bootuje na Windows (PowerShell NotifyIcon, bez dodatkowych binarek)
- [ ] `omniroute config tray enable` tworzy wpis autostart; disable go usuwa
- [ ] `npm install -g omniroute@<this-version>` uruchamia postinstall bez fatalnego wyjścia
- [ ] Ścieżka update zachowuje optional deps: `omniroute update --apply` i auto-updater
      uruchamiają `npm install -g … --include=optional`, żeby `optionalDependencies` (better-sqlite3,
      keytar, tls-client oraz stack SLM llmlingua: `@atjsh/llmlingua-2@2.0.5`,
      `js-tiktoken`) przeżyły update. Tier ultra `modelPath` SLM potrzebuje też
      modelu tinybert, auto-pobieranego do `${DATA_DIR}/models/llmlingua` przy pierwszym użyciu. Postinstall
      (`scripts/build/colocateOptionals.mjs`) następnie ko-lokuje opcjonalne zamknięcie SLM do
      `dist/node_modules`, żeby worker rozwiązywał JEDNĄ instancję `@huggingface/transformers` ^4.2.0
      — standalone trace bundluje tylko transformers, nie dynamicznie importowane
      optionals, więc bez tego worker załadowałby llmlingua-2 przeciw transformers z roota
      i tier SLM cicho fail-openowałby.
- [ ] `omniroute status` działa bez `.env` (ścieżka tokenu CLI, tylko loopback)
- [ ] `curl http://localhost:20128/api/shutdown` zwraca 401 (trasa zawsze chroniona)
- [ ] `curl -H "host: evil.com" http://localhost:20128/api/mcp/sse` zwraca 401 (strażnik loopback)
- [ ] Runtime SQLite resolvuje do `bundled` przy pierwszym uruchomieniu (bundlowana binarka poprawna dla platformy)
- [ ] Runtime SQLite spada na `runtime`, gdy `node_modules/better-sqlite3` jest usunięte
- [ ] Smart MCP filter kompresuje realny output `playwright-mcp browser_snapshot` (redukcja ≥50%)
- [ ] Wszystkie 10 plików `skills/omniroute*/SKILL.md` są publicznie pobieralne przez raw GitHub URL
- [ ] Kreator onboardingu pokazuje krok tour „How It Works” tier na świeżym setupie
- [ ] Widget pokrycia tierów na home dashboard pokazuje liczby configured/active

---

# Release Checklist

> **Last updated:** 2026-08-28 — v3.8.51
> Streamlined release flow that leverages Claude Code skills for automation.
>
> **Keep the queue/branch green between releases:** see [RELEASE_GREEN.md](./RELEASE_GREEN.md)
> (`/green-prs` family + `npm run check:release-green` + `/babysit` + nightly). Running
> this periodically — and especially **before** this checklist — makes the release PR start green.

## TL;DR

```bash
# 1. Bump version + generate CHANGELOG (skill)
/version-bump-cc patch    # or minor/major

# 2. Run quality gate locally
npm run check              # lint + tests
npm run test:coverage      # full coverage gate (60/60/60/60)

# 3. Build & smoke
npm run build
npm run test:e2e           # optional but recommended

# 4. Generate release (skill)
/generate-release-cc

# 5. Deploy (skill)
/deploy-vps-both-cc        # or akamai-cc / local-cc

# 6. Capture release evidences (skill)
/capture-release-evidences-cc
```

## npm Trusted Publishing (default since v3.8.51) — staged on request, direct as fallback

`npm-publish.yml` publishes through **npm Trusted Publishing (OIDC)** by default: the
`stage-npm` job (github-hosted) exchanges GitHub's id-token for a short-lived npm
credential for that run — no long-lived npm token in the repository secrets, no 2FA prompt, provenance attached.
That is the bypass npm sanctions now that tokens which skip 2FA are being retired;
it restores the fully automatic flow the project had up to v3.8.48 while keeping the
WS1.3 guarantee (a leaked token cannot publish alone — there is no token).

**One-time setup (owner):** npmjs.com → package `omniroute` → Settings → _Trusted
Publisher_ → GitHub: owner `diegosouzapw`, repo `OmniRoute`, workflow `npm-publish.yml`
(environment: none). Until that exists, the automatic step fails with `ENEEDAUTH`:
re-dispatch with `publish_mode=staged` (below) or `direct`.

### Staged publishing (on request — `publish_mode=staged`)

The npm-publish workflow no longer publishes directly: it boots the packed tarball
(`check:pack-boot`) and then runs `npm stage publish` — the exact bytes are parked on
the registry, **not installable** until the owner approves. The human 2FA gate moved
to AFTER the proof, not before it.

**Owner flow after the workflow goes green:**

1. `npm stage list omniroute` — find the stage id (also printed in the workflow summary).
2. Verify the staged bytes (recommended): `npm stage download <id>`, then install the
   downloaded tarball into a temp prefix and boot it (`npm run check:pack-boot` automates
   the same pack→install→boot verdict in CI).
3. `npm stage approve <id>` — the 2FA prompt IS the publish. `npm stage reject <id>` discards.
4. Post-publish net: the post-publish verifier (WS1.4 of the v3.8.49 plan) installs the
   published version from the public registry in a clean container and boots it.

**Emergency fallback:** `workflow_dispatch` with `publish_mode=direct` restores the
legacy immediate `npm publish` (use only if staging itself misbehaves; record why).

**One-time hardening (owner, npmjs.com):** configure the Trusted Publisher for
`omniroute` in stage-only mode so a leaked long-lived token cannot `npm publish`
directly from anywhere — CI can only stage; only the owner's 2FA releases.

**Broken-artifact playbook (unchanged):** `npm deprecate omniroute@<bad> "<reason> — use <fixed>"`
as the default reflex (minutes, reversible); `npm unpublish` only inside the 72h/no-dependents
window and never as the first move. Docker: never rewrite a version tag — rollback is
repointing `latest` to the last good digest.

**Docker Hub `latest` (required on every stable SemVer publish):** the
`docker-publish` workflow must tag **both** `X.Y.Z` and, when
`should-promote-latest.sh` agrees this is the highest stable SemVer, `:latest`
with the **same digest**. After the job: Hub `latest` digest equals the new
SemVer digest and `last_updated` moved. Do not leave `:latest` on an older
build while release notes talk about fixes that only exist on git. Compose
quickstarts use `:latest`; GitOps should keep pinning `X.Y.Z`. See
[Docker release channels](../guides/DOCKER_GUIDE.md#release-channels) and #10317.

## Hotfix Fast-Lane (label `hotfix`)

A PR labeled `hotfix` skips the heavy CI matrix (9-shard E2E, coverage ratchet,
quality-gate, quality-extended) and keeps the fast, high-signal gates: build,
unit shards, integration, vitest, lint/typecheck, docs-sync, `check:pack-artifact`
and the tarball boot-smoke (`check:pack-boot`). Target: green in ≤15min instead of ~33min.

**Entry policy — all four required (modeled on Chromium/VS Code/Node emergency lanes):**

1. **Severity**: production is broken — a published artifact crashes on boot / a
   security fix / every user of the release is affected. "Important" is not "broken".
2. **Authority**: only the repository owner applies the `hotfix` label. The label IS
   the approval — never self-serve on a campaign PR.
3. **Evidence**: the PR body links the previous fully-green heavy run (the suite the
   skipped jobs would re-validate) plus the fix's own failing-then-passing test.
4. **Scope**: cherry-pick-only — the minimal fix, no refactors, no ride-alongs.

The skipped coverage/ratchet surface is re-validated by the next full run on the
release branch (continuous release-green) — the lane skips WAITING, never validation.
Tests-only diffs (all files under `tests/`, none under `tests/e2e/`) skip the E2E
matrix automatically, without any label.

## Detailed Checklist

### Pre-release

- [ ] All PRs targeted to this release are merged to `release/vX.Y.0`
- [ ] All open Linear/issue items for this version are closed or pushed to next milestone
- [ ] CI green on `release/vX.Y.0` branch
- [ ] No `TODO(release)` markers in code: `grep -r "TODO(release)" src/ open-sse/`
- [ ] Docker base image up to date (currently `node:24.15.0-trixie-slim`)

### Version & Changelog

- [ ] Run `/version-bump-cc <patch|minor|major>` (Claude Code skill)
  - Bumps `package.json` (the `apps/desktop/src-tauri/tauri.conf.json` version is synced to it)
  - Regenerates `CHANGELOG.md` from git commits since last tag
  - Updates README.md badges
- [ ] Manually review CHANGELOG.md and clean up commit messages if needed
- [ ] Ensure the latest semver section in `CHANGELOG.md` equals `package.json` version
- [ ] Keep `## [Unreleased]` as the first changelog section for upcoming work
- [ ] Update `docs/openapi.yaml` → `info.version` must equal `package.json` version

### Code Quality

- [ ] `npm run lint` — 0 errors (warnings are pre-existing)
- [ ] `npm run typecheck:core` — clean
- [ ] `npm run typecheck:noimplicit:core` — clean (strict)
- [ ] `npm run check:cycles` — no circular deps
- [ ] `npm run check:any-budget:t11` — within budget
- [ ] `npm run check:route-validation:t06` — clean
- [ ] `npm run check:node-runtime` — supported runtime floor met (`>=22.22.2 <23`, `>=24.0.0 <27`, per `SUPPORTED_NODE_RANGE` in `src/shared/utils/nodeRuntimeSupport.ts`; aligned with `package.json` `engines`)

### Testing

- [ ] `npm run test:unit` — pass
- [ ] `npm run test:vitest` — pass (MCP server, autoCombo, cache)
- [ ] `npm run test:coverage` — gate 60/60/60/60 satisfied (statements/lines/functions/branches)
- [ ] `npm run test:integration` — pass (if changes touch DB / handlers)
- [ ] `npm run test:combo:matrix` — pass (combo strategy matrix: proves all 19 public routing strategies' selection decisions deterministically; run when touching combo routing, strategy resolution, or fallback logic)
- [ ] `RUN_COMBO_LIVE=1 npm run test:combo:live` — **optional/manual** (gated real-upstream smoke; sources a read-only DB snapshot from VPS `root@192.168.0.15`; hits real providers, costs credits; never runs in CI; skips cleanly without the gate)
- [ ] `npm run test:combo:live:vps` — **optional/manual** (Phase-3 VPS live smoke: 7 HTTP scenarios against the live `.15` server via plain Node ESM; requires `ssh root@192.168.0.15`; creates/deletes only `__live_test__*` combos; hits real providers; never runs in CI)
- [ ] `npm run test:e2e` — pass (UI changes)
- [ ] `npm run test:protocols:e2e` — pass (MCP/A2A changes)
- [ ] `npm run test:ecosystem` — pass

### Hooks (Husky validated)

Husky hooks live in `.husky/` and run automatically on git operations.

- **pre-commit:** `npx lint-staged + node scripts/check/check-docs-sync.mjs + npm run check:any-budget:t11`
- **pre-push:** fast deterministic gates — `npm run check:any-budget:t11 && npm run check:tracked-artifacts` (activated 2026-06-13). Intentionally excludes `test:unit` (slow; covered by the CI `test-unit` job).
  - Run `npm run test:unit` manually before pushing release branches.

If a hook fails: fix the underlying issue, don't bypass with `--no-verify`.

### Conventional Commits

All release-bound commits must follow `type(scope): subject` format.

**Valid types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `ci`

**Valid scopes:** `db`, `sse`, `oauth`, `dashboard`, `api`, `cli`, `docker`, `ci`, `mcp`, `a2a`, `memory`, `skills`, `cloud-agent`, `guardrails`, `compression`, `auto-combo`, `resilience`, `providers`, `executors`, `translator`, `domain`, `authz`

Breaking changes: add `BREAKING CHANGE:` footer or `!` after the scope (e.g. `feat(api)!: drop /v0`).

### Documentation

- [ ] `npm run check:docs-sync` passes (auto-run by pre-commit)
- [ ] `npm run check:docs-all` passes (umbrella: docs-sync + docs-counts + env-doc-sync + deprecated-versions + doc-links)
- [ ] `npm run check:env-doc-sync` exits 0 — code ↔ `.env.example` ↔ `docs/reference/ENVIRONMENT.md` env contract is intact
- [ ] `npm run check:doc-links` exits 0 — no broken internal markdown references after restructuring
- [ ] `docs/architecture/ARCHITECTURE.md` reviewed for storage/runtime drift
- [ ] `docs/guides/TROUBLESHOOTING.md` reviewed for env var and operational drift
- [ ] If `.env.example` changed: `docs/reference/ENVIRONMENT.md` updated
- [ ] If new feature has a UI: `docs/guides/USER_GUIDE.md` mentions it
- [ ] If new feature has API: `docs/reference/API_REFERENCE.md` + `docs/openapi.yaml` updated
- [ ] If new feature is a module: dedicated `docs/<MODULE>.md` exists
- [ ] If breaking change: `docs/guides/TROUBLESHOOTING.md` has migration note

### i18n

- [ ] `npm run i18n:check` exits 0 — translation state (`.i18n-state.json`) in sync with source docs (no drifted sources in strict mode; warn-mode advisory is acceptable for last-minute doc touch-ups, but should be 0 before tagging)
- [ ] `npm run i18n:check-ui-coverage` exits 0 — every UI locale at or above the 80% coverage floor
- [ ] `npm run i18n:sync-ui:dry` reports 0 missing keys across all 42 locales
- [ ] If source English docs changed, run `npm run i18n:run` (requires `OMNIROUTE_TRANSLATION_API_KEY` in `.env`) before tagging
- [ ] Translation contributions can be deferred to next release if minor (track in CHANGELOG)

### Database Migrations

- [ ] If `src/lib/db/migrations/` has new files:
  - [ ] Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, etc.)
  - [ ] Migrations wrapped in transactions
  - [ ] Numbered correctly (no gaps in sequence)
- [ ] Test on fresh install: delete `~/.omniroute/omniroute.db` and run `npm run dev`
- [ ] Test on existing install: backup DB, run migration, verify schema
- [ ] WAL files (`-wal`, `-shm`) handled correctly if migration rewrites tables

### Provider Catalog (Zod-validated)

- [ ] `src/shared/constants/providers.ts` Zod schema valid at load time
  - [ ] All providers have required fields (`id`, `label`, `kind`, etc.)
  - [ ] `freeNote` provided for new free providers
  - [ ] OAuth providers have `oauthConfig` registered in `src/lib/oauth/constants/oauth.ts`
- [ ] If new provider added: corresponding executor in `open-sse/executors/`
- [ ] If non-OpenAI format: translator in `open-sse/translator/`
- [ ] Models registered in `open-sse/config/providerRegistry.ts`
- [ ] Unit tests in `tests/unit/` cover provider classification and routing

### Desktop (Tauri 2)

If `apps/desktop/` changed:

- [ ] `cd apps/desktop/src-tauri && cargo tauri build` succeeds for the target platform
- [ ] Desktop shell tests pass (`npm --prefix apps/desktop run smoke`)
- [ ] Code signing certs not expired (if signing)
- [ ] `apps/desktop/src-tauri/tauri.conf.json` version matches root `package.json`
- [ ] Auto-update channel pointer updated if releasing to `stable`

### Build Layout

The repository uses three distinct output directories — never mix them up:

| Directory | Purpose                                                  | Tracked?        |
| --------- | -------------------------------------------------------- | --------------- |
| `src/`    | Application source (TypeScript / TSX)                    | Yes             |
| `.build/` | Build intermediates — `next build` output (`distDir`)    | No (gitignored) |
| `dist/`   | Shippable npm bundle — assembled by `assembleStandalone` | No (gitignored) |

> **Operator note:** the remote VPS image directory remains `/usr/lib/node_modules/omniroute/app/`.
> Only the **in-repo** build output moved (`app/` → `dist/`). The deploy skills rsync
> `dist/` contents into the remote `app/` dir — no VPS path changes required.

**Single-build flow:**

```
npm run build:release
  └─ rm -rf .build dist          (clean)
  └─ next build → .build/next/   (intermediates)
  └─ assembleStandalone          (copies standalone + static + public + natives → dist/)
  └─ writes dist/BUILD_SHA       (HEAD sentinel)
```

Do NOT run `npm run build` followed by a separate `npm run build:cli` for deploy — use
`npm run build:release` which does a clean rebuild + sentinel in one command.

### Artifact Validation

- [ ] `npm run build:release` succeeds and `dist/BUILD_SHA` == `git rev-parse --short HEAD`
- [ ] `npm run check:pack-artifact` clean — no `app.__qa_backup`, `scripts/scratch`, `package-lock.json`, or other local residue
- [ ] `dist/server.js` exists after build

### Tagging & Release

- [ ] Run `/generate-release-cc` (Claude Code skill):
  - Creates tag `vX.Y.Z`
  - Pushes tag and branch
  - Opens GitHub Release with changelog body
  - Attaches Tauri desktop installers (if built)
- [ ] Or manually:
  ```bash
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  gh release create vX.Y.Z --notes-from-tag
  ```

### Deploy

Deploy skills use the light rsync flow — no `npm pack`, no `npm i -g`:

- [ ] Use deploy skill that matches target:
  - `/deploy-vps-local-cc` — local VPS (192.168.0.15)
  - `/deploy-vps-akamai-cc` — Akamai VPS (69.164.221.35)
  - `/deploy-vps-both-cc` — both
- [ ] Before deploying, confirm `dist/BUILD_SHA` == `git rev-parse --short HEAD`
- [ ] Build must run where `node_modules` is real (main checkout or `npm ci`'d worktree — NOT a symlinked worktree)
- [ ] Smoke test deployed instance:
  - Open `/dashboard/health` → check version string matches release
  - Run a `/v1/chat/completions` request against a known provider
  - Verify `/api/monitoring/health` returns `CLOSED` circuit breakers
  - Confirm MCP transports respond (`/mcp` HTTP, `/mcp-sse` SSE)

### Post-release

- [ ] Run `/capture-release-evidences-cc` (Claude Code skill)
  - Captures WebP screenshots/recordings of new features
  - Attaches to release notes / blog post
- [ ] Update GitHub Discussions / Discord with release announcement
- [ ] Open milestone for next version
- [ ] If critical: pin discussion or post in `news.json` for in-app banner

### Radar public-launch gate

The Radar announcement is intentionally committed with `active: false`. Activation is a separate
change after every item below is evidenced:

- [ ] All stacked Radar PRs are merged and the release-tip CI is green
- [ ] Deploy and smoke the OSS Radar routes with `RADAR_ENABLED` still off by default
- [ ] Smoke `GET /planos`, `/termos`, `/privacidade`, and `/reembolso` on the named Radar host
- [ ] Record operator identity/contact/address and owner-approved legal review in the private service
- [ ] Exercise Stripe Checkout and the signed webhook in test mode only
- [ ] Exercise one encrypted transactional-email delivery with the approved sender/domain
- [ ] Prove backup restore and one supervised, budget-capped research run
- [ ] Approve the BRL/PIX review policy before accepting donation evidence
- [ ] Enable public Checkout only after the preceding gates, then activate the new `news.json` ID
- [ ] Verify the Home banner uses localized copy and a new ID reappears after an older ID is dismissed

## Embedded Services smoke (v3.8.4+)

Before shipping any release that includes embedded services changes, verify:

### Fresh-DB boot (catches migration collisions — added after v3.8.4 hotfix)

- [ ] `DATA_DIR=$(mktemp -d) npm start &` — wait 10 s for boot
- [ ] `curl -s http://127.0.0.1:20128/api/services/9router/status | jq '.tool'` returns `"9router"` (NOT 404, NOT 500). Confirms migration `071_services.sql` applied + row seeded.
- [ ] `sqlite3 $DATA_DIR/storage.sqlite "PRAGMA table_info(version_manager);" | grep -E "provider_expose|logs_buffer_path|last_sync_at"` returns 3 rows.
- [ ] `sqlite3 $DATA_DIR/storage.sqlite "PRAGMA table_info(webhooks);" | grep -E "kind|metadata_encrypted"` returns 2 rows (validates `070_webhooks_kind_metadata.sql` applied).
- [ ] `node --import tsx/esm --test tests/unit/db/no-migration-collisions.test.ts` passes — guards against future collisions.

### 9Router

- [ ] `POST /api/services/9router/install` returns 200 with `installedVersion` in under 2 min
- [ ] `POST /api/services/9router/start` returns 200 and `state: "running"` in under 30 s
- [ ] `GET /api/services/9router/status` reports `health: "healthy"`
- [ ] `POST /v1/chat/completions` with `"model": "9router/auto/..."` returns 200 (end-to-end routing through 9Router)
- [ ] `GET /dashboard/providers/services/9router/embed/dashboard` renders the 9Router native UI inside the proxy (no direct `127.0.0.1:port` iframe)
- [ ] `POST /api/services/9router/rotate-key` returns `{ keyRotated: true }` and service restarts cleanly
- [ ] `POST /api/services/9router/stop` returns 200 and `state: "stopped"`
- [ ] `GET /api/services/9router/logs?tail=50` returns SSE stream with `snapshot` event containing recent lines
- [ ] Install in environment without `npm` in PATH returns 500 with a friendly (non-stack-trace) error message

### CLIProxyAPI

- [ ] `POST /api/services/cliproxy/install` returns 200 in under 2 min
- [ ] `POST /api/services/cliproxy/start` returns 200 and `state: "running"` in under 30 s
- [ ] `GET /api/services/cliproxy/status` reports `health: "healthy"`
- [ ] `POST /api/services/cliproxy/stop` returns 200 and `state: "stopped"`
- [ ] `GET /api/services/cliproxy/logs?tail=50` returns SSE stream

### Security regression

- [ ] `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:20128/api/services/9router/start` returns `403 LOCAL_ONLY`
- [ ] `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:20128/api/services/cliproxy/start` returns `403 LOCAL_ONLY`
- [ ] Error responses from `/api/services/*` do not contain `err.stack` or absolute file paths

## v3.8.0+ checks

Before shipping any v3.8.x release, verify these additional items:

- [ ] `omniroute --tray` boots on macOS (systray2 installed into `~/.omniroute/runtime/`)
- [ ] `omniroute --tray` boots on Linux (requires DISPLAY; graceful error if not set)
- [ ] `omniroute --tray` boots on Windows (PowerShell NotifyIcon, no extra binaries)
- [ ] `omniroute config tray enable` creates autostart entry; disable removes it
- [ ] `npm install -g omniroute@<this-version>` runs postinstall without fatal exit
- [ ] Update path keeps optional deps: `omniroute update --apply` and the auto-updater
      run `npm install -g … --include=optional` so `optionalDependencies` (better-sqlite3,
      keytar, tls-client, and the llmlingua SLM stack: `@atjsh/llmlingua-2@2.0.5`,
      `js-tiktoken`) survive an update. The ultra `modelPath` SLM tier also needs the
      tinybert model, auto-downloaded to `${DATA_DIR}/models/llmlingua` on first use. Postinstall
      (`scripts/build/colocateOptionals.mjs`) then co-locates the SLM optional closure into
      `dist/node_modules` so the worker resolves a SINGLE `@huggingface/transformers` ^4.2.0
      instance — the standalone trace bundles only transformers, not the dynamically-imported
      optionals, so without this the worker would load llmlingua-2 against the root's transformers
      and the SLM tier would silently fail-open.
- [ ] `omniroute status` works with no `.env` (CLI token path, loopback only)
- [ ] `curl http://localhost:20128/api/shutdown` returns 401 (always-protected route)
- [ ] `curl -H "host: evil.com" http://localhost:20128/api/mcp/sse` returns 401 (loopback guard)
- [ ] SQLite runtime resolves to `bundled` on first run (bundled binary valid for platform)
- [ ] SQLite runtime falls back to `runtime` when `node_modules/better-sqlite3` is deleted
- [ ] Smart MCP filter compresses real `playwright-mcp browser_snapshot` output (≥50% reduction)
- [ ] All 10 `skills/omniroute*/SKILL.md` files are publicly fetchable via raw GitHub URL
- [ ] Onboarding wizard shows "How It Works" tier tour step on fresh setup
- [ ] Home dashboard tier coverage widget shows configured/active counts

---

## Rollback

If release has critical issue:

1. `gh release edit vX.Y.Z --prerelease` (marks as not latest)
2. `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z` (only if not yet adopted by users)
3. Or: hotfix on `release/vX.Y.0` → patch release `vX.Y.(Z+1)`
4. Communicate in GitHub Discussions and Discord immediately

## Hard Rules

- Never commit directly to `main`
- Never use `git push --force` to `main` or `release/*` branches
- Never skip Husky hooks (`--no-verify`)
- Never commit secrets, credentials, or `.env` files
- Coverage must stay ≥60/60/60/60 (statements/lines/functions/branches)
- Always include or update tests when changing production code in `src/`, `open-sse/`, or `bin/`

## Automated Sync Check

Run the docs sync guard locally before opening a PR:

```bash
npm run check:docs-sync
```

CI also runs this check in `.github/workflows/ci.yml` (lint job).
