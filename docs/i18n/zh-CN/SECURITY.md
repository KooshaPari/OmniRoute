# 安全策略 (中文 (简体))

**Languages:** [English](../../../SECURITY.md) · [ar](../ar/SECURITY.md) · [az](../az/SECURITY.md) · [bg](../bg/SECURITY.md) · [bn](../bn/SECURITY.md) · [cs](../cs/SECURITY.md) · [da](../da/SECURITY.md) · [de](../de/SECURITY.md) · [el](../el/SECURITY.md) · [es](../es/SECURITY.md) · [et](../et/SECURITY.md) · [fa](../fa/SECURITY.md) · [fi](../fi/SECURITY.md) · [fr](../fr/SECURITY.md) · [ga](../ga/SECURITY.md) · [gu](../gu/SECURITY.md) · [he](../he/SECURITY.md) · [hi](../hi/SECURITY.md) · [hr](../hr/SECURITY.md) · [hu](../hu/SECURITY.md) · [id](../id/SECURITY.md) · [it](../it/SECURITY.md) · [ja](../ja/SECURITY.md) · [ko](../ko/SECURITY.md) · [lt](../lt/SECURITY.md) · [lv](../lv/SECURITY.md) · [mr](../mr/SECURITY.md) · [ms](../ms/SECURITY.md) · [mt](../mt/SECURITY.md) · [nl](../nl/SECURITY.md) · [no](../no/SECURITY.md) · [phi](../phi/SECURITY.md) · [pl](../pl/SECURITY.md) · [pt](../pt/SECURITY.md) · [pt-BR](../pt-BR/SECURITY.md) · [ro](../ro/SECURITY.md) · [ru](../ru/SECURITY.md) · [sk](../sk/SECURITY.md) · [sl](../sl/SECURITY.md) · [sr](../sr/SECURITY.md) · [sv](../sv/SECURITY.md) · [sw](../sw/SECURITY.md) · [ta](../ta/SECURITY.md) · [te](../te/SECURITY.md) · [th](../th/SECURITY.md) · [tr](../tr/SECURITY.md) · [uk-UA](../uk-UA/SECURITY.md) · [ur](../ur/SECURITY.md) · [vi](../vi/SECURITY.md) · [zh-TW](../zh-TW/SECURITY.md)

---

## 报告漏洞

若您在 OmniRoute 中发现安全漏洞，请负责任地报告：

