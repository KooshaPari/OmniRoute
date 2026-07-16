/**
 * bifrostShadowWrap — WP-B4 helper.
 *
 * Wraps a Bifrost-routed executor so every Bifrost-routed request
 * also fires a `legacyExecute` call in parallel and the result is
 * compared via `computeAgreementScore`. The LIVE response returned
 * to the caller is the BIFROST result. The legacy result is only
 * used for divergence measurement.
 *
 * This is the INVERSE of the existing `runWithShadowSampler` in
 * `bifrostShadow.ts`, which treats the chatCore executor (named
 * `legacyExecute` for historical reasons) as the live path and
 * Bifrost as the shadow. The B6 phase used that shape. The B7
 * phase (5% → 100%) flips the live path to Bifrost.
 *
 * @module open-sse/executors/bifrostShadowWrap
 */

import { computeAgreementScore } from "./bifrostShadow.ts";
import { BIFROST_TAG } from "./bifrost.ts";

type ShadowWrapLogger = {
  info?: (tag: string, msg: string) => void;
  warn?: (tag: string, msg: string) => void;
  error?: (tag: string, msg: string) => void;
};

export interface WrapBifrostExecutorWithShadowOptions {
  provider: string;
  log?: ShadowWrapLogger;
  /**
   * Legacy executor used as the shadow. Fires in parallel with the
   * live Bifrost call. Required.
   */
  legacyExecute: (input: unknown) => Promise<unknown>;
  /**
   * Optional divergence event recorder. Defaults to no-op.
   */
  recordEvent?: (input: {
    provider: string;
    agreementScore: number;
    tsUnixMs: number;
  }) => void;
  /**
   * Optional disable flag. When true the wrapper forwards to the
   * Bifrost executor without firing a shadow. Defaults to false.
   */
  disableShadow?: boolean;
}

export interface BifrostShadowWrapped<T> {
  wrapped: T;
  /**
   * Stop firing shadow calls. Subsequent `.execute(input)` calls
   * only invoke the Bifrost executor.
   */
  disable(): void;
}

/**
 * Wrap a Bifrost executor with legacy-shadow sampling. The returned
 * `wrapped` object exposes the same `.execute(input)` shape as the
 * underlying Bifrost executor. The BifrostShadowWrapped envelope
 * also exposes `disable()` for the kill switch.
 */
export function wrapBifrostExecutorWithShadow<
  T extends { execute: (input: unknown) => Promise<unknown> }
>(bifrost: T, opts: WrapBifrostExecutorWithShadowOptions): BifrostShadowWrapped<T> {
  let shadowEnabled = !opts.disableShadow;
  const wrapped: T = Object.create(bifrost);
  wrapped.execute = async (input: unknown): Promise<unknown> => {
    if (!shadowEnabled) {
      opts.log?.info?.(BIFROST_TAG, `${opts.provider} → bifrost (shadow disabled)`);
      return bifrost.execute(input);
    }
    opts.log?.info?.(
      BIFROST_TAG,
      `${opts.provider} → bifrost (live) + legacy (shadow), agree=pending`,
    );
    // Fire both in parallel. Bifrost is the live path; the legacy
    // result is captured for divergence measurement only.
    const livePromise = bifrost.execute(input);
    const shadowPromise = opts.legacyExecute(input);
    void Promise.allSettled([livePromise, shadowPromise]).then(([live, shadow]) => {
      if (live.status !== "fulfilled" || shadow.status !== "fulfilled") return;
      const liveText = extractText(live.value);
      const shadowText = extractText(shadow.value);
      if (liveText === null || shadowText === null) return;
      const score = computeAgreementScore(liveText, shadowText);
      opts.recordEvent?.({
        provider: opts.provider,
        agreementScore: score,
        tsUnixMs: Date.now(),
      });
      if (score < 0.8) {
        opts.log?.warn?.(
          BIFROST_TAG,
          `${opts.provider} bifrost/legacy divergence score=${score.toFixed(3)}`,
        );
      }
    });
    return livePromise;
  };
  return {
    wrapped,
    disable(): void {
      shadowEnabled = false;
    },
  };
}

/** Best-effort text extraction from an executor output. */
function extractText(out: unknown): string | null {
  if (!out || typeof out !== "object") return null;
  const o = out as { response?: { body?: unknown } };
  const body = o.response?.body;
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const b = body as { text?: unknown; content?: unknown };
    if (typeof b.text === "string") return b.text;
    if (Array.isArray(b.content)) {
      return b.content
        .map((c: unknown) => {
          if (c && typeof c === "object" && "text" in c) {
            const t = (c as { text?: unknown }).text;
            return typeof t === "string" ? t : "";
          }
          return "";
        })
        .join("");
    }
  }
  return null;
}
