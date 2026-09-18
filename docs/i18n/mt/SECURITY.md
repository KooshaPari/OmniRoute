# Security Policy (Malti)

🌐 **Languages:** 🇺🇸 [English](../../../SECURITY.md) · 🇸🇦 [ar](../ar/SECURITY.md) · 🇦🇿 [az](../az/SECURITY.md) · 🇧🇬 [bg](../bg/SECURITY.md) · 🇧🇩 [bn](../bn/SECURITY.md) · 🇨🇿 [cs](../cs/SECURITY.md) · 🇩🇰 [da](../da/SECURITY.md) · 🇩🇪 [de](../de/SECURITY.md) · 🇬🇷 [el](../el/SECURITY.md) · 🇪🇸 [es](../es/SECURITY.md) · 🇪🇪 [et](../et/SECURITY.md) · 🇮🇷 [fa](../fa/SECURITY.md) · 🇫🇮 [fi](../fi/SECURITY.md) · 🇫🇷 [fr](../fr/SECURITY.md) · 🇮🇪 [ga](../ga/SECURITY.md) · 🇮🇳 [gu](../gu/SECURITY.md) · 🇮🇱 [he](../he/SECURITY.md) · 🇮🇳 [hi](../hi/SECURITY.md) · 🇭🇷 [hr](../hr/SECURITY.md) · 🇭🇺 [hu](../hu/SECURITY.md) · 🇮🇩 [id](../id/SECURITY.md) · 🇮🇹 [it](../it/SECURITY.md) · 🇯🇵 [ja](../ja/SECURITY.md) · 🇰🇷 [ko](../ko/SECURITY.md) · 🇱🇹 [lt](../lt/SECURITY.md) · 🇱🇻 [lv](../lv/SECURITY.md) · 🇮🇳 [mr](../mr/SECURITY.md) · 🇲🇾 [ms](../ms/SECURITY.md) · 🇳🇱 [nl](../nl/SECURITY.md) · 🇳🇴 [no](../no/SECURITY.md) · 🇵🇭 [phi](../phi/SECURITY.md) · 🇵🇱 [pl](../pl/SECURITY.md) · 🇵🇹 [pt](../pt/SECURITY.md) · 🇧🇷 [pt-BR](../pt-BR/SECURITY.md) · 🇷🇴 [ro](../ro/SECURITY.md) · 🇷🇺 [ru](../ru/SECURITY.md) · 🇸🇰 [sk](../sk/SECURITY.md) · 🇸🇮 [sl](../sl/SECURITY.md) · 🇷🇸 [sr](../sr/SECURITY.md) · 🇸🇪 [sv](../sv/SECURITY.md) · 🇰🇪 [sw](../sw/SECURITY.md) · 🇮🇳 [ta](../ta/SECURITY.md) · 🇮🇳 [te](../te/SECURITY.md) · 🇹🇭 [th](../th/SECURITY.md) · 🇹🇷 [tr](../tr/SECURITY.md) · 🇺🇦 [uk-UA](../uk-UA/SECURITY.md) · 🇵🇰 [ur](../ur/SECURITY.md) · 🇻🇳 [vi](../vi/SECURITY.md) · 🇨🇳 [zh-CN](../zh-CN/SECURITY.md) · 🇹🇼 [zh-TW](../zh-TW/SECURITY.md)

---

## Rappurtar ta' Vulnerabbiltajiet

Jekk tiskopri vulnerabbiltà tas-sigurtà f'OmniRoute, jekk jogħġbok irrapportaha b'mod responsabbli:

