/**
 * Dispatch RPC — Transport-Agnostic Edge Interface (ADR-032 / F1).
 *
 * Each hot module exposes a single `DispatchEdge` with a stable contract
 * `TIn → TOut` and a tier (`T1` HTTP / `T2` UDS RPC / `T3` FFI). Callers
 * use `invoke(edge, input)`; the resolver decides which transport to use
 * based on the edge's tier + runtime config (`OMNIROUTE_EDGE_TIER_*`
 * env overrides per edge).
 *
 * Why transport-agnostic:
 *   - F1 lets us swap Cap'n Proto / FlatBuffers / Protobuf / JSON-RPC without
 *     touching call sites.
 *   - T3 FFI surfaces share the same interface as T1/T2, so we can A/B test
 *     perf on the same edge.
 *   - Tier can be downgraded at runtime (e.g. on kill-switch activation) via
 *     `setEdgeTier(edgeName, tier)`.
 *
 * See ADR-032 § "Decision Rule" for the per-edge tier selection policy.
 */

export type EdgeTier = "T1" | "T2" | "T3";

export interface DispatchEdge<TIn, TOut> {
  /** Stable identifier used for env-var lookup + logging + kill-switch targeting. */
  readonly name: string;
  /** Default tier set at registration time. */
  defaultTier: EdgeTier;
  /**
   * Optional per-provider scope for the cascading kill-switch
   * (ADR-032 § "Per-provider cascading kill-switch", Appendix C).
   * When a provider listed here is tripped by the Bifrost kill-switch,
   * this edge is downgraded to T1; otherwise the edge is unaffected.
   * Empty/undefined → the edge is provider-agnostic and the kill-switch
   * uses the GLOBAL fallback (`syncDispatchToKillSwitch`).
   */
  readonly providerScope?: readonly string[];
  /** T1 contract: HTTP `fetch` on Node. Always available. */
  readonly http?: HttpEdgeContract<TIn, TOut>;
  /** T2 contract: UDS RPC via `open-sse/rpc/udsServer`. Optional. */
  readonly uds?: UdsEdgeContract<TIn, TOut>;
  /** T3 contract: native ABI FFI via `open-sse/rpc/ffiLoader`. Optional. */
  readonly ffi?: FfiEdgeContract<TIn, TOut>;
  /** Smoke-test the edge; called on boot. Returns null on success or an error string. */
  healthcheck?: () => Promise<string | null>;
}

export interface HttpEdgeContract<TIn, TOut> {
  /** POST endpoint, e.g. `/v1/edges/compression/lite`. */
  readonly path: string;
  /** Optional timeout (ms). Defaults to 5000. */
  readonly timeoutMs?: number;
}

export interface UdsEdgeContract<TIn, TOut> {
  /** UDS socket path. Defaults to `OMNIROUTE_UDS_SOCKET` env or `${DATA_DIR}/dispatch.sock`. */
  readonly socket?: string;
  /** JSON-RPC method name (e.g. `compression.collapseWhitespace`). */
  readonly method: string;
  /** Optional timeout (ms). Defaults to 1000. */
  readonly timeoutMs?: number;
}

export interface FfiEdgeContract<TIn, TOut> {
  /** FFI crate name, e.g. `omniroute_ffi_combo_scorer`. */
  readonly crate: string;
  /** FFI symbol name, e.g. `score_combo_simd`. */
  readonly symbol: string;
  /** Optional timeout (ms). Defaults to 50. */
  readonly timeoutMs?: number;
}

export interface EdgeTierOverride {
  /** Per-edge override loaded from `OMNIROUTE_EDGE_TIER_<NAME>=T2|T3`. */
  tier: EdgeTier;
  /** Source of the override (env, kill-switch, A/B test). */
  source: "env" | "kill-switch" | "config";
}

/**
 * Edge registry — single source of truth for all hot-path edges. Populated
 * lazily by each subsystem on first use; never mutated after boot except
 * for tier overrides via `registerEdge` / `setEdgeTier`.
 */
const edges = new Map<string, DispatchEdge<unknown, unknown>>();

export const tierOverrides = new Map<string, EdgeTierOverride>();

export function registerEdge<TIn, TOut>(edge: DispatchEdge<TIn, TOut>): DispatchEdge<TIn, TOut> {
  const existing = edges.get(edge.name); if (existing) {
        existing.defaultTier = edge.defaultTier;
    return edge as DispatchEdge<TIn, TOut>;
  }
  edges.set(edge.name, edge as DispatchEdge<unknown, unknown>);
  applyEnvOverride(edge.name, edge.defaultTier);
  return edge;
}

