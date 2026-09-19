# Güvenlik Politikası (Türkçe)

**Languages:** [English](../../../SECURITY.md) · [ar](../ar/SECURITY.md) · [az](../az/SECURITY.md) · [bg](../bg/SECURITY.md) · [bn](../bn/SECURITY.md) · [cs](../cs/SECURITY.md) · [da](../da/SECURITY.md) · [de](../de/SECURITY.md) · [el](../el/SECURITY.md) · [es](../es/SECURITY.md) · [et](../et/SECURITY.md) · [fa](../fa/SECURITY.md) · [fi](../fi/SECURITY.md) · [fr](../fr/SECURITY.md) · [ga](../ga/SECURITY.md) · [gu](../gu/SECURITY.md) · [he](../he/SECURITY.md) · [hi](../hi/SECURITY.md) · [hr](../hr/SECURITY.md) · [hu](../hu/SECURITY.md) · [id](../id/SECURITY.md) · [it](../it/SECURITY.md) · [ja](../ja/SECURITY.md) · [ko](../ko/SECURITY.md) · [lt](../lt/SECURITY.md) · [lv](../lv/SECURITY.md) · [mr](../mr/SECURITY.md) · [ms](../ms/SECURITY.md) · [mt](../mt/SECURITY.md) · [nl](../nl/SECURITY.md) · [no](../no/SECURITY.md) · [phi](../phi/SECURITY.md) · [pl](../pl/SECURITY.md) · [pt](../pt/SECURITY.md) · [pt-BR](../pt-BR/SECURITY.md) · [ro](../ro/SECURITY.md) · [ru](../ru/SECURITY.md) · [sk](../sk/SECURITY.md) · [sl](../sl/SECURITY.md) · [sr](../sr/SECURITY.md) · [sv](../sv/SECURITY.md) · [sw](../sw/SECURITY.md) · [ta](../ta/SECURITY.md) · [te](../te/SECURITY.md) · [th](../th/SECURITY.md) · [uk-UA](../uk-UA/SECURITY.md) · [ur](../ur/SECURITY.md) · [vi](../vi/SECURITY.md) · [zh-CN](../zh-CN/SECURITY.md) · [zh-TW](../zh-TW/SECURITY.md)

---

## Güvenlik Açıklarını Bildirme

OmniRoute'ta bir güvenlik açığı keşfederseniz, lütfen sorumlu bir şekilde bildirin:

