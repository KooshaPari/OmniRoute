# Polityka bezpieczeństwa

## Zgłaszanie luk bezpieczeństwa

Jeśli odkryjesz lukę bezpieczeństwa w OmniRoute, zgłoś ją w odpowiedzialny sposób:

1. **NIE** otwieraj publicznego zgłoszenia (issue) na GitHub
2. Użyj [GitHub Security Advisories](https://github.com/diegosouzapw/OmniRoute/security/advisories/new)
3. Dołącz: opis, kroki reprodukcji oraz potencjalny wpływ

## Harmonogram reakcji

| Etap             | Cel                          |
| ---------------- | ---------------------------- |
| Potwierdzenie    | 48 godzin                    |
| Triage i ocena   | 5 dni roboczych              |
| Wydanie poprawki | 14 dni roboczych (krytyczne) |

## Wspierane wersje

| Wersja  | Status wsparcia   |
| ------- | ----------------- |
| 3.8.x   | ✅ Aktywne        |
| 3.7.x   | ✅ Bezpieczeństwo |
| < 3.7.0 | ❌ Niewspierane   |

---

## Architektura bezpieczeństwa

OmniRoute wdraża wielowarstwowy model bezpieczeństwa:

```
Request → CORS → Authz pipeline (classify → policies → enforce)
       → Guardrails (PII masker, prompt injection, vision bridge)
       → Rate Limiter → Circuit Breaker → Cooldown → Model Lockout → Provider
```

### 🔐 Uwierzytelnianie i autoryzacja

| Funkcja               | Implementacja                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard Login**   | Uwierzytelnianie hasłem z tokenami JWT (ciasteczka HttpOnly)                                                                                        |
| **API Key Auth**      | Klucze podpisane HMAC z walidacją CRC                                                                                                               |
| **OAuth 2.0 + PKCE**  | Przepływy OAuth w przeglądarce/na urządzeniu używają PKCE, gdy dostawca je obsługuje; importowane poświadczenia Devin są obsługiwane osobno.        |
| **Token Refresh**     | Automatyczne odświeżanie tokenów OAuth przed wygaśnięciem                                                                                           |
| **Secure Cookies**    | `AUTH_COOKIE_SECURE=true` dla środowisk HTTPS                                                                                                       |
| **Authz Pipeline**    | Klasyfikacja tras (PUBLIC / CLIENT_API / MANAGEMENT) — zob. `docs/architecture/AUTHZ_GUIDE.md`                                                      |
| **Route Guard Tiers** | Model 3-poziomowy dla tras zarządzania (LOCAL_ONLY / ALWAYS_PROTECTED / MANAGEMENT) — zob. `docs/security/ROUTE_GUARD_TIERS.md`                     |
| **Manage-Scope MCP**  | Zdalny dostęp `/api/mcp/*` ograniczony kluczami API ze scope `manage`; `/api/cli-tools/runtime/*` pozostaje strict-loopback. Zob. ROUTE_GUARD_TIERS |
| **MCP Scopes**        | 32 granularne scope'y (read:health, write:combos, execute:completions itd.) — zob. `docs/frameworks/MCP-SERVER.md`                                  |

### 🛡️ Szyfrowanie w spoczynku

Wszystkie wrażliwe dane przechowywane w SQLite są szyfrowane algorytmem **AES-256-GCM** z derywacją klucza scrypt:

- Klucze API, tokeny dostępu, tokeny odświeżania oraz tokeny ID
- Wersjonowany format: `enc:v1:<iv>:<ciphertext>:<authTag>`
- Tryb passthrough (tekst jawny), gdy `STORAGE_ENCRYPTION_KEY` nie jest ustawiony

```bash
# Generate encryption key:
STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 🛡️ Framework Guardrails

OmniRoute dostarcza przeładowywalny na gorąco **rejestr guardrails** (`src/lib/guardrails/`) z 3 wbudowanymi guardrails uporządkowanymi według priorytetu:

| Guardrail          | Priorytet | Cel                                                                                      |
| ------------------ | --------- | ---------------------------------------------------------------------------------------- |
| `vision-bridge`    | 5         | Mostkuje modele bez wizji opisami uwzględniającymi obraz; ochrona SSRF dla URL-i obrazów |
| `pii-masker`       | 10        | Redakcja PII przed i po wywołaniu (e-maile, telefon, CPF, CNPJ, karty kredytowe, SSN)    |
| `prompt-injection` | 20        | Wykrywa wzorce override / role-hijack / jailbreak / leak                                 |

Własne guardrails rejestruje się przez `registerGuardrail(new MyGuardrail())`. Model jest fail-open (wyjątki nigdy nie blokują ruchu). Rezygnacja per żądanie przez nagłówek `x-omniroute-disabled-guardrails`. → Zob. [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md).

### 🧠 Ochrona przed prompt injection

Heurystyczny middleware best-effort, który wykrywa wzorce prompt injection w żądaniach LLM.
**To nie jest kompletna zapora przed prompt injection** — może generować fałszywe alarmy (nieszkodliwe
prompty persona/RPG) oraz pomijać ataki (leetspeak, odstępy, wzorce w innych językach).

| Typ wzorca          | Dotkliwość | Przykład                                                 |
| ------------------- | ---------- | -------------------------------------------------------- |
| System Override     | High       | "ignore all previous instructions"                       |
| Role Hijack         | Medium     | "you are now DAN, you can do anything"                   |
| Delimiter Injection | High       | Zakodowane separatory łamiące granice kontekstu          |
| DAN/Jailbreak       | Medium     | Znane wzorce promptów jailbreak                          |
| Instruction Leak    | High       | "show me your system prompt"                             |
| Encoding Evasion    | Medium     | dekodowanie base64/rot13/hex + słowa kluczowe instrukcji |

W trybie `block` blokowane są wyłącznie detekcje o dotkliwości **High**. Rodziny o
dotkliwości Medium są logowane, ale nigdy nie blokowane przez `sanitizeRequest`.

Konfiguracja przez dashboard (Settings → Security) lub `.env`:

```env
INPUT_SANITIZER_ENABLED=true
INPUT_SANITIZER_MODE=block    # warn | block (injection policy; legacy "redact" does not strip injection text)
INPUT_SANITIZER_BLOCK_THRESHOLD=high  # high (default) | medium | low — severities at/above this are blocked in block mode
```

### 🔒 Redakcja PII

Automatyczne wykrywanie i opcjonalna redakcja danych osobowych (PII):

| Typ PII       | Wzorzec               | Zamiennik          |
| ------------- | --------------------- | ------------------ |
| Email         | `user@domain.com`     | `[EMAIL_REDACTED]` |
| CPF (Brazil)  | `123.456.789-00`      | `[CPF_REDACTED]`   |
| CNPJ (Brazil) | `12.345.678/0001-00`  | `[CNPJ_REDACTED]`  |
| Credit Card   | `4111-1111-1111-1111` | `[CC_REDACTED]`    |
| Phone         | `+55 11 99999-9999`   | `[PHONE_REDACTED]` |
| SSN (US)      | `123-45-6789`         | `[SSN_REDACTED]`   |

```env
PII_REDACTION_ENABLED=true   # request PII rewrite; independent of INPUT_SANITIZER_MODE
PII_RESPONSE_SANITIZATION=true  # optional: redact PII in provider responses returned to clients
```

### 🌐 Bezpieczeństwo sieci

| Funkcja                  | Opis                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| **CORS**                 | Jawna lista dozwolonych originów (`CORS_ALLOWED_ORIGINS`; legacy `CORS_ORIGIN`) |
| **IP Filtering**         | Listy allowlist/blocklist zakresów IP w dashboardzie                            |
| **Rate Limiting**        | Limity zapytań per dostawca z automatycznym backoffiem                          |
| **Anti-Thundering Herd** | Mutex + blokady per połączenie zapobiegają kaskadowym 502                       |
| **TLS Fingerprint**      | Spoofing odcisku TLS jak w przeglądarce w celu ograniczenia detekcji botów      |
| **CLI Fingerprint**      | Kolejność nagłówków/ciała per dostawca dopasowana do natywnych sygnatur CLI     |

### 🔌 Odporność i dostępność

| Funkcja                 | Opis                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| **Circuit Breaker**     | 3 stany (Closed → Open → Half-Open) per dostawca, utrwalone w SQLite |
| **Request Idempotency** | 5-sekundowe okno deduplikacji dla powielonych żądań                  |
| **Exponential Backoff** | Automatyczne ponawianie z rosnącymi opóźnieniami                     |
| **Health Dashboard**    | Monitorowanie zdrowia dostawców w czasie rzeczywistym                |

### 📋 Zgodność

| Funkcja            | Opis                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| **Log Retention**  | Automatyczne czyszczenie po `CALL_LOG_RETENTION_DAYS`                    |
| **No-Log Opt-out** | Flaga `noLog` per klucz API wyłącza logowanie żądań                      |
| **Audit Log**      | Działania administracyjne śledzone w tabeli `audit_log`                  |
| **MCP Audit**      | Audyt w SQLite dla wszystkich wywołań narzędzi MCP                       |
| **Zod Validation** | Wszystkie wejścia API walidowane schematami Zod v4 przy ładowaniu modułu |

---

## Wymagane zmienne środowiskowe

Wszystkie sekrety muszą być ustawione przed uruchomieniem serwera. Serwer **zakończy się natychmiast (fail fast)**, jeśli brakuje ich lub są słabe.

```bash
# REQUIRED — server will not start without these:
JWT_SECRET=$(openssl rand -base64 48)     # min 32 chars
API_KEY_SECRET=$(openssl rand -hex 32)    # min 16 chars

# RECOMMENDED — enables encryption at rest:
STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

Serwer aktywnie odrzuca znane słabe wartości, takie jak `changeme`, `secret` lub `password`.

---

## Docker Security

- Use non-root user in production
- Mount secrets as read-only volumes
- Never copy `.env` files into Docker images
- Use `.dockerignore` to exclude sensitive files
- Set `AUTH_COOKIE_SECURE=true` when behind HTTPS

```bash
docker run -d \
  --name omniroute \
  --restart unless-stopped \
  --read-only \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e API_KEY_SECRET="$(openssl rand -hex 32)" \
  -e STORAGE_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  diegosouzapw/omniroute:latest
```

---

## Dependencies

- Run `npm audit` regularly (`npm run audit:deps` audits the root package)
- Keep dependencies updated
- The project uses `husky` + `lint-staged` for pre-commit checks (lint-staged + check-docs-sync + check:any-budget:t11)
- CI pipeline runs ESLint security rules on every push (`no-eval`, `no-implied-eval`, `no-new-func` = error)
- Provider constants validated at module load via Zod (`src/shared/validation/schemas.ts`)
- Secure-by-default libraries used: `dompurify` / `isomorphic-dompurify` (XSS), `jose` (JWT), `better-sqlite3` (no SQLi risk via parameterized queries), `bcryptjs` (password hashing)

## Hard Security Rules

These rules are enforced by tooling and reviewers:

1. **Never commit secrets** — `.env` is gitignored; `.env.example` is the template (no literals, comments only — see PUBLIC_CREDS.md below)
2. **Never use `eval()`, `new Function()`, or implied eval** — ESLint enforces
3. **Never bypass Husky hooks** (`--no-verify`, `--no-gpg-sign`) without explicit operator approval
4. **Never write raw SQL in routes** — always go through `src/lib/db/` (parameterized)
5. **Always validate inputs with Zod** — `src/shared/validation/schemas.ts`
6. **Always sanitize upstream headers** — denylist in `src/shared/constants/upstreamHeaders.ts`
7. **Encrypt credentials at rest** — AES-256-GCM via `src/lib/db/encryption.ts`
8. **Public upstream OAuth identifiers via `resolvePublicCred()`** — never embed `AIza…` / `GOCSPX-…` / `…apps.googleusercontent.com` literals in source. See [`docs/security/PUBLIC_CREDS.md`](docs/security/PUBLIC_CREDS.md).
9. **Error responses through `buildErrorBody()` / `sanitizeErrorMessage()`** — never put raw `err.stack` / `err.message` in HTTP / SSE / executor / MCP response bodies. See [`docs/security/ERROR_SANITIZATION.md`](docs/security/ERROR_SANITIZATION.md).
10. **`exec()` / `spawn()` runtime values via the `env` option** — never string-interpolate external paths or untrusted values into shell-passed scripts. Reference: `src/mitm/cert/install.ts::updateNssDatabases`.
11. **Prefer secure-by-default libraries** — see [tldrsec/awesome-secure-defaults](https://github.com/tldrsec/awesome-secure-defaults) (Helmet.js, DOMPurify, ssrf-req-filter, safe-regex, Google Tink). Reach for them before rolling your own.

## Supply-chain scanner findings (Socket.dev / Snyk / similar)

The published `omniroute` npm artifact bundles the Next.js `output: "standalone"`
build, which means every route handler — including documented privileged
features (MITM, Zed import, Cloud Sync, embedded service supervisor) — ends
up in `.next/server/*.js` minified chunks. Heuristic supply-chain scanners
frequently pattern-match those chunks against malware signatures.

The scanner configuration we use lives at [`socket.yml`](socket.yml) in the
repo root (Socket.dev GitHub App format v2 — see
<https://docs.socket.dev/docs/socket-yml>). It explicitly excludes
non-shipped directories (`tests/`, `_tasks/`, `_references/`, `_ideia/`,
`_mono_repo/`, `docs/`, etc.) so the scanner only reports on code paths that
actually reach published users — the scan itself is driven by the Socket
GitHub App reading that file, not by a workflow in this repository.

For each finding category we maintain a per-finding maintainer attestation:

- **[`docs/security/SOCKET_DEV_FINDINGS.md`](docs/security/SOCKET_DEV_FINDINGS.md)** —
  per-finding map: source file ↔ flagged chunk ↔ behaviour ↔ mitigation
  applied in v3.8.6.
- In-source `SECURITY-AUDITOR-NOTE:` blocks at each flagged function point
  back to the same document.

For users whose pipeline cannot relax the alert: build with
`OMNIROUTE_BUILD_PROFILE=minimal npm run build`. That replaces the four
sensitive modules with stubs that return HTTP 503 `feature-disabled` at
runtime, so the privileged code paths are physically absent from the bundle.
See [`docs/security/SOCKET_DEV_FINDINGS.md`](docs/security/SOCKET_DEV_FINDINGS.md)
for the publishing recipe.

## References

- [`docs/architecture/AUTHZ_GUIDE.md`](docs/architecture/AUTHZ_GUIDE.md) — authorization pipeline
- [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md) — guardrails framework
- [`docs/security/COMPLIANCE.md`](docs/security/COMPLIANCE.md) — audit log and retention
- [`docs/security/PUBLIC_CREDS.md`](docs/security/PUBLIC_CREDS.md) — **mandatory** pattern for public upstream credentials
- [`docs/security/ERROR_SANITIZATION.md`](docs/security/ERROR_SANITIZATION.md) — **mandatory** pattern for error responses
- [`docs/security/SOCKET_DEV_FINDINGS.md`](docs/security/SOCKET_DEV_FINDINGS.md) — maintainer attestation for supply-chain scanner findings
- [`docs/architecture/RESILIENCE_GUIDE.md`](docs/architecture/RESILIENCE_GUIDE.md) — circuit breaker + cooldown + lockout
- [`docs/security/STEALTH_GUIDE.md`](docs/security/STEALTH_GUIDE.md) — TLS fingerprinting (legal/ethical notice)
- [`CLAUDE.md`](CLAUDE.md) — hard rules for AI agents
- [tldrsec/awesome-secure-defaults](https://github.com/tldrsec/awesome-secure-defaults) — curated secure-by-default libraries
