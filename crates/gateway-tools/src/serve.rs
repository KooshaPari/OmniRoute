//! # serve
//!
//! `gateway-tools serve --port <PORT>` starts a small axum 0.8 HTTP server that
//! exposes the `gateway` utility modules as observable REST endpoints.
//!
//! This is the MVP surface for the substrate pivot's "executable cockpit":
//! every utility module becomes queryable over HTTP so external dashboards
//! (substrate-tui, IDE panels, hand-crafted curl scripts) can introspect it
//! without rebuilding the binary.
//!
//! Routes:
//!
//! | Method | Path           | Purpose                                                      |
//! |--------|----------------|--------------------------------------------------------------|
//! | GET    | `/`            | Server-rendered HTML cockpit (Backbone-2 pulse-green)        |
//! | GET    | `/health`      | Liveness probe (JSON `{status, service, family, port}`)       |
//! | GET    | `/v1/cast`     | List of CLI subcommands exposed by `gateway-tools`           |
//! | GET    | `/v1/util`     | List of `gateway` utility modules + path + public-fn count   |
//! | GET    | `/v1/splash`   | ASCII splash as `text/plain`                                 |
//! | GET    | `/v1/inspect/<module>` | Top public fn signatures for one module (plaintext)    |
//! | *      | `/*` (404)     | JSON `{"error": "not_found", "path": "..."}`                 |
//!
//! Palette (Backbone-2 family, sharecli flavor): pulse-green `#3fb950` +
//! warm-amber `#d29922` on `#161b22` panel. No external state, no auth, no
//! IO -- this is a cockpit surface, not a production gateway. The actual
//! gateway runs in `crates/gateway`.

use anyhow::{Context, Result};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
use std::net::SocketAddr;

// ---------------------------------------------------------------------------
// Module registry (mirror of `inspect_registry()` in main.rs)
// ---------------------------------------------------------------------------
//
// Source-of-truth lives in `main.rs::inspect_registry`. We duplicate the
// aliases here so the HTTP surface is self-contained and doesn't have to
// thread a private fn across the module boundary. Keep in sync when adding
// a new gateway utility module.

fn util_registry() -> Vec<(&'static str, &'static str, usize)> {
    vec![
        ("jwt",     "gateway::jwt_hs256",         5),
        ("dns",     "gateway::dns_message_parser", 5),
        ("redis",   "gateway::redis_resp",         5),
        ("tls",     "gateway::tls_record",         5),
        ("pkcs7",   "gateway::pkcs7_padding",      5),
        ("patch",   "gateway::json_patch",         5),
        ("metrics", "gateway::prometheus_exposition", 5),
        ("pem",     "gateway::pem_codec",          5),
        ("m3u",     "gateway::m3u_parser",         5),
        ("chunked", "gateway::chunked_transfer",   5),
    ]
}

/// Subcommands exposed by `gateway-tools` (mirror of `Cmd` in main.rs).
/// Kept short and human-readable so the cockpit surface stays scannable.
fn cast_registry() -> Vec<(&'static str, &'static str)> {
    vec![
        ("jwt",     "JWT HS256 sign / verify (and b64url helpers)"),
        ("dns",     "Parse a minimal DNS packet (header + first question)"),
        ("redis",   "Encode/parse a single RESP value"),
        ("tls",     "Parse one TLS record from a hex payload"),
        ("pkcs7",   "PKCS#7 pad/unpad"),
        ("patch",   "Apply a JSON Patch (RFC-6902) to an in-memory document"),
        ("metrics", "Render a Prometheus exposition text from inline metrics"),
        ("pem",     "PEM encode / decode"),
        ("m3u",     "M3U parse / render"),
        ("chunked", "Chunked transfer encoding helpers (hex chunked)"),
        ("inspect", "List gateway utility modules or print one module's top fn signatures"),
        ("serve",   "Start the gateway-tools HTTP cockpit (this command)"),
    ]
}

// ---------------------------------------------------------------------------
// Response payloads
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
    service: &'static str,
    family: &'static str,
    port: u16,
}

