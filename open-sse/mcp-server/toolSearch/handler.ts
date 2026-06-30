import { getAllToolDefinitions } from "./catalog.ts";
import { searchTools } from "./search.ts";
import { zodToTsSignature } from "./signature.ts";
import {
  reduceToolManifest,
  type ToolManifestEntry,
  type ToolProfile,
} from "../toolCardinality.ts";

export function handleToolSearch(
  args: { query: string; limit?: number },
  options: { toolProfile?: ToolProfile | null } = {}
) {
  const allEntries = getAllToolDefinitions();
  const visibleEntries = options.toolProfile
    ? filterEntriesByToolProfile(allEntries, options.toolProfile)
    : allEntries;
  const entries = visibleEntries.filter((t) => t.name !== "omniroute_tool_search");
  const hits = searchTools(entries, args.query, args.limit ?? 8);
  return {
    query: args.query,
    count: hits.length,
    tools: hits.map((h) => ({
      name: h.name,
      description: h.description,
      scopes: [...h.scopes],
      signature: zodToTsSignature(h.name, h.inputSchema),
    })),
  };
}

function filterEntriesByToolProfile(
  entries: ReturnType<typeof getAllToolDefinitions>,
  toolProfile: ToolProfile
): ReturnType<typeof getAllToolDefinitions> {
  const manifest: ToolManifestEntry[] = entries.map((entry) => ({
    name: entry.name,
    description: entry.description,
    scopes: entry.scopes,
  }));
  const visibleNames = new Set(reduceToolManifest(manifest, toolProfile).map((entry) => entry.name));
  return entries.filter((entry) => visibleNames.has(entry.name));
}
