# Security Policy (Latviešu)

**Languages:** [English](../../../SECURITY.md) · [ar](../ar/SECURITY.md) · [az](../az/SECURITY.md) · [bg](../bg/SECURITY.md) · [bn](../bn/SECURITY.md) · [cs](../cs/SECURITY.md) · [da](../da/SECURITY.md) · [de](../de/SECURITY.md) · [el](../el/SECURITY.md) · [es](../es/SECURITY.md) · [et](../et/SECURITY.md) · [fa](../fa/SECURITY.md) · [fi](../fi/SECURITY.md) · [fr](../fr/SECURITY.md) · [ga](../ga/SECURITY.md) · [gu](../gu/SECURITY.md) · [he](../he/SECURITY.md) · [hi](../hi/SECURITY.md) · [hr](../hr/SECURITY.md) · [hu](../hu/SECURITY.md) · [id](../id/SECURITY.md) · [it](../it/SECURITY.md) · [ja](../ja/SECURITY.md) · [ko](../ko/SECURITY.md) · [lt](../lt/SECURITY.md) · [mr](../mr/SECURITY.md) · [ms](../ms/SECURITY.md) · [mt](../mt/SECURITY.md) · [nl](../nl/SECURITY.md) · [no](../no/SECURITY.md) · [phi](../phi/SECURITY.md) · [pl](../pl/SECURITY.md) · [pt](../pt/SECURITY.md) · [pt-BR](../pt-BR/SECURITY.md) · [ro](../ro/SECURITY.md) · [ru](../ru/SECURITY.md) · [sk](../sk/SECURITY.md) · [sl](../sl/SECURITY.md) · [sr](../sr/SECURITY.md) · [sv](../sv/SECURITY.md) · [sw](../sw/SECURITY.md) · [ta](../ta/SECURITY.md) · [te](../te/SECURITY.md) · [th](../th/SECURITY.md) · [tr](../tr/SECURITY.md) · [uk-UA](../uk-UA/SECURITY.md) · [ur](../ur/SECURITY.md) · [vi](../vi/SECURITY.md) · [zh-CN](../zh-CN/SECURITY.md) · [zh-TW](../zh-TW/SECURITY.md)

---

## Ziņošana par ievainojamībām

Ja atklājat drošības ievainojamību OmniRoute, lūdzu, ziņojiet par to atbildīgi:

