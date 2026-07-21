/**
 * Combo scorer FFI wrapper — bridge from TS `autoCombo/scoring.ts` to
 * Rust `omniroute_ffi_combo_scorer` (ADR-032 / F4 / F2b).
 *
 * Three native backends, tried in order:
 *
 *   1. **napi-rs addon** (`crates/combo-scorer-napi/`, ADR-032 § B).
 *      Native `import()` of `.node` file. Float32Array TypedArray ABI.
 *      No serialisation overhead. camelCase naming. **Fastest path.**
 *      Available on darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu.
 *
 *   2. **koffi cdylib typed-ABI** (`crates/combo-scorer/`, ADR-032 § F4).
 *      Dynamic FFI via `koffi` with f32-typed ABI (flat buffer + candidates).
 *      Some JSON-envelope overhead from koffi marshalling. snake_case naming.
 *
 *   3. **koffi cdylib JSON-ABI** (same crate, `score_combo_simd`).
 *      Full JSON-envelope marshalling. **Slowest path.** Fallback when the
 *      typed ABI isn't available.
 *
 * Both backends expose `ComboScorerNative` / `NapiComboScorer`.
 *
 * Env opt-in: `OMNIROUTE_FFI_COMBO_SCORER_ENABLED=1` (any backend).
 * Env opt-out: `OMNIROUTE_FFI_COMBO_SCORER_DISABLE_NAPI=1` forces cdylib.
 * Env opt-out: `OMNIROUTE_FFI_COMBO_SCORER_DISABLE_TYPED=1` forces JSON-ABI.
 *
 * Safety: the native functions are pure, deterministic, and allocate only
 * via the returned Float32Array. No file I/O, no network.
 * Memory is owned by the caller (TS).
 */

import { DispatchEdgeError } from "../errors.ts";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Shape of the koffi-loaded cdylib module (snake_case naming). */
interface ComboScorerNative {
  score_combo_simd(factorsBytes: ArrayBuffer, weightsBytes: ArrayBuffer): ArrayBuffer;
  score_combo_simd_typed?(
    candidateFeatures: ArrayBuffer,
    candidates: number,
    maxCost: number,
    maxLatency: number
  ): ArrayBuffer;
  omniroute_ffi_combo_scorer_free_typed?(ptr: ArrayBuffer, len: number): void;
}