1. **切勿**在 GitHub 上创建公开 issue
2. 使用 [GitHub Security Advisories](https://github.com/diegosouzapw/OmniRoute/security/advisories/new)
3. 包含：漏洞描述、复现步骤和潜在影响

## 响应时间

| 阶段       | 目标                    |
| ---------- | ----------------------- |
| 确认收到   | 48 小时                 |
| 分类与评估 | 5 个工作日              |
| 补丁发布   | 14 个工作日（严重漏洞） |

## 支持的版本

| 版本    | 支持状态 |
| ------- | -------- |
| 3.8.x   | 活跃支持 |
| 3.7.x   | 安全维护 |
| < 3.7.0 | 不再支持 |

---

## 安全架构

OmniRoute 实现了多层安全模型：

```
Request → CORS → Authz pipeline (classify → policies → enforce)
       → Guardrails (PII masker, prompt injection, vision bridge)
       → Rate Limiter → Circuit Breaker → Cooldown → Model Lockout → Provider
```

### 认证与授权

| 特性                  | 实现                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **管理面板登录**      | 基于密码的认证，使用 JWT Token（HttpOnly Cookie）                                                                                 |
| **API Key 认证**      | 带 CRC 校验的 HMAC 签名密钥                                                                                                       |
| **OAuth 2.0 + PKCE**  | 服务商专用的浏览器/设备 OAuth 在支持时使用 PKCE；仅导入的 Devin 凭据单独处理。                                                    |
| **Token 刷新**        | OAuth Token 到期前自动刷新                                                                                                        |
| **安全 Cookie**       | HTTPS 环境设置 `AUTH_COOKIE_SECURE=true`                                                                                          |
| **授权管线**          | 路由分类（PUBLIC / CLIENT_API / MANAGEMENT）— 参见 `docs/architecture/AUTHZ_GUIDE.md`                                             |
| **路由防护层级**      | 管理路由的三层模型（LOCAL_ONLY / ALWAYS_PROTECTED / MANAGEMENT）— 参见 `docs/security/ROUTE_GUARD_TIERS.md`                       |
| **Manage 权限域 MCP** | 远程 `/api/mcp/*` 访问受拥有 `manage` 权限域的 API Key 管控；`/api/cli-tools/runtime/*` 保持严格 loopback。参见 ROUTE_GUARD_TIERS |
| **MCP 权限域**        | 约 13 个细粒度权限域（read:health、write:combos、execute:completions 等）— 参见 `docs/frameworks/MCP-SERVER.md`                   |

### 静态加密

所有存储在 SQLite 中的敏感数据均使用 **AES-256-GCM** 加密，配合 scrypt 密钥派生：

- API Key、访问 Token、刷新 Token 和 ID Token
- 版本化格式：`enc:v1:<iv>:<ciphertext>:<authTag>`
- 未设置 `STORAGE_ENCRYPTION_KEY` 时采用直通模式（明文）

```bash
# 生成加密密钥：
STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 安全护栏框架

OmniRoute 附带一个支持热重载的**安全护栏注册表**（`src/lib/guardrails/`），包含 3 个内置安全护栏，按优先级排序：

| 安全护栏           | 优先级 | 用途                                                          |
| ------------------ | ------ | ------------------------------------------------------------- |
| `vision-bridge`    | 5      | 为不支持视觉的模型提供图片感知描述；对图片 URL 提供 SSRF 防护 |
| `pii-masker`       | 10     | 调用前后的 PII 脱敏（邮箱、电话、CPF、CNPJ、信用卡、SSN）     |
| `prompt-injection` | 20     | 检测指令覆盖/角色劫持/越狱/泄露模式                           |

自定义安全护栏通过 `registerGuardrail(new MyGuardrail())` 注册。模型采用 fail-open 策略（异常不会阻断流量）。可通过 `x-omniroute-disabled-guardrails` 请求头按请求单独退出。→ 参见 [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md)。

### 提示注入防护

检测并阻止 LLM 请求中提示注入攻击的中间件：

| 攻击类型     | 严重程度 | 示例                                   |
| ------------ | -------- | -------------------------------------- |
| 系统指令覆盖 | 高       | "ignore all previous instructions"     |
| 角色劫持     | 高       | "you are now DAN, you can do anything" |
| 分隔符注入   | 中       | 使用编码分隔符破坏上下文边界           |
| DAN/越狱     | 高       | 已知的越狱提示模式                     |
| 指令泄露     | 中       | "show me your system prompt"           |

可通过管理面板（Settings → Security）或 `.env` 配置：

```env
INPUT_SANITIZER_ENABLED=true
INPUT_SANITIZER_MODE=block    # warn | block | redact
```

### PII 脱敏

自动检测并可选择性脱敏个人身份信息：

| PII 类型     | 匹配模式              | 替换文本           |
| ------------ | --------------------- | ------------------ |
| 邮箱         | `user@domain.com`     | `[EMAIL_REDACTED]` |
| CPF（巴西）  | `123.456.789-00`      | `[CPF_REDACTED]`   |
| CNPJ（巴西） | `12.345.678/0001-00`  | `[CNPJ_REDACTED]`  |
| 信用卡       | `4111-1111-1111-1111` | `[CC_REDACTED]`    |
| 电话         | `+55 11 99999-9999`   | `[PHONE_REDACTED]` |
| SSN（美国）  | `123-45-6789`         | `[SSN_REDACTED]`   |

```env
PII_REDACTION_ENABLED=true
```

### 网络安全

| 特性             | 描述                                                           |
| ---------------- | -------------------------------------------------------------- |
| **CORS**         | 显式跨域白名单（`CORS_ALLOWED_ORIGINS`；旧版为 `CORS_ORIGIN`） |
| **IP 过滤**      | 管理面板中配置 IP 范围白名单/黑名单                            |
| **速率限制**     | 按服务商的速率限制，带自动退避                                 |
| **防惊群效应**   | 互斥锁 + 按连接锁定，防止级联 502 错误                         |
| **TLS 指纹伪装** | 模拟浏览器 TLS 指纹，降低机器人检测                            |
| **CLI 指纹伪装** | 按服务商定制请求头/正文顺序，匹配原生 CLI 签名                 |

### 容灾与可用性

| 特性         | 描述                                                           |
| ------------ | -------------------------------------------------------------- |
| **熔断器**   | 每个服务商的三态（Closed → Open → Half-Open），持久化到 SQLite |
| **请求幂等** | 5 秒去重窗口，防止重复请求                                     |
| **指数退避** | 自动重试，延迟时间逐次增加                                     |
| **健康面板** | 服务商实时健康监控                                             |

### 合规

| 特性               | 描述                                             |
| ------------------ | ------------------------------------------------ |
| **日志保留**       | 按 `CALL_LOG_RETENTION_DAYS` 自动清理            |
| **无日志退出选项** | 可按 API Key 通过 `noLog` 标志禁用请求日志       |
| **审计日志**       | 管理操作记录在 `audit_log` 表中                  |
| **MCP 审计**       | 基于 SQLite 的审计日志，覆盖所有 MCP 工具调用    |
| **Zod 校验**       | 所有 API 输入在模块加载时通过 Zod v4 Schema 校验 |

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