1. **NEIZVEIDOJIET** publisku GitHub issue
2. Izmantojiet [GitHub Security Advisories](https://github.com/diegosouzapw/OmniRoute/security/advisories/new)
3. Iekļaujiet: aprakstu, reproducēšanas darbības un iespējamo ietekmi

## Atbildes termiņi

| Posms                      | Mērķis                                |
| -------------------------- | ------------------------------------- |
| Apstiprinājums             | 48 stundas                            |
| Izskatīšana un novērtēšana | 5 darba dienas                        |
| Labojuma laidiens          | 14 darba dienas (kritiskām problēmām) |

## Atbalstītās versijas

| Versija | Atbalsta statuss  |
| ------- | ----------------- |
| 3.8.x   | Aktīva            |
| 3.7.x   | Drošības atbalsts |
| < 3.7.0 | Nav atbalstīta    |

---

## Drošības arhitektūra

OmniRoute izmanto daudzslāņu drošības modeli:

```
Pieprasījums → CORS → Autorizācijas konveijers (klasificēšana → politikas → izpilde)
       → Aizsargmehānismi (PII maskētājs, uzvedņu injekcijas, redzes tilts)
       → Ātruma ierobežotājs → Ķēdes pārtraucējs → Atdzišanas periods → Modeļa bloķēšana → Nodrošinātājs
```

### Autentifikācija un autorizācija

| Funkcija                             | Implementācija                                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Informācijas paneļa pieteikšanās** | Uz paroli balstīta autentifikācija ar JWT marķieriem (HttpOnly sīkfaili)                                                                                                                 |
| **API atslēgas autentifikācija**     | Ar HMAC parakstītas atslēgas ar CRC validāciju                                                                                                                                           |
| **OAuth 2.0 + PKCE**                 | Konkrētam nodrošinātājam paredzētais pārlūkprogrammas/ierīces OAuth izmanto PKCE, ja tas tiek atbalstīts; tikai importējamie Devin akreditācijas dati tiek apstrādāti atsevišķi.         |
| **Marķiera atjaunošana**             | Automātiska OAuth marķiera atjaunošana pirms derīguma termiņa beigām                                                                                                                     |
| **Drošie sīkfaili**                  | `AUTH_COOKIE_SECURE=true` HTTPS vidēm                                                                                                                                                    |
| **Autorizācijas konveijers**         | Maršruta klasificēšana (PUBLIC / CLIENT_API / MANAGEMENT) — skatiet `docs/architecture/AUTHZ_GUIDE.md`                                                                                   |
| **Maršruta aizsardzības līmeņi**     | Trīs līmeņu modelis pārvaldības maršrutiem (LOCAL_ONLY / ALWAYS_PROTECTED / MANAGEMENT) — skatiet `docs/security/ROUTE_GUARD_TIERS.md`                                                   |
| **Manage-scope MCP**                 | Attālināta piekļuve `/api/mcp/*` tiek kontrolēta ar API atslēgām, kurām ir `manage` tvērums; `/api/cli-tools/runtime/*` paliek stingri ierobežota ar loopback. Skatiet ROUTE_GUARD_TIERS |
| **MCP tvērumi**                      | 32 detalizēti tvērumi (read:health, write:combos, execute:completions u. c.) — skatiet `docs/frameworks/MCP-SERVER.md`                                                                   |

### Šifrēšana miera stāvoklī

Visi SQLite saglabātie sensitīvie dati tiek šifrēti, izmantojot **AES-256-GCM** ar scrypt atslēgas atvasināšanu:

- API atslēgas, piekļuves marķieri, atsvaidzināšanas marķieri un ID marķieri
- Versijots formāts: `enc:v1:<iv>:<ciphertext>:<authTag>`
- Caurlaides režīms (vienkāršs teksts), ja `STORAGE_ENCRYPTION_KEY` nav iestatīts

```bash
# Ģenerēt šifrēšanas atslēgu:
STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### Aizsargmehānismu ietvars

OmniRoute komplektācijā ir iekļauts dinamiski pārlādējams **aizsargmehānismu reģistrs** (`src/lib/guardrails/`) ar 3 iebūvētiem aizsargmehānismiem, kas sakārtoti pēc prioritātes:

| Aizsargmehānisms   | Prioritāte | Mērķis                                                                                              |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| `vision-bridge`    | 5          | Nodrošina ar attēliem saistītus aprakstus modeļiem bez redzes atbalsta; SSRF aizsardzība attēlu URL |
| `pii-masker`       | 10         | PII noņemšana pirms un pēc izsaukuma (e-pasti, tālruņa numuri, CPF, CNPJ, kredītkartes, SSN)        |
| `prompt-injection` | 20         | Nosaka ignorēšanas, lomas pārņemšanas, jailbreak un noplūdes modeļus                                |

Pielāgoti aizsargmehānismi tiek reģistrēti, izmantojot `registerGuardrail(new MyGuardrail())`. Modelis darbojas pēc principa fail-open (izņēmumi nekad nebloķē datplūsmu). Atteikšanās no aizsargmehānismiem katram pieprasījumam atsevišķi, izmantojot `x-omniroute-disabled-guardrails` galveni. → Skatiet [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md).

### Uzvedņu injekciju aizsargs

Heiristisks starpprogrammatūras risinājums ar labāko iespējamo efektivitāti, kas nosaka uzvedņu injekciju modeļus LLM pieprasījumos.  
**Tas nav pilnīgs uzvedņu injekciju ugunsmūris** — var rasties kļūdaini pozitīvi rezultāti (nekaitīgas
personas/RPG uzvednes) un kļūdaini negatīvi rezultāti (leetspeak, atstarpes, modeļi citās valodās).

| Modeļa tips          | Nopietnība | Piemērs                                              |
| -------------------- | ---------- | ---------------------------------------------------- |
| Sistēmas ignorēšana  | Augsta     | "ignore all previous instructions"                   |
| Lomas pārņemšana     | Vidēja     | "you are now DAN, you can do anything"               |
| Atdalītāja injekcija | Augsta     | Kodēti atdalītāji konteksta robežu pārraušanai       |
| DAN/Jailbreak        | Vidēja     | Zināmi jailbreak uzvedņu modeļi                      |
| Norādījumu noplūde   | Augsta     | "show me your system prompt"                         |
| Kodējuma apiešana    | Vidēja     | base64/rot13/hex dekodēšana + norādījumu atslēgvārdi |

Tikai **Augstas** nopietnības noteikšanas gadījumi tiek bloķēti `block` režīmā. Vidējas nopietnības
grupas tiek reģistrētas, taču `sanitizeRequest` tās nekad nebloķē.

Konfigurējiet, izmantojot informācijas paneli (Settings → Security) vai `.env`:

```env
INPUT_SANITIZER_ENABLED=true
INPUT_SANITIZER_MODE=block    # warn | block (injekciju politika; mantotais "redact" režīms nenoņem injekcijas tekstu)
INPUT_SANITIZER_BLOCK_THRESHOLD=high  # high (noklusējums) | medium | low — nopietnības līmeņi, sākot ar norādīto, tiek bloķēti block režīmā
```

### PII noņemšana

Automātiska personu identificējošas informācijas noteikšana un, pēc izvēles, noņemšana:

| PII tips         | Modelis               | Aizvietojums       |
| ---------------- | --------------------- | ------------------ |
| E-pasts          | `user@domain.com`     | `[EMAIL_REDACTED]` |
| CPF (Brazīlija)  | `123.456.789-00`      | `[CPF_REDACTED]`   |
| CNPJ (Brazīlija) | `12.345.678/0001-00`  | `[CNPJ_REDACTED]`  |
| Kredītkarte      | `4111-1111-1111-1111` | `[CC_REDACTED]`    |
| Tālruņa numurs   | `+55 11 99999-9999`   | `[PHONE_REDACTED]` |
| SSN (ASV)        | `123-45-6789`         | `[SSN_REDACTED]`   |

```env
PII_REDACTION_ENABLED=true   # pieprasīt PII pārrakstīšanu; neatkarīgi no INPUT_SANITIZER_MODE
PII_RESPONSE_SANITIZATION=true  # pēc izvēles: noņemt PII no klientiem atgrieztajām nodrošinātāju atbildēm
```

### Tīkla drošība

| Funkcija                                 | Apraksts                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **CORS**                                 | Skaidri definēts starpizcelsmju atļauto saraksts (`CORS_ALLOWED_ORIGINS`; mantotais `CORS_ORIGIN`) |
| **IP filtrēšana**                        | IP diapazonu atļauto/bloķēto saraksts informācijas panelī                                          |
| **Ātruma ierobežošana**                  | Ātruma ierobežojumi katram nodrošinātājam ar automātisku atkāpšanos                                |
| **Pret vienlaicīgu pieprasījumu lavīnu** | Mutekss + savienojumu bloķēšana novērš kaskādveida 502 kļūdas                                      |
| **TLS pirkstu nospiedums**               | Pārlūkprogrammai līdzīga TLS pirkstu nospieduma viltošana, lai mazinātu robotu noteikšanu          |
| **CLI pirkstu nospiedums**               | Galveņu/satura secība katram nodrošinātājam, lai atbilstu sākotnējā CLI parakstiem                 |

### Noturība un pieejamība

| Funkcija                           | Apraksts                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| **Ķēdes pārtraucējs**              | Trīs stāvokļi (Closed → Open → Half-Open) katram nodrošinātājam, saglabāti SQLite |
| **Pieprasījumu idempotence**       | 5 sekunžu deduplikācijas logs dublētiem pieprasījumiem                            |
| **Eksponenciāla atkāpšanās**       | Automātiska atkārtota mēģināšana ar pieaugošām aizturēm                           |
| **Veselības informācijas panelis** | Nodrošinātāju veselības uzraudzība reāllaikā                                      |

### Atbilstība

| Funkcija                        | Apraksts                                                               |
| ------------------------------- | ---------------------------------------------------------------------- |
| **Žurnālu saglabāšana**         | Automātiska tīrīšana pēc `CALL_LOG_RETENTION_DAYS`                     |
| **Atteikšanās no žurnalēšanas** | Katrai API atslēgai `noLog` karodziņš atspējo pieprasījumu žurnalēšanu |
| **Audita žurnāls**              | Administratīvās darbības tiek izsekotas `audit_log` tabulā             |
| **MCP audits**                  | Uz SQLite balstīta audita žurnalēšana visiem MCP rīku izsaukumiem      |
| **Zod validācija**              | Visas API ievades tiek validētas ar Zod v4 shēmām moduļa ielādes laikā |

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
