/**
 * T3 — Native ABI FFI transport for dispatch edges (ADR-032 / F3-F6).
 *
 * Wraps `node-ffi-napi` / `koffi` / `napi-rs` shape behind a single
 * interface so call sites stay decoupled from the FFI binding library.
 *
 * Strategy:
 *   - The bundle ships prebuilt artifacts in `dist/ffi/<triple>/` (e.g.
 *     `dist/ffi/x86_64-unknown-linux-gnu/omniroute_ffi_combo_scorer.so`).
 *   - On boot, `loadFfiCrate` resolves the crate path for the current
 *     platform via `@derp/architectures` (matches Electron's runtime).
 *   - If the crate is missing, `loadFfiCrate` returns `null` instead of
 *     throwing — the dispatch resolver falls back to T2 (or T1) per the
 *     ADR-032 decision rule.
 *
 * Per-edge FFI surface (CDD):
 *   - Each crate must export a `version()` symbol returning a
 *     null-terminated ASCII string compatible with the OmniRoute FFVv1
 *     contract. The loader rejects anything mismatched.
 *   - Input is JSON-encoded `Buffer`; output is JSON-encoded `Buffer`.
 *     The crate owns serialization (bincode, postcard, simd-json).
 *   - Wrapped functions return `Buffer` (zero-copy from the C side to
 *     Node's `Buffer`).
 *
 * ABI versioning:
 *   - `omniroute.ffi.abi_version` in the crate's manifest is checked
 *     against `OMNIROUTE_FFI_ABI_VERSION` env.
 *   - Mismatched ABIs raise a `BifrostError` (see `errors.ts`) so callers
 *     can fall through to T1.
 *
 * @see ADR-032 § "Why T3 (FFI) for the inner loops"
 * @see PLAN.md § 2.5.6 (F4-F5 work items)
 */

import { arch, platform } from "node:os";
import type { FfiEdgeContract, InvokeOptions } from "./dispatchEdges.ts";
import type { DispatchEdgeError } from "./errors.ts";

const EXPECTED_ABI_VERSION = process.env.OMNIROUTE_FFI_ABI_VERSION ?? "1";

// `node-ffi-napi` is a heavy native dep; we don't want to require it unless
// FFI edges are actually exercised. Implement lazy import + memory buffer
// based on standard `koffi` shape.
//
// In the OSS reference impl, replace this entire file with `koffi` calls:

type FfiDylib = {
  func(symbol: string, signature: unknown, options?: unknown): (...args: unknown[]) => unknown;
  close(): void;
  readonly name: string;
};

const loadedCrates = new Map<string, FfiDylib>();

interface Dlr {
  open(path: string): FfiDylib;
}

interface NodeModulesKoffi {
  load(filename: string): FfiDylib;
}

interface FfiPackageResolver {
  platformKey(): string | null;
  discoverCrate(crateBaseName: string): string | null;
  pickPlatform(): { pkg: string; key: string; nativeDir: string } | null;
}

let koffiLoader: Dlr | NodeModulesKoffi | null = null;
let koffiLoaderTried = false;
let packageResolver: FfiPackageResolver | null = null;
let packageResolverTried = false;

async function getLoader(): Promise<Dlr | NodeModulesKoffi | null> {
  if (koffiLoaderTried) return koffiLoader;
  koffiLoaderTried = true;

  try {
    const mod = (await import("koffi")) as unknown as Dlr | NodeModulesKoffi;
    koffiLoader = mod;
    return mod;
  } catch {
    // `koffi` not installed — FFI unavailable, return null so the resolver
    // can fall back to T1/T2.
    return null;
  }
}

/**
 * Pre-resolve the platform-specific crate path. Resolution order:
 *   1. `OMNIROUTE_FFI_PATH` env override (operator-supplied path).
 *   2. `@omniroute/ffi` workspace package discovery (per-platform optional deps
 *      installed via `optionalDependencies`). See `packages/omniroute-ffi/`.
 *   3. `dist/ffi/<triple>/` (legacy fallback for non-workspace deployments).
 */
export function resolveFfiCratePath(crate: string): string {
  if (process.env.OMNIROUTE_FFI_PATH) return `${process.env.OMNIROUTE_FFI_PATH}/${crate}${platformLibExt()}`;

  // Try the package resolver (workspace layout: packages/omniroute-ffi-*).
  const pkgPath = tryResolveViaPackage(crate);
  if (pkgPath) return pkgPath;

  const triple = currentTriple();
  return `dist/ffi/${triple}/${crate}${platformLibExt()}`;
}

/**
 * Try to resolve a crate via the `@omniroute/ffi` workspace package. The
 * package uses `optionalDependencies` to surface per-platform subpackages
 * (e.g. `@omniroute/ffi-darwin-arm64`) — exactly one is installed for any
 * given host. Returns null on any failure (missing optional, missing crate,
 * platform unsupported).
 */