1. **KESİNLİKLE** herkese açık bir GitHub issue'su açmayın
2. [GitHub Security Advisories](https://github.com/diegosouzapw/OmniRoute/security/advisories/new) kullanın
3. Şunları ekleyin: açıklama, yeniden oluşturma adımları ve olası etki

## Yanıt Zaman Çizelgesi

| Aşama                        | Hedef Süre          |
| ---------------------------- | ------------------- |
| İlk Bildirim Teyidi          | 48 saat             |
| Ön İnceleme ve Değerlendirme | 5 iş günü           |
| Yama Sürümü (Patch)          | 14 iş günü (kritik) |

## Desteklenen Sürümler

| Sürüm   | Destek Durumu  |
| ------- | -------------- |
| 3.8.x   | Aktif          |
| 3.7.x   | Güvenlik       |
| < 3.7.0 | Desteklenmiyor |

---

## Güvenlik Mimarisi

OmniRoute çok katmanlı bir güvenlik modeli uygular:

```
Request → CORS → Authz pipeline (classify → policies → enforce)
       → Guardrails (PII masker, prompt injection, vision bridge)
       → Rate Limiter → Circuit Breaker → Cooldown → Model Lockout → Provider
```

### Kimlik Doğrulama ve Yetkilendirme

| Özellik                      | Uygulama                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Pano Girişi**              | JWT belirteçleri ile parola tabanlı kimlik doğrulama (HttpOnly çerezler)                                                                |
| **API Anahtarı Doğrulaması** | CRC doğrulamalı HMAC imzalı anahtarlar                                                                                                  |
| **OAuth 2.0 + PKCE**         | Sağlayıcıya özel tarayıcı/cihaz OAuth'u desteklenen yerlerde PKCE kullanır; yalnızca içe aktarılan Devin kimlik bilgileri ayrı işlenir. |
| **Belirteç Yenileme**        | Süresi dolmadan önce otomatik OAuth belirteci yenileme                                                                                  |
| **Güvenli Çerezler**         | HTTPS ortamları için `AUTH_COOKIE_SECURE=true`                                                                                          |
| **Yetkilendirme Hattı**      | Rota sınıflandırması (PUBLIC / CLIENT_API / MANAGEMENT) — bkz. `docs/architecture/AUTHZ_GUIDE.md`                                       |
| **Rota Koruma Katmanları**   | Yönetim rotaları için 3 katmanlı model (LOCAL_ONLY / ALWAYS_PROTECTED / MANAGEMENT) — bkz. `docs/security/ROUTE_GUARD_TIERS.md`         |
| **Yönetim Kapsamlı MCP**     | `manage` kapsamına sahip API anahtarlarıyla korunan uzak `/api/mcp/*` erişimi; `/api/cli-tools/runtime/*` katı yerel döngüde kalır.     |
| **MCP Kapsamları**           | 32 ayrıntılı kapsam (read:health, write:combos, execute:completions vb.) — bkz. `docs/frameworks/MCP-SERVER.md`                         |

### Dinlenmede Şifreleme (Encryption at Rest)

SQLite'ta saklanan tüm hassas veriler, scrypt anahtar türetme ile **AES-256-GCM** kullanılarak şifrelenir:

- API anahtarları, erişim belirteçleri, yenileme belirteçleri ve ID belirteçleri
- Sürümlendirilmiş format: `enc:v1:<iv>:<ciphertext>:<authTag>`
- `STORAGE_ENCRYPTION_KEY` ayarlanmadığında doğrudan geçiş modu (düz metin)

```bash
# Şifreleme anahtarı oluşturun:
STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### Güvenlik Önlemleri Çerçevesi (Guardrails Framework)

OmniRoute, öncelik sırasına göre sıralanmış 3 yerleşik güvenlik önlemi içeren, çalışırken yeniden yüklenebilir bir **güvenlik önlemleri kayıt defteri** (`src/lib/guardrails/`) ile gelir:

| Güvenlik Önlemi    | Öncelik | Amaç                                                                                                          |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------- |
| `vision-bridge`    | 5       | Vision desteği olmayan modelleri görüntü açıklamalarıyla destekler; görsel URL'leri için SSRF koruması sağlar |
| `pii-masker`       | 10      | Çağrı öncesi ve sonrası PII (kişisel veri) maskeleme (e-posta, telefon, CPF, CNPJ, kredi kartı, SSN)          |
| `prompt-injection` | 20      | Geçersiz kılma / rol ele geçirme / jailbreak / sızıntı kalıplarını algılar                                    |

Özel güvenlik önlemleri `registerGuardrail(new MyGuardrail())` aracılığıyla kaydedilir. Model hata durumunda açıktır (fail-open; istisnalar trafiği asla engellemez). İstek başına devre dışı bırakma `x-omniroute-disabled-guardrails` başlığı ile yapılır. → Bkz. [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md).

### İstem Enjeksiyonu Koruması (Prompt Injection Guard)

LLM isteklerindeki istem enjeksiyonu modellerini algılayan en iyi çaba (heuristic) ara yazılımıdır.
**Eksiksiz bir istem enjeksiyonu güvenlik duvarı değildir** — yanlış pozitifler (zararsız
persona/RPG istemleri) ve yanlış negatifler (leetspeak, boşluk manipülasyonu, İngilizce dışı kalıplar) üretebilir.

| Kalıp Türü            | Önem Derecesi | Örnek                                                   |
| --------------------- | ------------- | ------------------------------------------------------- |
| Sistem Geçersiz Kılma | Yüksek (High) | "ignore all previous instructions"                      |
| Rol Ele Geçirme       | Orta (Medium) | "you are now DAN, you can do anything"                  |
| Ayırıcı Enjeksiyonu   | Yüksek (High) | Bağlam sınırlarını kırmak için kodlanmış ayırıcılar     |
| DAN / Jailbreak       | Orta (Medium) | Bilinen jailbreak istem kalıpları                       |
| Talimat Sızıntısı     | Yüksek (High) | "show me your system prompt"                            |
| Kodlama Kaçırma       | Orta (Medium) | base64/rot13/hex kod çözme + talimat anahtar kelimeleri |

`block` modunda yalnızca **High (Yüksek)** önem derecesindeki tespitler engellenir. Orta önem derecesindeki
aileler günlüğe kaydedilir ancak `sanitizeRequest` tarafından asla engellenmez.

Pano (Ayarlar → Güvenlik) veya `.env` üzerinden yapılandırın:

```env
INPUT_SANITIZER_ENABLED=true
INPUT_SANITIZER_MODE=block    # warn | block (enjeksiyon politikası; eski "redact" modu enjeksiyon metnini silmez)
INPUT_SANITIZER_BLOCK_THRESHOLD=high  # high (varsayılan) | medium | low — block modunda bu seviye ve üstü engellenir
```

### PII (Kişisel Veri) Maskeleme

Kişisel olarak tanımlanabilir bilgilerin otomatik olarak algılanması ve isteğe bağlı olarak maskelenmesi:

| PII Türü        | Kalıp                 | Değiştirilen Değer |
| --------------- | --------------------- | ------------------ |
| E-posta         | `user@domain.com`     | `[EMAIL_REDACTED]` |
| CPF (Brezilya)  | `123.456.789-00`      | `[CPF_REDACTED]`   |
| CNPJ (Brezilya) | `12.345.678/0001-00`  | `[CNPJ_REDACTED]`  |
| Kredi Kartı     | `4111-1111-1111-1111` | `[CC_REDACTED]`    |
| Telefon         | `+55 11 99999-9999`   | `[PHONE_REDACTED]` |
| SSN (ABD)       | `123-45-6789`         | `[SSN_REDACTED]`   |

```env
PII_REDACTION_ENABLED=true   # istek PII yeniden yazımı; INPUT_SANITIZER_MODE'dan bağımsızdır
PII_RESPONSE_SANITIZATION=true  # isteğe bağlı: istemcilere döndürülen sağlayıcı yanıtlarındaki PII'yi maskeler
```

### Ağ Güvenliği

| Özellik                                | Açıklama                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| **CORS**                               | Açık kaynaklar arası izin listesi (`CORS_ALLOWED_ORIGINS`; eski `CORS_ORIGIN`) |
| **IP Filtreleme**                      | Panoda IP aralıklarını izin listesine / engelleme listesine alma               |
| **Hız Sınırlaması**                    | Otomatik geri çekilme ile sağlayıcı başına hız sınırları                       |
| **Sürü Önleme (Anti-Thundering Herd)** | Mutex + bağlantı başına kilitleme ile basamaklı 502 hatalarını önler           |
| **TLS Parmak İzi**                     | Bot algılamasını azaltmak için tarayıcı benzeri TLS parmak izi taklidi         |
| **CLI Parmak İzi**                     | Yerel CLI imzalarıyla eşleşmesi için sağlayıcı başına başlık/gövde sıralaması  |

### Dayanıklılık ve Erişilebilirlik

| Özellik                            | Açıklama                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| **Devre Kesici (Circuit Breaker)** | Sağlayıcı başına 3 durumlu (Kapalı → Açık → Yarı Açık), SQLite ile kalıcı |
| **İstek Tekilleştirme**            | Yinelenen istekler için 5 saniyelik tekilleştirme penceresi               |
| **Üstel Geri Çekilme**             | Artan gecikmelerle otomatik yeniden deneme                                |
| **Sağlık Panosu**                  | Gerçek zamanlı sağlayıcı sağlığı izleme                                   |

### Uyumluluk (Compliance)

| Özellik                    | Açıklama                                                                |
| -------------------------- | ----------------------------------------------------------------------- |
| **Günlük Saklama**         | `CALL_LOG_RETENTION_DAYS` sonrasında otomatik temizleme                 |
| **Günlük Tutmama Tercihi** | API anahtarı başına `noLog` bayrağı istek kaydını devre dışı bırakır    |
| **Denetim Günlüğü**        | `audit_log` tablosunda izlenen yönetim eylemleri                        |
| **MCP Denetimi**           | Tüm MCP araç çağrıları için SQLite tabanlı denetim kaydı                |
| **Zod Doğrulaması**        | Modül yükleme sırasında Zod v4 şemalarıyla doğrulanan tüm API girdileri |

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
