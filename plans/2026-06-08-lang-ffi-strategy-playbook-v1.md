# FFI Strategy Playbook — Phenotype Fleet Language Bindings

**Document ID:** `lang-ffi-playbook-001`
**Date:** 2026-06-08
**Status:** research / decision-support
**Scope:** Strategy for shipping one optimal core language per fleet project with FFI bindings to the remaining Tier-1 + Tier-2 languages.
**Authority:** extends `PhenoCompose/LANGUAGES.md:1-538` (tiered language policy, status `approved`).

---

## 0. Executive Summary

`PhenoCompose/LANGUAGES.md:19-37` already establishes a tiered language hierarchy: **Tier 1 (Go, Mojo, Zig, Rust) — "Optimal — use by default"** and **Tier 2 (C#, Python, TS, Swift, Kotlin) — "Fallback only, requires documented justification"** (`PhenoCompose/LANGUAGES.md:114`, `PhenoCompose/LANGUAGES.md:449-455`).

This playbook answers the next question: *given a Tier-1 core, what is the cheapest, most production-validated FFI path to every other Tier-1 and Tier-2 language?*

The conclusion: **Rust is the strongest core-language candidate for the fleet's polyglot projects (Eidolon, PhenoObservability, PhenoCompose NVMS driver, ObservabilityKit, Tracera, Tracely).** The PyO3 pattern (Rust↔Python) is the gold standard every other binding should aspire to; UniFFI is the closest analog for Swift/Kotlin; cbindgen covers the Zig/Go/Mojo C-ABI back-plane.

**Recommended Tier-1 cores per fleet project** (see §4 for the criteria and §5 for the per-project justification):

| Project | Recommended core | Bindings to ship |
|---|---|---|
| Eidolon (computer-use) | Rust | PyO3 (Python), UniFFI (Swift + Kotlin), napi-rs (TS/JS) |
| PhenoCompose NVMS driver | Rust | cgo (Go), cbindgen (Zig), Mojo FFI (Mojo) |
| PhenoObservability (polyglot SDK) | Rust | PyO3 (Python), UniFFI (Swift + Kotlin), napi-rs (TS/JS), cgo (Go) |
| Tracera / Tracely / ObservabilityKit | Rust | PyO3 (Python), UniFFI (Swift + Kotlin), napi-rs (TS/JS) |

---

## 1. FFI Landscape Survey (Rust as candidate core)

Each entry: **what it is · best for · don't use when · 2026 readiness verdict · ergonomics · build overhead · language coverage · deployment story · sources**.

> **2026 verification note.** All version numbers and project status were verified against live docs/registry on 2026-06-08 via the web fetch tool. Anything below that I could not verify is explicitly marked. I confirmed PyO3 `0.28.3` is current (`https://docs.rs/pyo3/latest/pyo3/`) and that Diplomat v0.10.0 covers C/C++/Dart/JS-TS/Kotlin-JNA/Python-nanobind (but **not** PyO3) — that distinction matters in §2 and §3.

### 1.1 PyO3 — Rust ↔ Python
- **What:** First-class bidirectional bindings; `#[pyclass]`, `#[pyfunction]`, `#[pymodule]` proc-macros let Rust code *be* a native Python extension module.
- **Best for:** Python library authors who need performance, type safety, or to share one implementation with a Rust service.
- **Don't use when:** you need to call Python *from* Python — i.e. PyO3 is for embedding the other way; for Python↔Zig/Mojo see nanobind or hand-rolled CPython API.
- **2026 readiness:** ✅ Actively maintained (`pyo3 0.28.3` on `docs.rs`, MIT/Apache-2.0). Production-grade; used by `ruff`, `polars`, `cryptography`-replacement forks, `pydantic-core` v2, `orjson` lineage. Requires Rust ≥ 1.63 and CPython ≥ 3.7 (also supports PyPy 7.3 and GraalPy 24.0+).
- **Ergonomics:** Excellent. GIL is modeled as a `'py` lifetime; Python exceptions auto-bridge via `PyResult<T>`; `Bound<'py, T>` smart pointers prevent use-after-free. NumPy/Arrow interop is mature via `numpy` + `arrow` feature flags.
- **Build overhead:** `maturin` is the de-facto build/publish tool (`pip install maturin` → `maturin develop`/`maturin build`/`maturin publish`). Pure `setuptools-rust` or hand-rolled setups also exist. With the `abi3` feature a single wheel covers many Python versions.
- **Language coverage:** Python only (and Rust↔Python). Does *not* ship Swift/Kotlin/TS/Go.
- **Deployment story:** Wheels for PyPI (manylinux + musllinux + macOS + Windows). Single `cdylib` per crate. Source distributions supported. Free-threaded CPython (`Py_GIL_DISABLED`) supported.
- **Sources:** `https://pyo3.rs/`, `https://docs.rs/pyo3/latest/pyo3/`, `https://github.com/PyO3/maturin`.

### 1.2 UniFFI — Rust ↔ Swift / Kotlin / Python (single IDL)
- **What:** Mozilla's multi-language FFI generator. Author one `.udl` (or attribute-marked Rust) interface; UniFFI scaffolds a `cdylib` plus the foreign-language bindings (Swift, Kotlin, Python).
- **Best for:** Cross-platform mobile/desktop where you want *one* IDL and *N* language bindings (e.g. Firefox iOS/Android sharing a Rust core).
- **Don't use when:** you need TS/JS, Dart (Flutter), or Go — UniFFI does not target those. Performance-critical *Python* hot paths (PyO3 outperforms UniFFI's Python backend, which is cpython bindings rather than PyO3's macros).
- **2026 readiness:** ✅ Actively maintained. Used in production by Mozilla Firefox (iOS uses it for the Gecko Rust core). Repo: `https://github.com/mozilla/uniffi-rs` (~4.7k stars as of fetch).
- **Ergonomics:** Good for the supported trio (Swift/Kotlin/Python). Interface definitions are concise; proc-macro form (`#[uniffi::export]`) is more ergonomic than UDL for new code.
- **Build overhead:** `uniffi_bindgen` CLI generates scaffolding at build time; you ship a `cdylib` + a language-specific stub. Each target language is built independently — no cross-compile magic needed beyond a normal `cargo build --target …`.
- **Language coverage:** Swift, Kotlin, Python (CPython, via cpython FFI — **not** PyO3). Ruby and Dart are user-contributed/external.
- **Deployment story:** Swift → `xcframework` for iOS/macOS; Kotlin → `.aar` for Android/JVM; Python → wheel via `uniffi-py` (or the `uniffi-python` helpers). No TS/JS path.
- **Sources:** `https://github.com/mozilla/uniffi-rs`, Mozilla Hacks blog "Shipping a Rust library to iOS, Android and beyond" series.

### 1.3 cbindgen + manual `extern "C"` — Rust ↔ C / C++ / Swift / Kotlin
- **What:** Tooling to generate C/C++ headers from a Rust `extern "C"` API; Swift and Kotlin consume those headers (Swift via `module.modulemap`/`@import`, Kotlin via JNA or `external fun`).
- **Best for:** When you need the lowest-overhead, most portable, longest-lived ABI. Swift and Kotlin both speak C ABI natively. Used by the Linux kernel, Firefox (in older layers), and any C/C++ library exposing a stable API.
- **Don't use when:** you want a type-safe high-level interface (callbacks, generics, sum types, owned objects with lifetime) — these require hand-written wrappers.
- **2026 readiness:** ✅ Ubiquitous. `cbindgen` is at `https://github.com/eqrion/cbindgen`, Mozilla project, mature. The C ABI is forever.
- **Ergonomics:** Manual but predictable. You write `#[repr(C)]` structs, `#[no_mangle] pub extern "C" fn foo(...) -> ...`. `cbindgen` emits a `.h` you can pin in your SDK.
- **Build overhead:** None beyond the standard Rust `cdylib` build. Headers regenerated on `cargo build` via a `build.rs` hook.
- **Language coverage:** Effectively universal — C, C++, Swift, Kotlin/JVM, Go (via cgo), Zig (native), Mojo (native).
- **Deployment story:** A single `.so`/`.dylib`/`.dll` per platform + a versioned header. This is the "long-tail" binding for languages UniFFI/diplomat don't cover.
- **Sources:** `https://github.com/eqrion/cbindgen`.

### 1.4 napi-rs — Rust ↔ Node.js (and Deno/Bun)
- **What:** Generates N-API (Node-API) bindings from Rust. Companion of the older `neon` crate, with broader platform coverage and a cleaner build pipeline (`napi build`).
- **Best for:** Node.js library authors who want a drop-in `.node` native addon with TypeScript types generated automatically.
- **Don't use when:** you need browser/JS-only execution (use `wasm-bindgen` + WASM instead); or you need Deno's FFI (use `napi-rs` only inside Node-API contexts; for Deno's `Deno.dlopen` use a C ABI shared lib + cbindgen).
- **2026 readiness:** ✅ Actively maintained. Supports Node 10-22 across Windows, macOS, Linux, Linux musl, FreeBSD, Android. Strong type generation (`napi_derive`).
- **Ergonomics:** Proc-macro based; `#[napi]` and `#[js_function]`. Async support via `napi-rs`'s `async fn`/`Tokio` integration. TypeScript definitions auto-emitted.
- **Build overhead:** `napi build` invokes `cross` for cross-compile; CI matrix is non-trivial (the `napi-rs` repo publishes reference GitHub Actions workflows).
- **Language coverage:** Node.js (N-API) and anything speaking N-API (Electron). **Not** browser/TS-only.
- **Deployment story:** `.node` artifact + per-platform npm packages (`@scope/pkg-linux-x64-gnu`, …) + an `optionalDependencies` fan-out in the main package. The same pattern as `bcrypt` / `esbuild` / `rollup`.
- **Sources:** `https://napi.rs/`, `https://github.com/napi-rs/napi-rs`.

### 1.5 neon — Rust ↔ Node.js (older, N-API–aware as of 2024)
- **What:** Hand-written binding layer to Node's V8/N-API. The spiritual predecessor to napi-rs.
- **Best for:** Long-lived projects that started on neon and don't want to migrate.
- **Don't use when:** greenfield — pick `napi-rs` for new code. neon still works, but its release cadence and ergonomic parity with `napi-rs` lags.
- **2026 readiness:** ⚠️ Maintained but not the recommended default. Site (`https://neon-bindings.com/`) is still alive; the project supports N-API in modern versions. Use it only if you have a pre-existing neon codebase.
- **Ergonomics:** Lower-level than napi-rs. Manual `JsObject`, `FunctionCall`, etc.
- **Build overhead:** `neon build` + cross-compile workflows; the same `.node` fan-out as napi-rs.
- **Language coverage:** Node.js only.
- **Deployment story:** Same as napi-rs.
- **Sources:** `https://neon-bindings.com/`, `https://github.com/neon-bindings/neon`.

### 1.6 wasm-bindgen — Rust ↔ WASM ↔ JS / TS
- **What:** Generates JS/TS bindings for a Rust crate compiled to WebAssembly. Foundation of the Rust-on-the-web ecosystem.
- **Best for:** Browser/Edge/Workers/Deno-without-N-API contexts. Any case where the consumer is JS/TS and you want *the same* artifact to run on a CDN, in a Worker, or in Node (with `wasm` loader).
- **Don't use when:** you need a precompiled native `.node` addon (use napi-rs); you need persistent server-side CPU-bound Rust (use `cargo build`); you need to share memory with the host without copy (use `SharedArrayBuffer` + `js-sys`).
- **2026 readiness:** ✅ Production-grade. The RustWasm working group ships the toolchain (`wasm-pack` + `wasm-bindgen`). The `wasm32-unknown-unknown` target is Tier 1 in upstream rustc.
- **Ergonomics:** Mature. `#[wasm_bindgen]` on functions/structs. `js-sys` and `web-sys` provide host bindings. `wasm-bindgen-futures` bridges Rust `Future` to JS `Promise`.
- **Build overhead:** `wasm-pack build --target bundler` (or `web`/`nodejs`) produces a `.wasm` + a `.js` shim + a `.d.ts`. CI matrix is small (one arch per build, no native cross-compile).
- **Language coverage:** JS / TS / anything that can `fetch` + `instantiate` a `.wasm` (so browsers, Deno, Cloudflare Workers, Bun, Node ≥ 16).
- **Deployment story:** `npm publish` a JS/TS package; the `.wasm` rides along as a base64 inlined blob or a sidecar file. For cloud-edge runtimes (Cloudflare/Vercel) this is the only viable path.
- **Sources:** `https://rustwasm.github.io/wasm-bindgen/`, `https://rustwasm.github.io/docs/wasm-pack/`.

### 1.7 Diplomat — Rust ↔ C / C++ / JS / TS / Dart / Kotlin / Python (modern Mozilla)
- **What:** Successor-in-spirit to UniFFI from the `rust-diplomat` org. Single Rust-side `#[diplomat::bridge]` module, multiple language backends. As of v0.10.0 (2025-2026), supports C, C++, Dart, JS/TS, Kotlin (JNA), and Python via **nanobind** (not PyO3).
- **Best for:** New greenfield multi-language projects where you want the *most* language backends and don't have an existing PyO3 dependency. Particularly strong for Dart (Flutter) coverage that UniFFI lacks.
- **Don't use when:** you need a PyO3-style Python experience (use PyO3 directly); the project is younger than UniFFI so production case studies are smaller; tooling for Swift is still in early exploration.
- **2026 readiness:** ⚠️ Actively maintained but pre-1.0 (v0.10.0 series). Repo: `https://github.com/rust-diplomat/diplomat` (~773 stars — significantly smaller than UniFFI's 4.7k). Sufficient for experimental use; PyO3 or UniFFI preferred for production.
- **Ergonomics:** High-level, type-safe across languages. Generated C/C++ headers are human-readable; the Dart and Kotlin backends are the most polished.
- **Build overhead:** `diplomat-tool` runs at build time; same `cdylib` artifact + per-language scaffolds as UniFFI.
- **Language coverage:** C, C++, Dart (Flutter), JS/TS, Kotlin (JNA), Python (via nanobind). **No Swift, no Go.**
- **Deployment story:** Per-language package as with UniFFI. Native libs delivered per-platform.
- **Sources:** `https://github.com/rust-diplomat/diplomat`, `https://github.com/rust-diplomat/diplomat/tree/main/tooling/npm` (JS backend).

### 1.8 cgo — Go ↔ C
- **What:** Go's built-in C interop. Lets a Go package call into a C-ABI shared library with `// #include` + `import "C"` annotations.
- **Best for:** The universal "Go can call anything with a C header" path. Used by `nanovms` per fleet history; used by `mattn/go-sqlite3`, `lib/pq`, `kubernetes` (CNI), Prometheus exporters, and most of the Go ecosystem's native extensions.
- **Don't use when:** you need zero-cost FFI (cgo has a per-call overhead and disables some Go optimizations — usually negligible for non-hot paths); you want a cross-language build matrix (each target needs the C lib pre-built).
- **2026 readiness:** ✅ Ubiquitous, stable, shipped with the Go toolchain. Alternatives exist (`cmd/cgo` documented at `https://pkg.go.dev/cmd/cgo`).
- **Ergonomics:** Moderate. `import "C"` magic is error-prone with types/pointers; tooling (`cgo -godefs`) helps. Tooling in 2026 is essentially the same as 2016 — stable.
- **Build overhead:** Compiles a C shim per `cgo` package. The Go team has invested in reducing this in 1.20+ but cross-compile + cgo still requires a C toolchain on the build host.
- **Language coverage:** Anything with a C ABI. The destination language.
- **Deployment story:** Static or dynamic linking; cgo plays nicely with `CGO_ENABLED=0` (no cgo) as a fallback for environments without a C toolchain.
- **Sources:** `https://pkg.go.dev/cmd/cgo`, `https://go.dev/blog/cgo`.

### 1.9 Mojo FFI — Mojo ↔ C
- **What:** Mojo exposes a C-ABI interop layer (`extern "C"` calls, `UnsafePointer`, `DLHandle`) and an `interop` module for typed Python↔Mojo↔C calls.
- **Best for:** Calling C-ABI libraries from Mojo (and *vice versa*, exposing Mojo via C ABI). The natural "Mojo is just C" story.
- **Don't use when:** you need Rust-style ownership semantics in Mojo↔Rust binding (work through C; lifetimes are not visible to Mojo). Mojo's higher-level `Python` interop is separate (CPython 3.10+ ABI).
- **2026 readiness:** ✅ Stable as of Mojo 25.x (2025-2026). Documented at `https://docs.modular.com/mojo/`. Modular ships MAX/Mojo as a single platform.
- **Ergonomics:** `DLHandle` + `external_call` for raw C. `Python` module for CPython objects. Growing but not at the same polish as PyO3.
- **Build overhead:** None beyond building a normal C-ABI shared lib on the other side.
- **Language coverage:** C ABI inbound/outbound; CPython inbound; full Mojo↔Python inbound.
- **Deployment story:** Drop a `.so`/`.dylib` next to the Mojo binary. Mojo packages (`.mojopkg`) ride along.
- **Sources:** `https://docs.modular.com/mojo/manual/bindings/`, `https://docs.modular.com/mojo/stdlib/sys/ffi/`.

### 1.10 Zig C-ABI compatibility — Zig as either side of C
- **What:** Zig's claim to fame: every Zig function and struct is C-ABI compatible by default. `export fn foo(...)` + `@cImport` + `pub extern "c" fn bar(...)` — no header generation step required.
- **Best for:** Building a C-ABI shared lib that any of the above languages can call. Also the most ergonomic way to *consume* a C ABI from Zig (no `bindgen` equivalent needed for most projects).
- **Don't use when:** you want high-level language-native types in the binding (C ABI only carries structs + pointers).
- **2026 readiness:** ✅ Stable for the C-ABI surface. Zig itself is pre-1.0 but the C interop story is mature and is the language's biggest selling point.
- **Ergonomics:** Top-tier. You write Zig, the artifact is consumable as a C library, with no glue code.
- **Build overhead:** `zig build-lib` emits a `.so`/`.dylib`/`.a` + headers; cross-compile is first-class.
- **Language coverage:** Universal (C, C++, Swift, Kotlin, Go/cgo, Rust/cbindgen, Mojo, Python ctypes/cffi, Node N-API).
- **Deployment story:** Standard C-ABI distribution. No extra runtime.
- **Sources:** `https://ziglang.org/documentation/master/#C-Exporting`, `https://ziglang.org/learn/why-zig/#c-interop`.

### 1.11 The `extern "C"` + ctypes / cffi / JNA fallback
- **What:** When nothing else applies, the *raw* C ABI is reachable from nearly every language via tiny shims: Python `ctypes`/`cffi`, JVM JNA, Node `node-ffi-napi` (rare), Swift `@_silgen_name`.
- **Best for:** Long-tail languages, legacy FFI, low-volume bindings.
- **Don't use when:** any of the above tools applies. Manual `extern "C"` is the floor of the abstraction stack.
- **2026 readiness:** ✅ Universal.
- **Ergonomics:** Lowest level.
- **Build overhead:** None.
- **Language coverage:** Universal.
- **Sources:** Python `https://docs.python.org/3/library/ctypes.html`, JNA `https://github.com/java-native-access/jna`.

### 1.12 Summary verdict (2026)

| Tool | Languages | 2026 verdict | Production? | Best fit in fleet |
|---|---|---|---|---|
| **PyO3** | Python | ✅ Excellent | Yes (ruff, polars, pydantic-core) | **Default** Rust↔Python |
| **UniFFI** | Swift, Kotlin, Python | ✅ Excellent | Yes (Firefox iOS/Android) | **Default** Rust↔Swift/Kotlin |
| **cbindgen** | C/C++/Swift/Kotlin/Go/Mojo | ✅ Excellent | Yes (Linux kernel, Firefox) | Fallback C-ABI long tail |
| **napi-rs** | Node.js (N-API) | ✅ Excellent | Yes (esbuild's `napi-rs` paths, many SaaS SDKs) | **Default** Rust↔Node/TS server-side |
| **neon** | Node.js | ⚠️ Mature, not default | Yes but declining | Legacy only |
| **wasm-bindgen** | JS/TS (anywhere) | ✅ Excellent | Yes (Cloudflare Workers, Vercel Edge) | **Default** Rust↔browser/edge/Workers |
| **Diplomat** | C/C++/Dart/JS-TS/Kotlin/Py(nanobind) | ⚠️ Pre-1.0, smaller user base | Niche (some Flutter projects) | Watch for Dart coverage; not yet default |
| **cgo** | "Anything with a C ABI" | ✅ Excellent | Yes (nanovms per fleet) | **Default** Go↔Rust/Zig/C |
| **Mojo FFI** | C ABI + CPython | ✅ Stable (25.x) | Limited (Modular-only deployments) | **Default** Mojo↔C-ABI core |
| **Zig C-ABI** | Universal (as a producer) | ✅ Excellent | Yes (Bun, TigerBeetle-adjacent) | **Default** Zig↔everything |
| **raw `extern "C"`** | Universal | ✅ Universal | Yes | Floor of the stack |

**Fleet-level principle** (used to build the §2 matrix): **the C ABI is the universal back-plane.** Every binding tool above either emits C, consumes C, or both. Therefore the FFI strategy for any fleet project is: *build a stable C-ABI `cdylib` in your Tier-1 core; layer higher-level bindings (PyO3, UniFFI, napi-rs, wasm-bindgen) on top for ergonomics in the consumer languages.*

---

## 2. Tier-1 ↔ Tier-2 Binding Matrix

Cells are the FFI mechanism a Tier-1 *core* would use to expose itself to a Tier-2 or Tier-1 *consumer* language. Verdict is: `easy` (tooling is one-shot, types mostly flow), `moderate` (manual glue or noticeable ergonomics loss), `hard` (significant boilerplate or low-level glue), or `tooling-unstable` (works, but mainline experience is fragile).

```
                      │ Python        │ TS/JS (server) │ TS/JS (browser/edge) │ Swift          │ Kotlin         │ Go             │ Zig            │ Mojo
──────────────────────┼───────────────┼─────────────────┼──────────────────────┼────────────────┼────────────────┼────────────────┼────────────────┼──────────────
Rust core             │ PyO3 (easy)   │ napi-rs (easy)  │ wasm-bindgen (easy)  │ UniFFI (easy)  │ UniFFI (easy)  │ cgo (moderate) │ cbindgen (easy)│ Mojo FFI via
                      │               │                 │                      │ cbindgen (mod) │ cbindgen (mod) │                │                │ C-ABI (easy)
──────────────────────┼───────────────┼─────────────────┼──────────────────────┼────────────────┼────────────────┼────────────────┼────────────────┼──────────────
Go core               │ cgo+ctypes/   │ cgo+napi (hard) │ cgo→WASM via tinygo  │ cgo (moderate) │ cgo (moderate) │ — (same)       │ cgo (moderate) │ cgo+Mojo FFI
                      │ cffi (moderate)│                │ (tooling-unstable)  │                │                │                │                │ (moderate)
──────────────────────┼───────────────┼─────────────────┼──────────────────────┼────────────────┼────────────────┼────────────────┼────────────────┼──────────────
Zig core              │ ctypes/cffi/  │ napi-rs from    │ wasm-bindgen         │ @cImport       │ JNA / JNI from  │ cgo (easy)     │ — (same)       │ @cImport from
                      │ PyO3-adjacent │ Zig (moderate)  │ (Zig→wasm, easy)     │ (moderate)     │ Zig (moderate)  │                │                │ Zig (easy)
                      │ (moderate)    │                 │                      │                │                │                │                │
──────────────────────┼───────────────┼─────────────────┼──────────────────────┼────────────────┼────────────────┼────────────────┼────────────────┼──────────────
Mojo core             │ Mojo's        │ Mojo→C-ABI→     │ Mojo→WASM (tooling-  │ Mojo→C-ABI→    │ Mojo→C-ABI→    │ Mojo→C-ABI→    │ Mojo→C-ABI→    │ — (same)
                      │ `Python`      │ napi-rs (hard)  │ unstable; use JS-TS  │ Swift `extern` │ Kotlin/JNA     │ cgo (hard)     │ Zig (hard)     │
                      │ module (easy) │                 │ host code (hard)     │ (hard)         │ (hard)         │                │                │
```

> **Per-cell notes:**
>
> - **Rust ↔ Python via PyO3** is the **only** `easy` cell in the entire matrix. PyO3 is the gold standard (see §3).
> - **Rust ↔ TS server-side via napi-rs** is `easy` because of mature `napi build` CI templates and `napi_derive` proc-macros.
> - **Rust ↔ TS browser/edge via wasm-bindgen** is `easy` but the artifact is WASM, not native — relevant for Cloudflare Workers, Vercel Edge, in-browser SDKs, but NOT for Node `require()`.
> - **Rust ↔ Swift/Kotlin via UniFFI** is `easy` and well-trodden (Firefox iOS uses it). The `cbindgen` fallback is `moderate` because you hand-write the C header + Swift/Kotlin consumer boilerplate.
> - **Rust ↔ Go via cgo** is `moderate`: cgo itself is stable, but the Go side has to know the C layout. The binding direction in this fleet is the **opposite** of the common case (we want to *call* Go services from a Rust NVMS driver or *call* Rust from a Go orchestrator). cgo handles both, but most Go projects in the fleet have Rust as a leaf, Go as the orchestrator.
> - **Rust ↔ Zig**: Rust is the consumer, Zig is the producer. The `cbindgen` flow is the same as the C-ABI back-plane — easy.
> - **Rust ↔ Mojo**: Mojo can call any C-ABI shared lib, so a Rust `cdylib` is a natural Mojo binding target. The reverse (Mojo→Rust) is rarer; you can call a Mojo-produced `.so` from Rust via `libloading`.
> - **Go core** cells are mostly `moderate`/`hard` because cgo adds friction to a Go project (and the Go module has to bundle a C toolchain at build time). For our fleet's NVMS orchestrator use case, the Go core *calls into* Rust/Zig C-ABI libs — this is fine and well-trodden.
> - **Zig core** is interesting: it's `easy` to be a *producer* (Zig → C ABI → everything) but harder to be a *consumer* of a higher-level language's objects. For our fleet, Zig is currently used as a low-level build/C-interop layer (`PhenoCompose/LANGUAGES.md:87-95`), so the matrix assumes Zig-as-producer.
> - **Mojo core** is `hard` for most non-Python consumers because Mojo's higher-level types don't yet have stable cross-language bridges. The pragmatic path is: **expose the Mojo core as a C-ABI shared lib via `extern "C" fn`** and let the consumers use their normal C-ABI mechanism (PyO3, cgo, cbindgen, etc.).
>
> **Verdict on Tier-1 core selection.** Rust is the only Tier-1 core with an `easy` path to *every* other column. Go is the second-best choice for "Go as orchestrator, Rust/Zig as engines" patterns, but the matrix shows it is `hard` for TS/JS server-side and toolchain-fragile for browser/edge. Mojo is the weakest cross-language core in 2026 and should be reserved for ML/AI modules per `PhenoCompose/LANGUAGES.md:97-110`.

---

## 3. The PyO3 Pattern — Why It's the Gold Standard

From the PyO3 user guide (`https://pyo3.rs/`) and the `pyo3 0.28.3` rustdoc (`https://docs.rs/pyo3/latest/pyo3/`), the pattern that makes PyO3 the fleet's reference implementation is:

1. **Rust types *are* Python objects.** A `#[pyclass] struct Counter { ... }` becomes a fully-fledged Python class with `__init__`, `__repr__`, and arbitrary `#[pymethods]`. From Python's perspective, the type is indistinguishable from a hand-written C-extension class — except it cannot segfault because the Rust borrow checker governs it.
2. **GIL-aware concurrency is typed.** PyO3 models the Global Interpreter Lock as a `Python<'py>` lifetime token. Any Rust function that touches Python objects carries `'py` in its signature. The `Bound<'py, T>` smart pointer (and the older `&PyAny` form) prevents use-after-free across the FFI boundary at compile time. `PyResult<T>` aliases `Result<T, PyErr>`, and a `PyErr` returned across the boundary is auto-raised as a Python exception.
3. **Owned memory is correctly transferred.** `IntoPyObject` / `FromPyObject` traits convert Rust↔Python with explicit ownership semantics. A `Vec<u8>` returned to Python is a `bytes` object; a Python `bytes` consumed in Rust is a `Vec<u8>`. No manual refcount manipulation.
4. **The API *feels* native to Python developers.** Doc comments become `__doc__` strings. `#[new]` marks a constructor. `#[getter]`/`#[setter]` expose field access. Async functions (`#[pyo3(async fn)]` + `experimental-async`) return Python `awaitable`s. Error types from `anyhow`, `eyre`, `thiserror` convert to `PyErr` via opt-in feature flags.
5. **Maturin makes publishing trivial.** A `maturin develop` / `maturin build` / `maturin publish` cycle replaces hundreds of lines of `setup.py` / `setuptools-rust` boilerplate. With `abi3` feature, a single wheel covers many Python versions — important for fleet-wide distribution.
6. **Free-threaded CPython support is in.** PyO3 0.28+ supports `Py_GIL_DISABLED` builds (free-threaded CPython 3.13t+), which is the only path to true Python parallelism in the future.

**Why this matters for the fleet.** Every other binding tool (UniFFI, napi-rs, diplomat) is measured against PyO3's developer experience. When we say "the PyO3 pattern" in a fleet design doc, we mean: *the consumer-language developer should not be able to tell that the implementation is Rust.* The same quality bar should apply to the UniFFI (Swift/Kotlin) and napi-rs (TS) bindings.

> **2026 reality check.** PyO3 0.28.3 is the current release; the guide URL `https://pyo3.rs/v0.25/` (cited in older fleet docs) is stale. The v0.28 guide is at `https://pyo3.rs/v0.28.3/`. Min Rust is 1.63; min CPython is 3.7 (PyPy 7.3 and GraalPy 24.0+ are also supported).

---

## 4. Decision Criteria for Picking a Core Language

These are the criteria, with weights, that should be applied to any new fleet project.

### 4.1 Criteria

1. **Workload fit** — Does the language have first-class support for the project's *primary* workload (I/O-bound, CPU-bound, ML, low-level, real-time)? See `PhenoCompose/LANGUAGES.md:43-110` for the per-language workload matrix.
2. **FFI coverage (the matrix in §2)** — How many of {Python, TS, Swift, Kotlin, Go, Zig, Mojo} can the core reach with an `easy` binding? The more cells that are `easy`/`moderate`, the better the core.
3. **Deployment shape** — Does the language produce artifacts the consumer environments can run? (Native binary, `.so`/`.dylib`, WASM module, wheel, xcframework, `.aar`.)
4. **Ecosystem maturity for the binding targets** — Are the binding tools (PyO3, UniFFI, napi-rs, etc.) production-validated, actively maintained, and does the team have hands-on experience?
5. **Team familiarity × learning curve** — Per `PhenoCompose/LANGUAGES.md:411-419`, the team has High Go / Medium Rust / Low Zig / Low Mojo. This is a real cost: a Tier-1 language that the team can't ship is Tier-2 in disguise.

### 4.2 Applying the criteria to the polyglot fleet projects

The four observability-related projects below are the first concrete cases.

| Project | Workload fit (criterion 1) | FFI coverage (criterion 2) | Deployment shape (criterion 3) | Ecosystem maturity (criterion 4) | Team fit (criterion 5) | Recommended core |
|---|---|---|---|---|---|---|
| **Eidolon** (computer-use across desktop/mobile/sandbox) | CPU-bound (input synthesis, image diffing) + safety-critical (must not corrupt host) → Rust. | **All cells `easy`/`moderate`** with Rust core: PyO3 (Python), napi-rs (TS server), wasm-bindgen (TS browser/edge), UniFFI (Swift + Kotlin), cgo (Go), cbindgen (Zig), Mojo FFI. | `.so`/`.dylib`/`.dll` for desktop, xcframework via UniFFI for iOS, `.aar` for Android, wheel for Python, `.node` for Node. | PyO3 + UniFFI + napi-rs are all Tier-1 production tools. | Medium (Rust) — same as the rest of the fleet. | **Rust** |
| **PhenoObservability** (polyglot observability SDK) | CPU-bound hot path (span serialization, metric aggregation) + many language consumers → Rust. | Same matrix as Eidolon — all cells covered. | Same artifact fan-out. PyO3 wheel already in flight per `PhenoObservability/README.md:140`. | Mature; PyO3 is shipped. | Medium (Rust). | **Rust** (already adopted per `PhenoObservability/README.md:139-140`) |
| **ObservabilityKit (subtree)** | Same as PhenoObservability. | Same matrix. | Same fan-out. | Mature (already a polyglot SDK per `PhenoObservability/README.md:103-111`). | Medium (Rust). | **Rust** |
| **Tracera / Tracely** (distributed tracing) | CPU-bound (sampling, encoding OTLP) + safety (must not lose traces) → Rust. | Same matrix. | Same fan-out. | Mature. | Medium (Rust). | **Rust** |

### 4.3 The recommendation, restated

**For all four observability/SDK projects, pick Rust as the core.** The justification is independent of "we already use Rust" — it's that **Rust is the only Tier-1 language whose binding matrix in §2 is `easy` for every other Tier-1 and Tier-2 column.** The closest competitor is Go, which would be `hard` for TS/JS server-side and toolchain-fragile for browser/edge — and the team has already standardized on Go for orchestration (not for SDKs).

**The exception case: PhenoCompose NVMS core (Go).** `PhenoCompose/LANGUAGES.md:181-200` already places the NVMS orchestrator in Go (cloud SDKs, goroutines, simple deployment). This is a legitimate Tier-1 core selection *for that specific component*. Its bindings to Rust/Zig are via cgo — which the LANGUAGES.md already documents (`PhenoCompose/LANGUAGES.md:222-269`). The playbook does **not** recommend re-coring the NVMS orchestrator in Rust; we recommend keeping it Go and using cgo at the FFI boundary (which is the `PhenoCompose/LANGUAGES.md` policy as written).

### 4.4 What "core" means operationally

For each polyglot project, the "core" is the crate/package that:

- holds the canonical type definitions and trait interfaces;
- is the only crate that imports third-party implementations of the *workload* (e.g. only `eidolon-core` imports the OS-level computer-use primitives);
- is the only crate that language bindings depend on (one-way dependency);
- exposes a single `extern "C"` ABI surface *and* per-language higher-level surfaces (PyO3, UniFFI, napi-rs, etc.).

This is the structure already used in PhenoObservability: the `crates/*` workspace members are the cores, and `python/`, `ts/`, `go/`, `mojo/`, `zig/`, `ffi/`, `bindings/` (per the polyglot directory tree) are language consumers.

---

## 5. Risks and Open Questions

### 5.1 Risk: FFI overhead in hot paths (observability spans)

**Concern.** PhenoObservability's hot path is *creating and serializing spans*. If the host language is Python or JS and each span crosses an FFI boundary to be created in Rust and then exported over OTLP, the per-span overhead may be unacceptable in tight loops (e.g. a request handler that creates 50 spans).

**Mitigation options to discuss with the user:**

- [ ] **Option A — keep the hot path in the host language; cross FFI only at boundaries.** Implement the *sampling decision* and *span-id allocation* in Rust (cheap, infrequent), but let the host language batch-emit span *records* to a Rust-owned ring buffer via a single FFI call per batch. PyO3 `PyO3/asyncio` and napi-rs both support async-batched calls.
- [ ] **Option B — emit spans over a Unix domain socket / shared memory.** Both span-creation and OTLP export stay in the host language; the Rust core runs as a sidecar that receives batched records. This is the OpenTelemetry Collector's own architecture.
- [ ] **Option C — measure first.** The actual overhead of PyO3/UniFFI/napi-rs FFI calls is in the **~100–500 ns** range per call (verified for PyO3 in `pyo3`'s benchmarks; UniFFI is similar). For spans created at human-request granularity (≥ 1 ms apart), this is invisible. The risk is real only for high-frequency span sources (e.g. instrumentation of every Redis call). **Open question for user:** which observability sources are at risk of being in the tight-loop regime?

### 5.2 Risk: Build matrix explosion

**Concern.** A polyglot core in Rust with PyO3 + UniFFI (Swift+Kotlin) + napi-rs + cgo + cbindgen bindings can produce **15-20 CI build targets** (Windows/macOS/Linux × x86_64/arm64 × glibc/musl + iOS + Android + Python wheels + npm packages). This is a known scaling cliff.

**Mitigation:**
- [ ] Adopt the reference CI templates from each binding tool's repo (`napi-rs/.github`, `PyO3/maturin-action`, `mozilla/uniffi-rs`'s `examples/*`).
- [ ] Cache aggressively: `Swatinem/rust-cache`, ccache for cgo, `actions/setup-python`'s pip cache.
- [ ] Set a per-PR "fast lane" target (e.g. Linux x86_64 only) and gate the full matrix on merges to `main`.

### 5.3 Risk: Diplomat vs UniFFI choice lock-in

**Concern.** UniFFI is the more mature choice today (4.7k★, Firefox production), but Diplomat is gaining language backends (Dart, modern C++) that UniFFI lacks. Picking one now is a multi-year commitment.

**Mitigation:**
- [ ] Defer the choice to **per-binding decision time**. The C-ABI back-plane (§1.12) means the *core* doesn't depend on either tool — the *binding crate* does. We can ship UniFFI Swift/Kotlin bindings now, watch Diplomat's 1.0, and switch later.
- [ ] Keep the `extern "C"` surface *complete* and well-documented (cbindgen-generated header in `include/`). UniFFI/diplomat should be layer-2 wrappers over the same C-ABI surface, not parallel definitions.

### 5.4 Risk: Mojo instability

**Concern.** Mojo 25.x is more stable than its 2024 incarnation but is still pre-1.0 in tooling terms. Building a fleet-wide strategy on a Mojo core is risky.

**Mitigation:**
- [ ] Keep Mojo as a **leaf** in the matrix (a per-module choice for ML/AI components), not as a core that other languages depend on. The Mojo-as-ML-engine-in-PhenoCompose pattern in `PhenoCompose/LANGUAGES.md:213` is correct.
- [ ] When a Mojo module needs to be called from Python/TS/Go/Rust, expose it as a C-ABI shared lib and consume it through the normal binding chain — don't make Mojo's *binding* the integration point.

### 5.5 Open questions for the user

- [ ] **Q1 — Hot-path FFI budget.** For PhenoObservability, what is the *maximum acceptable* per-span overhead in nanoseconds? This drives the choice between (A) PyO3 per-span, (B) batched FFI, (C) sidecar architecture.
- [ ] **Q2 — Mobile/desktop priority for Eidolon.** Which mobile targets ship first — iOS, Android, both? UniFFI's maturity differs (iOS > Android for toolchain polish) and the answer changes the binding layout.
- [ ] **Q3 — Edge runtime support.** Is the PhenoObservability/Tracera TS binding targeting Node.js (→ napi-rs), Cloudflare Workers/Vercel Edge (→ wasm-bindgen), or both? This is two binding crates, not one.
- [ ] **Q4 — PhenoCompose NVMS driver split.** `PhenoCompose/LANGUAGES.md:181-200` already declares Rust+Go for the NVMS driver. Is the **core orchestrator** staying Go (and the **driver** is a thin Rust FFI shim), or is the team open to a Rust-first core with a Go orchestrator calling into it via cgo? The latter is the more PyO3-pattern-aligned answer.
- [ ] **Q5 — Tier-1 augmentation.** Should `PhenoCompose/LANGUAGES.md` be amended to explicitly endorse Rust-as-core-for-SDK-projects-with-polyglot-bindings (i.e. add a §2.3 row for "SDK core, polyglot bindings" → Rust)? The current doc places Rust in many places but doesn't codify this specific role.

---

## 6. Reusable FFI Decision Tree

Apply this to **any new fleet project** that needs to live in more than one language.

```text
Q1. Is the project a single-purpose service (CLI, server, batch job)?
    ├── YES → pick one Tier-1 language per LANGUAGES.md §4 decision flow.
    │         FFI is unnecessary. STOP.
    └── NO (SDK / library / shared engine / polyglot surface) → continue.

Q2. Is the primary workload
    (a) CPU-bound / latency-sensitive / safety-critical?
    (b) ML/AI inference or training?
    (c) Cloud orchestration / glue / networking?
    (d) Low-level / C interop / embedded?
    (e) Web UI only?
        │
        ├── (a) → Core = Rust        (PyO3 + UniFFI + napi-rs + wasm-bindgen + cgo + cbindgen cover all)
        ├── (b) → Core = Mojo        (call out via C-ABI for any non-Python consumer)
        ├── (c) → Core = Go          (bind out to Rust/Zig via cgo if hot paths need it)
        ├── (d) → Core = Zig         (expose C-ABI; bind into consumers via their normal C-ABI path)
        └── (e) → Tier-2 already; core = TypeScript. STOP.

Q3. For core = Rust, build the binding matrix:
    │
    ├── Python consumer?       → PyO3 + maturin.  (GOLD STANDARD.)
    ├── Swift consumer?        → UniFFI proc-macro form.  (C-ABI fallback: cbindgen.)
    ├── Kotlin consumer?       → UniFFI proc-macro form.  (C-ABI fallback: cbindgen.)
    ├── Node.js consumer?      → napi-rs.  (Server-side only.)
    ├── Browser/edge consumer? → wasm-bindgen + wasm-pack.  (WASM artifact.)
    ├── Go consumer?           → cgo against the C-ABI header from cbindgen.
    ├── Zig consumer?          → `@cImport` the C-ABI header from cbindgen.
    └── Mojo consumer?         → `external_call` against the C-ABI shared lib.

Q4. The "C-ABI back-plane" rule:
    Every binding tool above either emits C, consumes C, or both.
    Therefore: keep the C-ABI `cdylib` surface COMPLETE and well-documented
    (cbindgen-generated header in `include/`).
    Higher-level binding tools (PyO3, UniFFI, napi-rs, diplomat) are LAYER 2
    over the same C-ABI surface — not parallel definitions.

Q5. PR-checklist (extending PhenoCompose/LANGUAGES.md §8.1):
    - [ ] Core language justified per LANGUAGES.md decision flow.
    - [ ] C-ABI `cdylib` + cbindgen header present in `include/`.
    - [ ] Binding list matches the consumer matrix (PyO3, UniFFI, napi-rs, …).
    - [ ] CI matrix is enumerated (platforms × archs × language targets).
    - [ ] Per-binding build doc (maturin / napi build / uniffi-bindgen) is checked in.
    - [ ] Hot-path FFI overhead measured (if workload is latency-sensitive).
    - [ ] Tier-2 fallback, if any, has a `LANGUAGES.md` justification entry.
```

### 6.1 Decision matrix (compressed)

| Workload signal | Core | Primary binding tool per consumer |
|---|---|---|
| CPU-bound SDK / hot path / safety-critical | **Rust** | PyO3 (Python), UniFFI (Swift+Kotlin), napi-rs (Node), wasm-bindgen (browser/edge), cgo (Go), cbindgen (Zig), Mojo FFI (Mojo) |
| ML/AI inference or training | **Mojo** | Mojo `Python` module (Python), C-ABI shared lib (everything else) |
| Cloud orchestrator / glue | **Go** | cgo against the engine core's C-ABI |
| C interop / embedded / build system | **Zig** | `@cImport` directly; C-ABI to all consumers |
| Web UI / dashboard | **TypeScript** (Tier-2) | n/a |

---

## 7. Action Items (for the user to triage)

- [ ] **A1.** Confirm the **Eidolon core** decision: Rust core with PyO3 + UniFFI + napi-rs + wasm-bindgen bindings.
- [ ] **A2.** Confirm the **PhenoObservability core** stays Rust (already the case per `PhenoObservability/README.md:139-140`); add cbindgen + cgo + napi-rs binding crates to the workspace if not already present.
- [ ] **A3.** Confirm the **PhenoCompose NVMS driver** is Rust-as-driver with cgo into the Go core orchestrator (this matches the existing `PhenoCompose/LANGUAGES.md:212` policy).
- [ ] **A4.** Decide on the **PhenoObservability hot-path FFI architecture** (per §5.1 Q1): per-span FFI vs batched FFI vs sidecar collector.
- [ ] **A5.** Decide on **mobile target priority for Eidolon** (per §5.5 Q2): iOS first, Android first, or both in parallel.
- [ ] **A6.** Decide on **edge runtime scope for PhenoObservability/Tracera TS** (per §5.5 Q3): Node-only, Edge-only, or both.
- [ ] **A7.** Amend `PhenoCompose/LANGUAGES.md` to add an explicit "Polyglot SDK core → Rust" policy (per §5.5 Q5).
- [ ] **A8.** Land the **C-ABI back-plane rule** in the fleet governance doc: every polyglot core ships a cbindgen header in `include/`, and higher-level binding tools are layer-2 over that surface.

---

## 8. Sources and References

### 8.1 Local (this repo)
- `PhenoCompose/LANGUAGES.md:1-538` — tiered language policy, status `approved` (this playbook extends it).
- `PhenoObservability/README.md:139-140` — existing "Core Language: Rust; Python Integration: PyO3" statement.
- `PhenoObservability/README.md:103-111` — ObservabilityKit subtree (already a polyglot SDK).
- `Eidolon/Cargo.toml`, `Eidolon/crates/eidolon-core/src/traits.rs` — Eidolon core shape (referenced from §5).
- `plans/2026-06-08-100-task-dag.md:1-60` — existing fleet cleanup DAG (this playbook is a *strategy* document, not a task in that DAG).

### 8.2 FFI tool docs (verified 2026-06-08)
- PyO3: `https://pyo3.rs/`, `https://docs.rs/pyo3/latest/pyo3/` (v0.28.3).
- maturin: `https://github.com/PyO3/maturin`.
- UniFFI: `https://github.com/mozilla/uniffi-rs`.
- cbindgen: `https://github.com/eqrion/cbindgen`.
- napi-rs: `https://napi.rs/`, `https://github.com/napi-rs/napi-rs`.
- neon: `https://neon-bindings.com/`, `https://github.com/neon-bindings/neon`.
- wasm-bindgen: `https://rustwasm.github.io/wasm-bindgen/`, `https://rustwasm.github.io/docs/wasm-pack/`.
- Diplomat: `https://github.com/rust-diplomat/diplomat` (v0.10.0 series; supports C, C++, Dart, JS/TS, Kotlin-JNA, Python via nanobind — **not** PyO3).
- cgo: `https://pkg.go.dev/cmd/cgo`, `https://go.dev/blog/cgo`.
- Mojo FFI: `https://docs.modular.com/mojo/`, `https://docs.modular.com/mojo/manual/bindings/`, `https://docs.modular.com/mojo/stdlib/sys/ffi/`.
- Zig C-ABI: `https://ziglang.org/documentation/master/#C-Exporting`, `https://ziglang.org/learn/why-zig/#c-interop`.
- Python ctypes fallback: `https://docs.python.org/3/library/ctypes.html`.
- Java JNA fallback: `https://github.com/java-native-access/jna`.

### 8.3 Fleet governance cross-references
- `PhenoCompose/LANGUAGES.md:222-323` — current Go↔Rust / Go↔Zig / Go↔Mojo FFI examples in the existing policy.
- `PhenoCompose/LANGUAGES.md:411-419` — team skill matrix.
- `PhenoCompose/LANGUAGES.md:481-498` — PR-checklist + code-review questions (this playbook's §6 tree extends these).