function tryResolveViaPackage(crate: string): string | null {
  try {
    if (!packageResolverTried) {
      packageResolverTried = true;
      packageResolver = require("@omniroute/ffi") as FfiPackageResolver;
    }
    if (!packageResolver) return null;
    return packageResolver.discoverCrate(crate);
  } catch (_err) {
    // `@omniroute/ffi` not installed (workspace layout not in use). Fall
    // through to the dist/ path below.
    return null;
  }
}

function platformLibExt(): string {
  if (platform() === "darwin") return ".dylib";
  if (platform() === "win32") return ".dll";
  return ".so";
}

function currentTriple(): string {
  // Best-effort triple matching Rust's `target`. We don't ship MSVC builds
  // for the OSS surface, so triple resolution is best-effort.
  const archName = arch();
  const archSegment =
    archName === "x64" ? "x86_64" : archName === "arm64" ? "aarch64" : archName === "ia32" ? "i686" : archName;
  const platformSegment =
    platform() === "linux" ? "unknown-linux-gnu" : platform() === "darwin" ? "apple-darwin" : "unknown";
  return `${archSegment}-${platformSegment}`;
}

export async function loadFfiCrate(crate: string): Promise<FfiDylib | null> {
  const existing = loadedCrates.get(crate);
  if (existing) return existing;

  const loader = await getLoader();
  if (!loader) return null;

  const path = resolveFfiCratePath(crate);
  try {
    const dylib = loader.open(path);
    const versionFn = dylib.func("version", "char *", {});
    if (typeof versionFn === "function") {
      const raw = versionFn() as { ptr?: unknown; toString(): string };
      const actual = typeof raw === "string" ? raw : raw.toString();
      if (actual.trim() !== EXPECTED_ABI_VERSION) {
        const err: DispatchEdgeError = new Error(
          `FFI crate ${crate} ABI version mismatch: actual=${actual.trim()} expected=${EXPECTED_ABI_VERSION}`
        );
        err.code = "FFI_ABI_MISMATCH";
        throw err;
      }
    }
    loadedCrates.set(crate, dylib);
    return dylib;
  } catch (error) {
    if ((error as { code?: string })?.code === "FFI_ABI_MISMATCH") throw error;
    // Crate not found / permission denied / etc — degrade gracefully.
    return null;
  }
}

export async function invokeFfiEdge<TIn, TOut>(
  contract: FfiEdgeContract<TIn, TOut>,
  input: TIn,
  options: InvokeOptions = {}
): Promise<TOut> {
  const timeoutMs = options.timeoutMs ?? contract.timeoutMs ?? 50;
  const dylib = await loadFfiCrate(contract.crate);
  if (!dylib) {
    const err: DispatchEdgeError = new Error(
      `FFI crate ${contract.crate} unavailable; check dist/ffi/ for prebuilt artifacts`
    );
    err.code = "FFI_NOT_AVAILABLE";
    throw err;
  }

  // JSON encode input → Buffer (zero-copy from the C side via the ABI).
  const inputBuffer = Buffer.from(JSON.stringify(input), "utf-8");

  let timeoutHandle: NodeJS.Timeout | undefined;
  const start = Date.now();

  try {
    const fn = dylib.func(contract.symbol, { in: "char *", in_len: "size_t", out: "char *", out_len: "size_t" }, {});
    if (typeof fn !== "function") {
      const err: DispatchEdgeError = new Error(`FFI symbol ${contract.symbol} not found`);
      err.code = "FFI_SYMBOL_NOT_FOUND";
      throw err;
    }
    const outBuffer = fn(inputBuffer, inputBuffer.byteLength) as Buffer;
    const result = JSON.parse(outBuffer.toString("utf-8")) as TOut;
    // Account for time budget on quick-return edges; longer edges are bounded by the C-side timeout.
    if (timeoutMs > 0 && Date.now() - start > timeoutMs) {
      // eslint-disable-next-line no-console
      console.warn(`[dispatch/ffi] ${contract.crate}.${contract.symbol} exceeded ${timeoutMs}ms budget`);
    }
    return result;
  } catch (error) {
    if ((error as { code?: string })?.code) throw error;
    const err: DispatchEdgeError = new Error(
      `FFI call ${contract.crate}.${contract.symbol} failed: ${error instanceof Error ? error.message : String(error)}`
    );
    err.code = "FFI_CALL_FAILED";
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Smoke-test an FFI edge. Returns null if the crate loaded + version matched.
 */
export async function healthcheckFfiEdge(contract: FfiEdgeContract<unknown, unknown>): Promise<string | null> {
  try {
    const dylib = await loadFfiCrate(contract.crate);
    if (!dylib) return `FFI crate ${contract.crate} unavailable`;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Close all loaded FFI crates. Test-only.
 */
export function __closeAllFfiCratesForTests(): void {
  for (const dylib of loadedCrates.values()) {
    try {
      dylib.close();
    } catch {
      // Ignore close errors during teardown.
    }
  }
  loadedCrates.clear();
  koffiLoader = null;
  koffiLoaderTried = false;
  packageResolver = null;
  packageResolverTried = false;
}

/**
 * Reset package-resolver state without closing loaded crates. Test-only.
 */
export function __resetPackageResolverForTests(): void {
  packageResolver = null;
  packageResolverTried = false;
}