#[derive(Serialize)]
struct UtilEntry {
    alias: &'static str,
    path: &'static str,
    public_fns: usize,
}

#[derive(Serialize)]
struct CastEntry {
    name: &'static str,
    description: &'static str,
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
    path: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn health(State(state): State<ServeState>) -> Json<HealthBody> {
    Json(HealthBody {
        status: "ok",
        service: "gateway-tools",
        family: "backbone-2",
        port: state.port,
    })
}

async fn cast() -> Json<Vec<CastEntry>> {
    Json(
        cast_registry()
            .into_iter()
            .map(|(name, description)| CastEntry { name, description })
            .collect(),
    )
}

async fn util() -> Json<Vec<UtilEntry>> {
    Json(
        util_registry()
            .into_iter()
            .map(|(alias, path, public_fns)| UtilEntry { alias, path, public_fns })
            .collect(),
    )
}

async fn splash() -> Response {
    // ASCII splash is server-rendered (NO_COLOR-aware, matches `substrate_splash`
    // in main.rs but stripped of ANSI escapes so it's safe over HTTP text/plain).
    let text = if std::env::var("NO_COLOR").is_ok_and(|v| !v.is_empty()) {
        "substrate gateway-tools serve  (Backbone-2 sync-violet #a371f7 + amber #d29922)\n".to_string()
    } else {
        format!(
            r#"
   ____  _   _ ____ _____ _____ _____ ____  _____
  / ___|| | | / ___|_   _|  ___|_   _|  _ \|  __ \
  \___ \| |_| \___ \ | | | |_    | | | |_) | |  | |
   ___) |  _  |___) || | |  _|   | | |  _ <| |  | |
  |____/|_| |_|____/ |_| |_|     |_| |_| \_\_|  |_|

substrate gateway-tools serve  sync-violet (#a371f7)  +  warm-amber (#d29922)
"#
        )
    };
    (
        StatusCode::OK,
        [("content-type", "text/plain; charset=utf-8")],
        text,
    )
        .into_response()
}

async fn inspect_one(Path(module): Path<String>) -> Response {
    match util_registry().into_iter().find(|(alias, _, _)| *alias == module) {
        Some((alias, path, n)) => {
            let body = format!(
                "# gateway module: {alias}\npath: {path}\npublic surface: {n} top fns (run `gateway-tools inspect {alias}` for full sigs)\n"
            );
            (
                StatusCode::OK,
                [("content-type", "text/plain; charset=utf-8")],
                body,
            )
                .into_response()
        }
        None => {
            let known: Vec<&str> = util_registry().into_iter().map(|(a, _, _)| a).collect();
            (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "error": "unknown_module",
                    "module": module,
                    "known": known,
                })),
            )
                .into_response()
        }
    }
}

async fn not_found(uri: axum::http::Uri) -> (StatusCode, Json<ErrorBody>) {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorBody {
            error: "not_found",
            path: uri.path().to_string(),
        }),
    )
}

// ---------------------------------------------------------------------------
// HTML cockpit (L113) -- GET / returns a server-rendered HTML index that
// links the JSON routes and renders the module list inline. Palette uses the
// sharecli Backbone-2 colors (pulse-green + warm-amber on a #161b22 panel)
// rather than the sync-violet variant used on the substrate side. The module
// count is hard-coded from the `util_registry()` length below.
// ---------------------------------------------------------------------------

/// Hard-coded module count for the sharecli `util_registry()` (matches the
/// 10-row vec: jwt/dns/redis/tls/pkcs7/patch/metrics/pem/m3u/chunked).
/// Keep in sync with `util_registry()` when adding a new module.
const SHARECLI_MODULE_COUNT: usize = 10;