1. **TIFTAĦX** kwistjoni pubblika fuq GitHub
2. Uża l-[Avviżi tas-Sigurtà ta' GitHub](https://github.com/diegosouzapw/OmniRoute/security/advisories/new)
3. Inkludi: deskrizzjoni, passi għar-riproduzzjoni, u l-impatt potenzjali

## Skeda taż-Żmien għar-Rispons

| Stadju                          | Mira                           |
| ------------------------------- | ------------------------------ |
| Konferma tar-Riċevuta           | 48 siegħa                      |
| Klassifikazzjoni u Valutazzjoni | 5 ijiem tax-xogħol             |
| Ħruġ tal-Garża                  | 14-il jum tax-xogħol (kritika) |

## Verżjonijiet Appoġġjati

| Verżjoni | Status tal-Appoġġ |
| -------- | ----------------- |
| 3.8.x    | ✅ Attiv          |
| 3.7.x    | ✅ Sigurtà        |
| < 3.7.0  | ❌ Mhux Appoġġjat |

---

## Arkitettura tas-Sigurtà

OmniRoute jimplimenta mudell tas-sigurtà b'diversi saffi:

```
Talba → CORS → Pipeline tal-awtorizzazzjoni (ikklassifika → politiki → infurza)
      → Salvagwardji (maskra tal-PII, injezzjoni tal-prompt, pont tal-viżjoni)
      → Limitatur tar-Rata → Circuit Breaker → Perjodu ta' Stennija → Imblukkar tal-Mudell → Fornitur
```

### 🔐 Awtentikazzjoni u Awtorizzazzjoni

| Karatteristika                        | Implimentazzjoni                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login fil-Pannell**                 | Awtentikazzjoni bbażata fuq password b'tokens JWT (cookies HttpOnly)                                                                                                            |
| **Awtentikazzjoni b'API Key**         | Ċwievet iffirmati b'HMAC b'validazzjoni CRC                                                                                                                                     |
| **OAuth 2.0 + PKCE**                  | L-OAuth tal-browser/apparat speċifiku għall-fornitur juża PKCE fejn ikun appoġġjat; il-kredenzjali Devin għall-importazzjoni biss jiġu ttrattati separatament.                  |
| **Aġġornament tat-Token**             | Aġġornament awtomatiku tat-token OAuth qabel jiskadi                                                                                                                            |
| **Cookies Sikuri**                    | `AUTH_COOKIE_SECURE=true` għal ambjenti HTTPS                                                                                                                                   |
| **Pipeline tal-Awtorizzazzjoni**      | Klassifikazzjoni tar-rotot (PUBLIC / CLIENT_API / MANAGEMENT) — ara `docs/architecture/AUTHZ_GUIDE.md`                                                                          |
| **Livelli ta' Protezzjoni tar-Rotot** | Mudell bi 3 livelli għar-rotot tal-ġestjoni (LOCAL_ONLY / ALWAYS_PROTECTED / MANAGEMENT) — ara `docs/security/ROUTE_GUARD_TIERS.md`                                             |
| **MCP bl-Ambitu tal-Ġestjoni**        | L-aċċess remot għal `/api/mcp/*` huwa kkontrollat minn API keys bl-ambitu `manage`; `/api/cli-tools/runtime/*` jibqa' ristrett strettament għal loopback. Ara ROUTE_GUARD_TIERS |
| **Ambiti MCP**                        | 32 ambitu granulari (read:health, write:combos, execute:completions, eċċ.) — ara `docs/frameworks/MCP-SERVER.md`                                                                |

### 🛡️ Kriptaġġ tad-Data Maħżuna

Id-data sensittiva kollha maħżuna f'SQLite hija kriptata bl-użu ta' **AES-256-GCM** b'derivazzjoni taċ-ċavetta permezz ta' scrypt:

- API keys, tokens tal-aċċess, tokens tal-aġġornament, u tokens tal-ID
- Format b'verżjoni: `enc:v1:<iv>:<ciphertext>:<authTag>`
- Modalità passthrough (test sempliċi) meta `STORAGE_ENCRYPTION_KEY` ma tkunx issettjata

```bash
# Iġġenera ċ-ċavetta tal-kriptaġġ:
STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 🛡️ Qafas tas-Salvagwardji

OmniRoute jinkludi **reġistru tas-salvagwardji** li jista' jerġa' jitgħabba waqt it-tħaddim (`src/lib/guardrails/`) bi 3 salvagwardji integrati, ordnati skont il-prijorità:

| Salvagwardja       | Prijorità | Għan                                                                                                                      |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `vision-bridge`    | 5         | Jgħaqqad mudelli mingħajr viżjoni ma' deskrizzjonijiet konxji tal-immaġnijiet; protezzjoni SSRF għal URLs tal-immaġnijiet |
| `pii-masker`       | 10        | Ċensura tal-PII qabel u wara s-sejħa (emails, telefown, CPF, CNPJ, karti ta' kreditu, SSN)                                |
| `prompt-injection` | 20        | Jidentifika mudelli ta' sovrascrittura/ħtif tar-rwol/jailbreak/tnixxija                                                   |

Salvagwardji personalizzati jiġu rreġistrati permezz ta' `registerGuardrail(new MyGuardrail())`. Il-mudell huwa fail-open (l-eċċezzjonijiet qatt ma jimblukkaw it-traffiku). Tista' tagħżel li ma tużahomx għal kull talba permezz tal-header `x-omniroute-disabled-guardrails`. → Ara [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md).

### 🧠 Protezzjoni Kontra l-Injezzjoni tal-Prompt

Middleware ewristiku tal-aħjar sforz li jidentifika mudelli ta' injezzjoni tal-prompt fit-talbiet lil LLM.
**Mhuwiex firewall komplut kontra l-injezzjoni tal-prompt** — jista' jipproduċi pożittivi foloz (prompts
innokwi ta' persona/RPG) u negattivi foloz (leetspeak, spazjar, mudelli mhux bl-Ingliż).

| Tip ta' Mudell                      | Severità | Eżempju                                                               |
| ----------------------------------- | -------- | --------------------------------------------------------------------- |
| Sovrascrittura tas-Sistema          | Għolja   | "injora l-istruzzjonijiet preċedenti kollha"                          |
| Ħtif tar-Rwol                       | Medja    | "issa int DAN, tista' tagħmel kollox"                                 |
| Injezzjoni tad-Delimitatur          | Għolja   | Separaturi kodifikati biex jiksru l-konfini tal-kuntest               |
| DAN/Jailbreak                       | Medja    | Mudelli magħrufa ta' prompts ta' jailbreak                            |
| Tnixxija tal-Istruzzjonijiet        | Għolja   | "urini l-prompt tas-sistema tiegħek"                                  |
| Evażjoni permezz tal-Kodifikazzjoni | Medja    | Dekodifikazzjoni base64/rot13/hex + kliem ewlieni tal-istruzzjonijiet |

Huma biss l-identifikazzjonijiet ta' severità **Għolja** li jiġu mblukkati fil-modalità `block`. Il-familji
ta' severità Medja jiġu rreġistrati fil-logs iżda qatt ma jiġu mblukkati minn `sanitizeRequest`.

Ikkonfigura permezz tal-pannell (Issettjar → Sigurtà) jew `.env`:

```env
INPUT_SANITIZER_ENABLED=true
INPUT_SANITIZER_MODE=block    # warn | block (politika tal-injezzjoni; il-modalità antika "redact" ma tneħħix it-test tal-injezzjoni)
INPUT_SANITIZER_BLOCK_THRESHOLD=high  # high (predefinit) | medium | low — is-severitajiet f'dan il-livell jew ogħla jiġu mblukkati fil-modalità block
```

### 🔒 Ċensura tal-PII

Identifikazzjoni awtomatika u ċensura fakultattiva ta' informazzjoni identifikabbli personalment:

| Tip ta' PII       | Mudell                | Sostituzzjoni      |
| ----------------- | --------------------- | ------------------ |
| Email             | `user@domain.com`     | `[EMAIL_REDACTED]` |
| CPF (Brażil)      | `123.456.789-00`      | `[CPF_REDACTED]`   |
| CNPJ (Brażil)     | `12.345.678/0001-00`  | `[CNPJ_REDACTED]`  |
| Karta ta' Kreditu | `4111-1111-1111-1111` | `[CC_REDACTED]`    |
| Telefown          | `+55 11 99999-9999`   | `[PHONE_REDACTED]` |
| SSN (US)          | `123-45-6789`         | `[SSN_REDACTED]`   |

```env
PII_REDACTION_ENABLED=true   # kitba mill-ġdid tal-PII fit-talba; indipendenti minn INPUT_SANITIZER_MODE
PII_RESPONSE_SANITIZATION=true  # fakultattiv: iċċensura l-PII fit-tweġibiet tal-fornitur mibgħuta lura lill-klijenti
```

### 🌐 Sigurtà tan-Network

| Karatteristika               | Deskrizzjoni                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **CORS**                     | Lista espliċita ta' oriġini permessi bejn oriġini differenti (`CORS_ALLOWED_ORIGINS`; `CORS_ORIGIN` huwa antik) |
| **Iffiltrar tal-IP**         | Firxiet ta' IP permessi/imblukkati fil-pannell                                                                  |
| **Limitazzjoni tar-Rata**    | Limiti tar-rata għal kull fornitur b'backoff awtomatiku                                                         |
| **Kontra t-Thundering Herd** | Mutex + qfil għal kull konnessjoni jipprevjenu żbalji 502 kaskata                                               |
| **Marka tas-Swaba' TLS**     | Simulazzjoni ta' marka tas-swaba' TLS simili għal browser biex titnaqqas l-identifikazzjoni tal-bots            |
| **Marka tas-Swaba' CLI**     | Ordni tal-headers/korp għal kull fornitur biex jaqbel mal-firem nattivi tas-CLI                                 |

### 🔌 Reżiljenza u Disponibbiltà

| Karatteristika              | Deskrizzjoni                                                                      |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Circuit Breaker**         | 3 stati (Magħluq → Miftuħ → Nofs Miftuħ) għal kull fornitur, persistenti f'SQLite |
| **Idempotenza tat-Talbiet** | Tieqa ta' deduplikazzjoni ta' 5 sekondi għal talbiet duplikati                    |
| **Backoff Esponenzjali**    | Tentattiv awtomatiku mill-ġdid b'dewmien dejjem jiżdied                           |
| **Pannell tas-Saħħa**       | Monitoraġġ f'ħin reali tas-saħħa tal-fornituri                                    |

### 📋 Konformità

| Karatteristika                  | Deskrizzjoni                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| **Żamma tal-Logs**              | Tindif awtomatiku wara `CALL_LOG_RETENTION_DAYS`                                      |
| **Għażla li Ma Jinżammux Logs** | Il-flag `noLog` għal kull API key jiddiżattiva r-reġistrazzjoni tat-talbiet           |
| **Log tal-Awditjar**            | L-azzjonijiet amministrattivi jiġu traċċati fit-tabella `audit_log`                   |
| **Awditjar MCP**                | Reġistrazzjoni tal-awditjar appoġġjata minn SQLite għas-sejħiet kollha tal-għodod MCP |
| **Validazzjoni Zod**            | L-inputs kollha tal-API jiġu vvalidati bi schemas Zod v4 waqt it-tagħbija tal-modulu  |

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