/** Shape of the napi-rs addon's exports (camelCase, napi-rs convention). */
interface NapiComboScorer {
  scoreSimdBatch(
    candidateFeatures: Float32Array | ArrayBuffer,
    candidates: number,
    maxCost: number,
    maxLatency: number
  ): Float32Array;
  healthCheck(): boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const SCORING_FACTOR_COUNT = 12;

/* ------------------------------------------------------------------ */
/*  Napi-rs addon backend (tried first)                                */
/* ------------------------------------------------------------------ */

let napiModule: NapiComboScorer | null = null;

function resolveNapiAddonPath(): string | null {
  const explicit = process.env.OMNIROUTE_FFI_COMBO_SCORER_NAPI_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  // Discover relative to this source file's location in the source tree.
  // In development, the addon lives at:
  //   crates/omniroute-ffi/…/combo-scorer-napi/combo-scorer-napi.<platform>.node
  // In production (installed via optionalDependencies), it lives at:
  //   node_modules/@omniroute/ffi-<platform>/combo-scorer-napi.<platform>.node
  const dataDir = process.env.DATA_DIR ?? `${process.env.HOME}/.omniroute`;
  const platformTriple = `${process.platform}-${process.arch}`.replace("darwin", "darwin").replace("win32", "win32");
  const candidates = [
    // 1. explicit DATA_DIR/ffi path
    resolve(dataDir, "ffi", `combo-scorer-napi.${platformTriple}.node`),
    // 2. relative to this source file (dev tree)
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../crates/omniroute-ffi/crates/combo-scorer-napi",
      `combo-scorer-napi.${platformTriple}.node`
    ),
    // 3. npm-installed optionalDependency
    resolve(dataDir, "..", "node_modules", `@omniroute/ffi-${platformTriple}`,
      `combo-scorer-napi.${platformTriple}.node`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

async function tryLoadNapiAddon(): Promise<NapiComboScorer | null> {
  if (napiModule) return napiModule;
  if (process.env.OMNIROUTE_FFI_COMBO_SCORER_DISABLE_NAPI === "1") return null;
  const napiPath = resolveNapiAddonPath();
  if (!napiPath) return null;
  try {
    // Node.js native addons loaded via dynamic import.
    const raw = (await import(napiPath)) as Record<string, unknown>;
    if (typeof raw.scoreSimdBatch !== "function") {
      console.warn(`[dispatch] napi-rs addon at ${napiPath} missing scoreSimdBatch`);
      return null;
    }
    napiModule = raw as unknown as NapiComboScorer;
    return napiModule;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  koffi cdylib backend (fallback)                                     */
/* ------------------------------------------------------------------ */

let cdylibModule: ComboScorerNative | null = null;
let cdylibError: Error | null = null;
let cdylibPath: string | null = null;

function resolveCdylibPath(): string | null {
  if (cdylibPath !== null) return cdylibPath;
  const explicit = process.env.OMNIROUTE_FFI_COMBO_SCORER_PATH;
  if (explicit && existsSync(explicit)) {
    cdylibPath = explicit;
    return cdylibPath;
  }
  const dataDir = process.env.DATA_DIR ?? `${process.env.HOME}/.omniroute`;
  const candidate = resolve(dataDir, "ffi", "combo_scorer.node");
  cdylibPath = candidate;
  return candidate;
}

async function tryLoadCdylib(): Promise<ComboScorerNative> {
  if (cdylibModule) return cdylibModule;
  if (cdylibError) throw cdylibError;
  const path = resolveCdylibPath();
  if (!path || !existsSync(path)) {
    const err = new DispatchEdgeError(
      `combo_scorer cdylib not found at ${path ?? "(no path)"}`,
      "FFI_NOT_AVAILABLE"
    );
    cdylibError = err;
    throw err;
  }
  try {
    cdylibModule = (await import(path)) as unknown as ComboScorerNative;
    return cdylibModule;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new DispatchEdgeError(
      `combo_scorer cdylib load failed: ${msg}`,
      "FFI_NOT_AVAILABLE"
    );
    cdylibError = err;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Score a batch via whichever native backend is available, preferring
 * 1. napi-rs addon (camelCase, Float32Array TypedArray ABI)   ← NEW
 * 2. koffi typed-ABI (snake_case, ArrayBuffer)
 * 3. koffi JSON-ABI
 *
 * Returns `null` when no native backend is available so the caller
 * can fall back to the in-process TS scorer.
 */
export async function loadComboScorer(): Promise<void> {
  await __loadNapiAddon();
}

export async function scoreBatchViaFfi(
  batch: number[][],
  weights: number[]
): Promise<number[]> {
  // Validate counts up front so the caller gets a clear error
  // regardless of whether the native module is loaded.
  if (batch.length === 0) return [];
  for (const f of batch) {
    if (f.length !== SCORING_FACTOR_COUNT) {
      throw new Error(`every factors[] must have ${SCORING_FACTOR_COUNT} entries, got ${f.length}`);
    }
  }

  // Env gate — skip native call when feature is disabled.
  if (process.env.OMNIROUTE_FFI_COMBO_SCORER_ENABLED !== "1") return null as unknown as number[];

  // 1. Try napi-rs addon first — no marshalling overhead.
  const napi = await tryLoadNapiAddon();
  if (napi) {
    const flat = new Float32Array(batch.length * SCORING_FACTOR_COUNT + SCORING_FACTOR_COUNT + 2);
    for (let i = 0; i < batch.length; i++) {
      flat.set(batch[i], i * SCORING_FACTOR_COUNT);
    }
    flat.set(weights, batch.length * SCORING_FACTOR_COUNT);
    const result = napi.scoreSimdBatch(flat, batch.length, 1, 1);
    return Array.from(result);
  }

  // 2. Try koffi typed-ABI.
  try {
    const native = await tryLoadCdylib();
    if (typeof native.score_combo_simd_typed === "function") {
      return await scoreBatchViaFfiTyped(batch, weights, 1, 1, native) ?? [];
    }
    // 3. Fall back to JSON-ABI.
    const flat = new Float64Array(batch.length * SCORING_FACTOR_COUNT);
    for (let i = 0; i < batch.length; i++) {
      flat.set(batch[i], i * SCORING_FACTOR_COUNT);
    }
    const weightsBuf = new Float64Array(weights).buffer;
    const scoresBuf = native.score_combo_simd(flat.buffer, weightsBuf);
    return Array.from(new Float64Array(scoresBuf));
  } catch {
    return null as unknown as number[];
  }
}

/**
 * Score a batch via the F2b typed-array ABI (zero-copy).
 * Accepts an optional pre-resolved native handle from `tryLoadCdylib`
 * to avoid re-loading the same module in the stacked path.
 */
async function scoreBatchViaFfiTyped(
  batch: number[][],
  weights: number[],
  maxCost: number,
  maxLatency: number,
  native?: ComboScorerNative
): Promise<number[] | null> {
  if (batch.length === 0) return [];
  let mod: ComboScorerNative;
  try {
    mod = native ?? (await tryLoadCdylib());
  } catch {
    return null;
  }
  if (typeof mod.score_combo_simd_typed !== "function") return null;

  const flat = new Float32Array(batch.length * SCORING_FACTOR_COUNT + SCORING_FACTOR_COUNT + 2);
  for (let i = 0; i < batch.length; i++) {
    flat.set(batch[i], i * SCORING_FACTOR_COUNT);
  }
  flat.set(weights, batch.length * SCORING_FACTOR_COUNT);
  const paramOff = batch.length * SCORING_FACTOR_COUNT + SCORING_FACTOR_COUNT;
  flat[paramOff] = maxCost;
  flat[paramOff + 1] = maxLatency;

  const scoresBuf = mod.score_combo_simd_typed(flat.buffer, batch.length, maxCost, maxLatency);
  if (mod.omniroute_ffi_combo_scorer_free_typed) {
    mod.omniroute_ffi_combo_scorer_free_typed(scoresBuf, batch.length);
  }
  return Array.from(new Float32Array(scoresBuf));
}

/**
 * Single-candidate scoring (for default-weight estimates).
 * Prefers the napi-rs addon.
 */
export async function scoreSingleViaFfi(
  factors: number[],
  weights: number[]
): Promise<number> {
  if (factors.length !== SCORING_FACTOR_COUNT) {
    throw new Error(`factors must have ${SCORING_FACTOR_COUNT} entries, got ${factors.length}`);
  }
  if (weights.length !== SCORING_FACTOR_COUNT) {
    throw new Error(`weights must have ${SCORING_FACTOR_COUNT} entries, got ${weights.length}`);
  }
  const napi = await tryLoadNapiAddon();
  if (napi) {
    const flat = new Float32Array(SCORING_FACTOR_COUNT * 2 + 2);
    flat.set(factors, 0);
    flat.set(weights, SCORING_FACTOR_COUNT);
    const result = napi.scoreSimdBatch(flat, 1, 1, 1);
    return result[0];
  }
  const scores = await scoreBatchViaFfi([factors], weights);
  return scores[0] ?? 0;
}

/**
 * Check whether a native scoring backend is available and healthy.
 */
export async function checkFfiHealth(): Promise<{
  healthy: boolean;
  backend: "napi" | "cdylib" | "none";
  error?: string;
}> {
  const napi = await tryLoadNapiAddon();
  if (napi) {
    const ok = typeof napi.healthCheck === "function" ? napi.healthCheck() : true;
    return { healthy: ok, backend: "napi" };
  }
  try {
    await tryLoadCdylib();
    return { healthy: true, backend: "cdylib" };
  } catch (e) {
    return { healthy: false, backend: "none", error: String(e) };
  }
}

/**
 * Test-only: clear all module caches so the next call re-probes filesystem.
 */
export function __resetComboScorerLoaderForTests(): void {
  napiModule = null;
  cdylibModule = null;
  cdylibError = null;
  cdylibPath = null;
}