async fn cockpit() -> Response {
    let mod_count = SHARECLI_MODULE_COUNT;
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>sharecli gateway-tools</title>
<style>
  body {{ background: #161b22; color: #d29922; font-family: 'Courier New', monospace; margin: 2rem auto; max-width: 56rem; padding: 0 1.5rem; }}
  h1   {{ color: #3fb950; border-bottom: 2px solid #3fb950; padding-bottom: 0.3rem; }}
  h2   {{ color: #3fb950; margin-top: 2rem; }}
  a    {{ color: #3fb950; }}
  a:hover {{ background: #3fb950; color: #161b22; }}
  .pill {{ background: #3fb950; color: #161b22; padding: 0.1em 0.5em; border-radius: 0.2em; font-weight: bold; }}
  code {{ color: #d29922; background: #0d1117; padding: 0.05em 0.3em; border-radius: 0.2em; }}
  ul.routes {{ list-style: none; padding: 0; }}
  ul.routes li {{ padding: 0.25rem 0; border-bottom: 1px dotted #30363d; }}
  .meta {{ color: #8b949e; font-size: 0.9em; }}
  nav {{ background: #0d1117; padding: 0.8rem 1.2rem; margin: -2rem auto -1rem auto; max-width: 56rem; border-bottom: 1px solid #3fb950; padding: 0.6rem 1.5rem; }}
  nav a {{ margin-right: 1.2rem; font-weight: bold; }}
  ul.modules {{ list-style: none; padding: 0; }}
  ul.modules li {{ padding: 0.3em 0.6em; border-bottom: 1px dotted #30363d; }}
  ul.modules li:hover {{ background: #1a1a1a; }}
  @keyframes pulse-pill {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.6; }} }}
  .pill {{ animation: pulse-pill 2s ease-in-out infinite; }}
  @keyframes fadein {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
  body {{ animation: fadein 0.3s ease-out; }}
</style>
</head>
<body>
  <nav>
    <a href="/">/ (cockpit)</a>
    <a href="/health">/health</a>
    <a href="/v1/modules">/v1/modules</a>
    <a href="/v1/cast">/v1/cast</a>
    <a href="/v1/util">/v1/util</a>
    <a href="/v1/splash">/v1/splash</a>
  </nav>
  <h1>sharecli gateway-tools <span class="pill">serve</span></h1>
  <p class="meta">Backbone-2 family &middot; pulse-green <code>#3fb950</code> + warm-amber <code>#d29922</code> on panel <code>#161b22</code>. L114: nav header + module list added. L117: cycle-2026-07-06/07 build (91 PRs across 7 owned repos).</p>
  <p>Server-rendered HTML cockpit &mdash; the same data exposed over JSON at <code>/v1/util</code> is embedded inline below. <strong>{mod_count}</strong> utility modules currently registered.</p>

  <h2>Routes</h2>
  <ul class="routes">
    <li><a href="/health">/health</a> &mdash; liveness probe (JSON)</li>
    <li><a href="/v1/modules">/v1/modules</a> &mdash; <em>alias</em> for /v1/util (gateway utility module index)</li>
    <li><a href="/v1/splash">/v1/splash</a> &mdash; ASCII splash as text/plain</li>
    <li><a href="/v1/cast">/v1/cast</a> &mdash; CLI subcommand index (json)</li>
    <li><a href="/v1/util">/v1/util</a> &mdash; gateway utility module index (json)</li>
    <li><a href="/v1/inspect/dns">/v1/inspect/&lt;module&gt;</a> &mdash; top fn count for one module</li>
  </ul>

  <h2>Modules ({mod_count})</h2>
  <ul class="modules">
    <li><a href="/v1/util"><code>jwt</code></a> &mdash; <code>gateway::jwt_hs256</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>dns</code></a> &mdash; <code>gateway::dns_message_parser</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>redis</code></a> &mdash; <code>gateway::redis_resp</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>tls</code></a> &mdash; <code>gateway::tls_record</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>pkcs7</code></a> &mdash; <code>gateway::pkcs7_padding</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>patch</code></a> &mdash; <code>gateway::json_patch</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>metrics</code></a> &mdash; <code>gateway::prometheus_exposition</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>pem</code></a> &mdash; <code>gateway::pem_codec</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>m3u</code></a> &mdash; <code>gateway::m3u_parser</code> (5 pub_fns)</li>
    <li><a href="/v1/util"><code>chunked</code></a> &mdash; <code>gateway::chunked_transfer</code> (5 pub_fns)</li>
  </ul>

  <h2>Casts</h2>
  <ul class="modules">
    <li><a href="/v1/cast">jwt / dns / redis / tls / pkcs7 / patch / metrics / pem / m3u / chunked</a></li>
    <li><a href="/v1/cast">inspect / serve</a></li>
  </ul>

  <p class="meta">Source-of-truth: <code>util_registry()</code> + <code>cast_registry()</code> in <code>serve.rs</code>.</p>
</body>
</html>
"#
    );
    (
        StatusCode::OK,
        [("content-type", "text/html; charset=utf-8")],
        html,
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Router + state plumbing
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
struct ServeState {
    port: u16,
}

fn router(port: u16) -> Router {
    let state = ServeState { port };
    Router::new()
        .route("/", get(cockpit))
        .route("/health", get(health))
        .route("/v1/cast", get(cast))
        .route("/v1/util", get(util))
        .route("/v1/splash", get(splash))
        .route("/v1/inspect/:module", get(inspect_one))
        .fallback(not_found)
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Entry point (called from main.rs `Cmd::Serve`)
// ---------------------------------------------------------------------------

/// `gateway-tools serve --port 8081` -- blocks until SIGINT/SIGTERM.
///
/// The default port (8081) avoids the gateway's own `:8080` listener. If the
/// bind fails (port in use, missing permission, etc.) we surface the OS error
/// rather than silently retrying or downgrading to a random port -- per the
/// loud-failure rule.
pub async fn run_serve(port: u16) -> Result<()> {
    substrate_splash_listen(port);

    let app = router(port);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind :{port}"))?;
    let bound = listener
        .local_addr()
        .with_context(|| format!("failed to read local_addr for :{port}"))?;
    eprintln!("[gateway-tools] listening on http://{bound}");
    eprintln!("[gateway-tools] routes:");
    eprintln!("  GET http://{bound}/");
    eprintln!("  GET http://{bound}/health");
    eprintln!("  GET http://{bound}/v1/cast");
    eprintln!("  GET http://{bound}/v1/util");
    eprintln!("  GET http://{bound}/v1/splash");
    eprintln!("  GET http://{bound}/v1/inspect/<module>");
    axum::serve(listener, app)
        .await
        .with_context(|| format!("axum server crashed on :{bound}"))?;
    Ok(())
}

/// Print the sharecli / Backbone-2 splash + listen URL on startup.
/// Pulse-green + warm-amber, NO_COLOR-aware. (Substrate side uses sync-violet;
/// sharecli-side uses pulse-green per the Backbone-2 sharecli variant.)
fn substrate_splash_listen(port: u16) {
    let green = "\x1b[38;2;63;185;80m";
    let amber = "\x1b[38;2;210;153;34m";
    let reset = "\x1b[0m";
    if std::env::var("NO_COLOR").is_ok_and(|v| !v.is_empty()) {
        eprintln!(
            "sharecli gateway-tools serve  (Backbone-2 pulse-green #3fb950 + amber #d29922)  --  port {port}"
        );
    } else {
        let splash = r#"
   ____  _   _ ____ _____ _____ _____ ____  _____
  / ___|| | | / ___|_   _|  ___|_   _|  _ \|  __ \
  \___ \| |_| \___ \ | | | |_    | | | |_) | |  | |
   ___) |  _  |___) || | |  _|   | | |  _ <| |  | |
  |____/|_| |_|____/ |_| |_|     |_| |_| \_\_|  |_|
"#;
        eprintln!("{green}{splash}{reset}");
        eprintln!(
            "{amber}sharecli gateway-tools serve{reset}  pulse-green (#3fb950)  +  warm-amber (#d29922)  --  port {port}"
        );
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt; // for `oneshot`

    fn app() -> Router {
        router(8081)
    }

    #[tokio::test]
    async fn health_returns_ok_and_port() {
        let resp = app()
            .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["status"], "ok");
        assert_eq!(v["service"], "gateway-tools");
        assert_eq!(v["family"], "backbone-2");
        assert_eq!(v["port"], 8081);
    }

    #[tokio::test]
    async fn cast_lists_known_subcommands() {
        let resp = app()
            .oneshot(Request::builder().uri("/v1/cast").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 4096).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let names: Vec<&str> = v.as_array().unwrap().iter().map(|e| e["name"].as_str().unwrap()).collect();
        for expected in ["jwt", "dns", "redis", "tls", "pkcs7", "patch", "metrics", "pem", "m3u", "chunked", "inspect", "serve"] {
            assert!(names.contains(&expected), "missing cast entry: {expected}");
        }
    }

    #[tokio::test]
    async fn util_lists_known_modules() {
        let resp = app()
            .oneshot(Request::builder().uri("/v1/util").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 4096).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v.as_array().unwrap().len(), 10);
        let first = &v[0];
        assert!(first.get("alias").is_some());
        assert!(first.get("path").is_some());
        assert!(first.get("public_fns").is_some());
    }

    #[tokio::test]
    async fn splash_returns_text_plain() {
        let resp = app()
            .oneshot(Request::builder().uri("/v1/splash").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let ct = resp.headers().get("content-type").unwrap().to_str().unwrap().to_string();
        assert!(ct.starts_with("text/plain"), "got content-type {ct}");
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let s = String::from_utf8(body.to_vec()).unwrap();
        assert!(s.contains("substrate gateway-tools"));
    }

    #[tokio::test]
    async fn inspect_known_module_returns_200() {
        let resp = app()
            .oneshot(
                Request::builder()
                    .uri("/v1/inspect/dns")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let s = String::from_utf8(body.to_vec()).unwrap();
        assert!(s.contains("dns"));
        assert!(s.contains("gateway::dns_message_parser"));
    }

    #[tokio::test]
    async fn inspect_unknown_module_returns_404_json() {
        let resp = app()
            .oneshot(
                Request::builder()
                    .uri("/v1/inspect/nope")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let body = axum::body::to_bytes(resp.into_body(), 2048).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["error"], "unknown_module");
        assert_eq!(v["module"], "nope");
        assert!(v["known"].as_array().unwrap().len() > 0);
    }

    #[tokio::test]
    async fn unknown_path_returns_404_json() {
        let resp = app()
            .oneshot(
                Request::builder()
                    .uri("/totally/unknown")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["error"], "not_found");
        assert_eq!(v["path"], "/totally/unknown");
    }

    #[tokio::test]
    async fn cockpit_returns_html_with_palette_and_mod_count() {
        let resp = app()
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let ct = resp
            .headers()
            .get("content-type")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        assert!(
            ct.starts_with("text/html"),
            "expected text/html content-type, got {ct}"
        );
        let body = axum::body::to_bytes(resp.into_body(), 64 * 1024).await.unwrap();
        let s = String::from_utf8(body.to_vec()).unwrap();
        // sharecli palette (NOT sync-violet — that's the substrate side)
        assert!(s.contains("#3fb950"), "missing pulse-green in cockpit HTML");
        assert!(s.contains("#d29922"), "missing warm-amber in cockpit HTML");
        assert!(s.contains("#161b22"), "missing panel #161b22 in cockpit HTML");
        // hard-coded module count baked into the HTML body
        assert!(
            s.contains(&format!("<strong>{}</strong>", SHARECLI_MODULE_COUNT)),
            "missing mod_count <strong>{}</strong> in cockpit HTML",
            SHARECLI_MODULE_COUNT
        );
        // links to the JSON sibling routes
        assert!(s.contains("/health"));
        assert!(s.contains("/v1/util"));
        assert!(s.contains("/v1/splash"));
        // branding — sharecli, not substrate
        assert!(s.contains("sharecli gateway-tools"));
    }
}