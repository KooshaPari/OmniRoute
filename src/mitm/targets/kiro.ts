/**
 * Kiro IDE target descriptor.
 *
 * Provides:
 *  - `KIRO_TARGET`: canonical `MitmTarget` per AgentBridge target contract.
 *  - `KIRO_MITM_PROFILE`: legacy alias retained for
 *    `src/app/api/settings/mitm/route.ts`.
 */
import type { MitmTarget } from "../types";

const HOSTS = ["api.anthropic.com"];
const ENDPOINTS = ["/v1/messages"];
const INSTRUCTIONS = [
  "1. Install OmniRoute's root certificate: run `omniroute cert install` or use Settings -> MITM Certificates",
  "2. Start the MITM proxy: `omniroute mitm start --target kiro`",
  "3. Set your system HTTP proxy to 127.0.0.1:20130 or use transparent MITM via DNS override",
  "4. Open Kiro IDE; API calls will be routed through OmniRoute",
  "5. Verify Proxy Logs in the OmniRoute dashboard for provider=anthropic source=mitm",
];

export const KIRO_TARGET: MitmTarget = {
  id: "kiro",
  name: "Kiro IDE",
  icon: "terminal",
  color: "#7C3AED",
  hosts: HOSTS,
  port: 443,
  endpointPatterns: ENDPOINTS,
  defaultModels: [
    {
      id: "claude-sonnet-4.5",
      name: "Claude Sonnet 4.5",
      alias: "claude-sonnet-4.5",
    },
    {
      id: "claude-opus-4.5",
      name: "Claude Opus 4.5",
      alias: "claude-opus-4.5",
    },
  ],
  setupTutorial: {
    steps: INSTRUCTIONS,
    detection: { command: "which kiro", platform: "all" },
  },
  handler: () =>
    import("../handlers/kiro").then((m) => ({
      default: m.KiroHandler,
    })),
  riskNoticeKey: "providers.riskNotice.oauth",
};

export const KIRO_MITM_PROFILE: MitmTarget & {
  description: string;
  targetHost: string;
  targetPort: number;
  localPort: number;
  userAgentPattern: string | null;
  apiEndpoints: string[];
  authHeader: string;
  instructions: string[];
  referenceIde?: string;
} = {
  ...KIRO_TARGET,
  description:
    "Intercepts Kiro IDE requests to api.anthropic.com and routes them through OmniRoute.",
  targetHost: HOSTS[0],
  targetPort: 443,
  localPort: 20130,
  userAgentPattern: null,
  apiEndpoints: ENDPOINTS,
  authHeader: "x-api-key",
  instructions: INSTRUCTIONS,
  referenceIde: "antigravity",
};
