/**
 * Provider-specific model-discovery handler barrel.
 *
 * Each handler follows the same signature:
 *   async function handle*(ctx: HandlerContext, h: HandlerHelpers): Promise<HandlerResult>
 *
 * Route.ts builds a HandlerContext + HandlerHelpers once per request,
 * then calls handlers in sequence until one returns a non-null response.
 *
 * To wire a new handler into route.ts:
 * 1. Import the handler function
 * 2. Add it to the `providerHandlers` array below
 * 3. Build ctx + h from the existing route-level variables
 * 4. Call `for (const handler of providerHandlers) { const r = await handler(ctx, h); if (r) return r; }`
 */

export { handleAzureAi, handleAzureOpenAI } from "./azure";
export { handleBedrock } from "./bedrock";
export { handleDataRobot } from "./dataRobot";
export { handleGitHubCopilot, handleGheCopilot } from "./githubCopilot";
export { handleGlm } from "./glm";
export { handleWatsonx, handleOci, handleSap } from "./ibmCloud";
export { handleKiro } from "./kiro";
export { handleOpenAICompatible } from "./openaiCompatible";
export { handleVertex } from "./vertex";
export type { HandlerContext, HandlerHelpers, HandlerResult } from "./context";
