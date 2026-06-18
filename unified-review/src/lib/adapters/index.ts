import { Tool, ReviewToolAdapter } from "../types";
import { ForgeAdapter } from "./forge";
import { CodeRabbitAdapter, CursorAdapter, KiloCodeAdapter, CopilotAdapter, CodeQLAdapter } from "./cloud";
import { BaseAdapter } from "./base";
import pino from "pino";

const logger = pino({ name: "unified-review:adapters" });

export { BaseAdapter };
export { ForgeAdapter };
export { CodeRabbitAdapter, CursorAdapter, KiloCodeAdapter, CopilotAdapter, CodeQLAdapter };

/** Cache of instantiated adapters */
const _adapters = new Map<Tool, ReviewToolAdapter>();

/** Get the adapter for a given tool — instantiated on first use */
export function getAdapter(tool: Tool): ReviewToolAdapter {
  const cached = _adapters.get(tool);
  if (cached) return cached;
  let adapter: ReviewToolAdapter;
  switch (tool) {
    case "forge": adapter = new ForgeAdapter(); break;
    case "coderabbit": adapter = new CodeRabbitAdapter(); break;
    case "cursor": adapter = new CursorAdapter(); break;
    case "kilocode": adapter = new KiloCodeAdapter(); break;
    case "copilot": adapter = new CopilotAdapter(); break;
    case "codeql":
    case "codeql-autofix": adapter = new CodeQLAdapter(); break;
    default:
      logger.warn({ tool }, "No adapter for tool — falling back to Forge");
      adapter = new ForgeAdapter();
  }
  _adapters.set(tool, adapter);
  return adapter;
}

/** Get health for all known adapters */
export async function getAllHealth(): Promise<Record<Tool, { available: boolean; remaining_quota: number }>> {
  const tools: Tool[] = ["copilot", "coderabbit", "cursor", "forge", "kilocode", "codeql", "codeql-autofix"];
  const out: Record<string, { available: boolean; remaining_quota: number }> = {};
  await Promise.all(tools.map(async (t) => {
    try { out[t] = await getAdapter(t).health(); }
    catch (err) { logger.warn({ err, tool: t }, "health check failed"); out[t] = { available: false, remaining_quota: 0 }; }
  }));
  return out as Record<Tool, { available: boolean; remaining_quota: number }>;
}