function applyEnvOverride(edgeName: string, fallback: EdgeTier): void {
  const envKey = `OMNIROUTE_EDGE_TIER_${edgeName.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
  const raw = process.env[envKey];
  if (raw === "T1" || raw === "T2" || raw === "T3") {
    tierOverrides.set(edgeName, { tier: raw, source: "env" });
  }
  // Only write when env var exists; otherwise leave tierOverrides untouched
}

/**
 * Set the tier for an edge at runtime. Used by the kill-switch
 * (`open-sse/services/bifrostKillSwitch.ts`) when degrading to T1.
 */
export function setEdgeTier(edgeName: string, tier: EdgeTier, source: EdgeTierOverride["source"] = "config"): void {
  tierOverrides.set(edgeName, { tier, source });
}

export function getEdgeTier(edgeName: string): EdgeTier {
  const override = tierOverrides.get(edgeName);
  if (override) return override.tier;

  const edge = edges.get(edgeName);
  return edge?.defaultTier ?? "T1";
}

export function getEdgeTierOverride(edgeName: string): EdgeTierOverride | undefined {
  return tierOverrides.get(edgeName);
}

export function getEdge<TIn = unknown, TOut = unknown>(
  edgeName: string
): DispatchEdge<TIn, TOut> | undefined {
  return edges.get(edgeName) as DispatchEdge<TIn, TOut> | undefined;
}

export function listEdges(): readonly DispatchEdge<unknown, unknown>[] {
  return Array.from(edges.values());
}

export interface InvokeOptions {
  /** Hard timeout (ms). Overrides per-contract defaults. */
  timeoutMs?: number;
  /** Force a specific tier for this call (for A/B tests). */
  forceTier?: EdgeTier;
  /** AbortSignal propagation for upstream cancellation. */
  signal?: AbortSignal;
}

/**
 * Invoke an edge. Dispatches to the active tier's contract via:
 *   - T1: HTTP loopback (always available).
 *   - T2: UDS RPC (`open-sse/rpc/udsClient`).
 *   - T3: Native ABI FFI (`open-sse/rpc/ffi`).
 *
 * Falls back to T1 if the requested tier's contract is not registered
 * (so a missing FFI build doesn't break the hot path — graceful degrade).
 */
export async function invoke<TIn, TOut>(
  edgeName: string,
  input: TIn,
  options: InvokeOptions = {}
): Promise<TOut> {
  const edge = getEdge<TIn, TOut>(edgeName);
  if (!edge) {
    throw new Error(`Dispatch edge "${edgeName}" is not registered`);
  }

  const tier = options.forceTier ?? getEdgeTier(edgeName);

  if (tier === "T3" && edge.ffi) {
    return invokeFfi(edge, input, options);
  }
  if (tier === "T2" && edge.uds) {
    return invokeUds(edge, input, options);
  }
  if (edge.http) {
    return invokeHttp(edge, input, options);
  }
  // Last-ditch fallback — if T1 wasn't registered either, try T3/T2 regardless.
  if (tier !== "T1" && edge.ffi) return invokeFfi(edge, input, options);
  if (tier !== "T1" && edge.uds) return invokeUds(edge, input, options);

  throw new Error(`Dispatch edge "${edgeName}" has no usable binding for tier ${tier}`);
}

async function invokeHttp<TIn, TOut>(
  edge: DispatchEdge<TIn, TOut>,
  input: TIn,
  options: InvokeOptions
): Promise<TOut> {
  const contract = edge.http!;
  const body = await import("./httpClient.js").catch(() => null).then((m) => m?.invokeHttpEdge(contract, input, options));
  return body as TOut;
}

async function invokeUds<TIn, TOut>(
  edge: DispatchEdge<TIn, TOut>,
  input: TIn,
  options: InvokeOptions
): Promise<TOut> {
  const contract = edge.uds!;
  const result = await import("./udsClient.js").catch(() => null).then((m) => m?.invokeUdsEdge(contract, input, options));
  return result as TOut;
}

async function invokeFfi<TIn, TOut>(
  edge: DispatchEdge<TIn, TOut>,
  input: TIn,
  options: InvokeOptions
): Promise<TOut> {
  const contract = edge.ffi!;
  const result = await import("./ffi.js").catch(() => null).then((m) => m?.invokeFfiEdge(contract, input, options));
  return result as TOut;
}

/**
 * Boot-time loader. Reads all `OMNIROUTE_EDGE_TIER_*` env vars and applies
 * them. Idempotent — safe to call from `src/server-init.ts`.
 */
export function reloadEdgeTierOverrides(): void {
  for (const edge of edges.values()) {
    applyEnvOverride(edge.name, edge.defaultTier);
  }
}

/**
 * Test-only: reset the registry. Never call from production code.
 */
export function clearTierOverrides(): void {
  tierOverrides.clear();
}

export function __resetEdgeRegistryForTests(): void {
  edges.clear();
  tierOverrides.clear();
}
