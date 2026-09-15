/**
 * Quota fetcher registrations — called once at module load time.
 *
 * Extracted from chat.ts to reduce its import surface and keep the main
 * handler barrel focused on request flow.
 */

import { registerCodexQuotaFetcher } from "@omniroute/open-sse/services/codexQuotaFetcher.ts";
import { registerBailianCodingPlanQuotaFetcher } from "@omniroute/open-sse/services/bailianQuotaFetcher.ts";
import { registerQwenTokenPlanQuotaFetcher } from "@omniroute/open-sse/services/qwenTokenPlanQuotaFetcher.ts";
import { registerCrofUsageFetcher } from "@omniroute/open-sse/services/crofUsageFetcher.ts";
import { registerDeepseekQuotaFetcher } from "@omniroute/open-sse/services/deepseekQuotaFetcher.ts";
import {
  registerMoonshotQuotaFetcher,
  registerMoonshotFetchersForNodes,
} from "@omniroute/open-sse/services/moonshotQuotaFetcher.ts";
import { registerOpenrouterQuotaFetcher } from "@omniroute/open-sse/services/openrouterQuotaFetcher.ts";
import { registerOpencodeQuotaFetcher } from "@omniroute/open-sse/services/opencodeQuotaFetcher.ts";
import { registerGrokWebQuotaFetcher } from "@omniroute/open-sse/services/grokQuotaFetcher.ts";
import { registerGenericQuotaFetchers } from "@omniroute/open-sse/services/genericQuotaFetcher.ts";
import "@omniroute/open-sse/services/quotaTrackersBatch.ts";

let _registered = false;

/**
 * Register all quota fetchers once per server start.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export function registerAllQuotaFetchers(): void {
  if (_registered) return;
  _registered = true;

  registerCodexQuotaFetcher();

  // Register Bailian Coding Plan quota fetcher at module load (once per server start).
  // This hooks into the quotaPreflight + quotaMonitor systems so that combos
  // can proactively switch accounts before quota is exhausted.
  registerBailianCodingPlanQuotaFetcher();

  // Register the Qwen Cloud / Model Studio personal Token Plan fetcher (#9603).
  // Cookie-authenticated console gateway — 5-hour + weekly sliding windows.
  // Runs before registerGenericQuotaFetchers so the bespoke fetcher wins.
  registerQwenTokenPlanQuotaFetcher();

  // Register CrofAI usage fetcher (subscription requests + credits balance).
  // Surfaces usable_requests + credits in the monitor and only blocks (preflight
  // opt-in) when the active bucket reaches zero.
  registerCrofUsageFetcher();
  // Register DeepSeek balance quota fetcher.
  // Hooks into quotaPreflight + quotaMonitor so combos can switch accounts before balance is exhausted.
  registerDeepseekQuotaFetcher();
  registerMoonshotQuotaFetcher();
  void import("@/lib/db/providers")
    .then(({ getProviderNodes }) => getProviderNodes())
    .then((nodes) => {
      registerMoonshotFetchersForNodes(
        (Array.isArray(nodes) ? nodes : []).map((node) => ({
          id: typeof node.id === "string" ? node.id : null,
          prefix: typeof node.prefix === "string" ? node.prefix : null,
          baseUrl: typeof node.baseUrl === "string" ? node.baseUrl : null,
        }))
      );
    })
    .catch((error) => {
      console.warn("[STARTUP] Moonshot custom-node fetcher scan skipped:", error);
    });
  registerOpenrouterQuotaFetcher();

  // Register OpenCode quota fetcher (opencode-go / opencode / opencode-zen).
  // Surfaces the $12/5h, $30/wk, $60/mo windows in the limits page and enables
  // quota-aware preflight switching between connections. (#2852)
  registerOpencodeQuotaFetcher();

  // Register Grok Web quota fetcher.
  // Reads account-level OIDC tokens from ~/.grok/auth.json (the local Grok CLI
  // login) to surface the weekly credit-usage percentage in the dashboard.
  // This runs before registerGenericQuotaFetchers so the bespoke fetcher takes
  // precedence over the generic path (which can't resolve grok OIDC auth from
  // cookie-based connections).
  registerGrokWebQuotaFetcher();

  // Register the generic quota fetcher for every other provider that has a
  // usage implementation in usage.ts but no bespoke preflight fetcher. This is
  // what lets the per-window cutoff modal in Dashboard › Limits actually
  // enforce thresholds for Claude / GLM / Cursor / etc., not just Codex.
  registerGenericQuotaFetchers();
}
