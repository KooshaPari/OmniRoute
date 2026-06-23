import {
  getStaticProviderCatalogGroup,
  resolveProviderCatalogEntry,
  type CompatibleProviderLabels,
  type CompatibleProviderNodeLike,
  type ProviderCatalogMetadata,
  type ResolvedProviderCatalogEntry,
  type StaticProviderCatalogCategory,
} from "@/lib/providers/catalog";
import { isClaudeCodeCompatibleProvider } from "@/shared/constants/providers";
import { getModelsByProviderId } from "@/shared/constants/models";
import { providerHasServiceKind } from "@/lib/providers/serviceKindIndex";
import { compareTr, matchesSearch } from "@/shared/utils/turkishText";
import type { ProviderDisplayMode } from "./providerPageStorage";

export interface ProviderStatsSnapshot {
  total?: number;
  [key: string]: unknown;
}

export interface ProviderEntry<TProvider = Record<string, unknown>> {
  providerId: string;
  provider: TProvider;
  stats: ProviderStatsSnapshot;
  displayAuthType: "oauth" | "apikey" | "compatible" | "no-auth";
  toggleAuthType: "oauth" | "free" | "apikey" | "no-auth";
}

export type CompatibleProviderInfo = {
  id: string;
  name: string;
  color: string;
  textIcon: string;
  apiType?: string;
};

export type CompatibleProviderGroups = {
  openai: CompatibleProviderInfo[];
  anthropic: CompatibleProviderInfo[];
  claudeCode: CompatibleProviderInfo[];
};

export function shouldApplyConfiguredOnlyFilter(
  showConfiguredOnly: boolean,
  connectionCount: number
): boolean {
  return showConfiguredOnly && connectionCount > 0;
}

export function shouldFilterProviderEntriesForDisplayMode(
  displayMode: ProviderDisplayMode,
  connectionCount: number
): boolean {
  if (displayMode === "compact") return true;

  return shouldApplyConfiguredOnlyFilter(displayMode === "configured", connectionCount);
}

export function shouldShowFirstProviderHint(
  connectionCount: number,
  searchQuery?: string
): boolean {
  return connectionCount === 0 && !searchQuery?.trim();
}

type ProviderRecord<TProvider = Record<string, unknown>> = Record<string, TProvider>;

type GetProviderStats = (
  providerId: string,
  authType: "oauth" | "free" | "apikey"
) => ProviderStatsSnapshot;

function getProviderSortLabel<TProvider>(entry: ProviderEntry<TProvider>): string {
  const provider = entry.provider as Record<string, unknown>;
  const name = typeof provider.name === "string" ? provider.name : "";
  return (name || entry.providerId).toLowerCase();
}

export function sortProviderEntriesByName<TProvider>(
  entries: ProviderEntry<TProvider>[]
): ProviderEntry<TProvider>[] {
  return [...entries].sort((a, b) => {
    const nameCompare = compareTr(getProviderSortLabel(a), getProviderSortLabel(b));
    if (nameCompare !== 0) return nameCompare;
    return a.providerId.localeCompare(b.providerId); // teknik sıralama: ASCII kasıtlı
  });
}

export function buildProviderEntries<TProvider = Record<string, unknown>>(
  providers: ProviderRecord<TProvider>,
  displayAuthType: ProviderEntry["displayAuthType"],
  toggleAuthType: ProviderEntry["toggleAuthType"],
  getProviderStats: GetProviderStats
): ProviderEntry<TProvider>[] {
  return Object.entries(providers).map(([providerId, provider]) => ({
    providerId,
    provider,
    stats: getProviderStats(providerId, toggleAuthType),
    displayAuthType,
    toggleAuthType,
  }));
}

export function buildMergedOAuthProviderEntries<TProvider = Record<string, unknown>>(
  oauthProviders: ProviderRecord<TProvider>,
  freeProviders: ProviderRecord<TProvider>,
  getProviderStats: GetProviderStats
): ProviderEntry<TProvider>[] {
  return [
    ...buildProviderEntries(oauthProviders, "oauth", "oauth", getProviderStats),
    ...buildProviderEntries(freeProviders, "oauth", "free", getProviderStats),
  ];
}

export function buildStaticProviderEntries(
  category: StaticProviderCatalogCategory,
  getProviderStats: GetProviderStats
): ProviderEntry<ProviderCatalogMetadata>[] {
  const group = getStaticProviderCatalogGroup(category);
  return buildProviderEntries(
    group.providers,
    group.displayAuthType,
    group.toggleAuthType,
    getProviderStats
  );
}

export function buildCompatibleProviderGroups(
  providerNodes: Array<{ id: string; name?: string; type?: string; apiType?: string }>,
  labels: {
    openaiCompatibleName: string;
    anthropicCompatibleName: string;
    claudeCodeCompatibleName: string;
  }
): CompatibleProviderGroups {
  const openai: CompatibleProviderInfo[] = [];
  const anthropic: CompatibleProviderInfo[] = [];
  const claudeCode: CompatibleProviderInfo[] = [];
  // #4746: defensive dedup — a node can appear twice if `setProviderNodes`
  // is called twice with the same id (e.g. re-opening the add-modal after
  // the previous save hasn't completed). Last-write-wins preserves the most
  // recent name/apiType for the user.
  const seen = new Set<string>();

  for (const node of providerNodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);

    if (node.type === "openai-compatible") {
      openai.push({
        id: node.id,
        name: node.name || labels.openaiCompatibleName,
        color: "#10A37F",
        textIcon: "OC",
        apiType: node.apiType,
      });
      continue;
    }

    if (node.type !== "anthropic-compatible") continue;

    if (isClaudeCodeCompatibleProvider(node.id)) {
      claudeCode.push({
        id: node.id,
        name: node.name || labels.claudeCodeCompatibleName,
        color: "#B45309",
        textIcon: "CC",
      });
      continue;
    }

    anthropic.push({
      id: node.id,
      name: node.name || labels.anthropicCompatibleName,
      color: "#D97757",
      textIcon: "AC",
    });
  }

  return { openai, anthropic, claudeCode };
}

/**
 * Append a provider node to an existing list, deduplicating by `id`.
 *
 * #4746: the three `setProviderNodes((prev) => [...prev, node])` call sites
 * in page.tsx could double-add a node if the user re-opens the add-modal
 * after the previous save hasn't completed. Last-write-wins semantics — a
 * re-add with the same id replaces the prior entry (preserving the latest
 * `name` and `apiType`).
 */
export function appendProviderNode<T extends { id: string }>(
  prev: T[],
  node: T
): T[] {
  const existingIndex = prev.findIndex((p) => p.id === node.id);
  if (existingIndex === -1) {
    return [...prev, node];
  }
  if (existingIndex === prev.length - 1) {
    // Already last entry with same id — no-op (cheap reference equality).
    return prev;
  }
  const next = prev.slice();
  next[existingIndex] = node;
  return next;
}

export function filterConfiguredProviderEntries<TProvider>(
  entries: ProviderEntry<TProvider>[],
  showConfiguredOnly: boolean,
  searchQuery?: string,
  showFreeOnly?: boolean,
  modelSearchQuery?: string,
  serviceKindFilter?: string | null
): ProviderEntry<TProvider>[] {
  let filtered = entries;

  // #4240: category (serviceKind) filter — keep providers whose declared OR
  // registry-derived serviceKinds include the selected kind. Composes with the
  // configured-only / free / search predicates below.
  if (serviceKindFilter) {
    filtered = filtered.filter((entry) => {
      const declared = (entry.provider as { serviceKinds?: string[] }).serviceKinds;
      return providerHasServiceKind(entry.providerId, declared, serviceKindFilter);
    });
  }

  if (showConfiguredOnly) {
    // no-auth providers never create a DB connection row (stats.total === 0) but
    // are always usable and appear unconditionally in the /v1/models catalog, so
    // they must not be hidden by the configured-only filter (#3290).
    filtered = filtered.filter(
      (entry) => entry.displayAuthType === "no-auth" || Number(entry.stats?.total || 0) > 0
    );
  }

  if (showFreeOnly) {
    filtered = filtered.filter((entry) => {
      const provider = entry.provider as Record<string, unknown>;
      return provider.hasFree === true;
    });
  }

  if (searchQuery && searchQuery.trim()) {
    filtered = filtered.filter((entry) => {
      const provider = entry.provider as Record<string, unknown>;
      return (
        matchesSearch(String(provider.name || ""), searchQuery) ||
        matchesSearch(entry.providerId, searchQuery)
      );
    });
  }

  if (modelSearchQuery && modelSearchQuery.trim()) {
    const q = modelSearchQuery.trim();
    filtered = filtered.filter((entry) => {
      const models = getModelsByProviderId(entry.providerId);
      return models.some((m) => matchesSearch(m.id, q) || matchesSearch(m.name, q));
    });
  }

  return sortProviderEntriesByName(filtered);
}

function pushUniqueProviderEntry<TProvider>(
  entries: ProviderEntry<TProvider>[],
  seenProviderIds: Set<string>,
  entry: ProviderEntry<TProvider>
) {
  if (seenProviderIds.has(entry.providerId)) return;

  seenProviderIds.add(entry.providerId);
  entries.push(entry);
}

export function buildCompactProviderEntries<TProvider>(
  groups: ProviderEntry<TProvider>[][],
  options: { deferNoAuth?: boolean } = {}
): ProviderEntry<TProvider>[] {
  const seenProviderIds = new Set<string>();
  const visibleEntries: ProviderEntry<TProvider>[] = [];
  const deferredNoAuthEntries: ProviderEntry<TProvider>[] = [];
  const seenDeferredNoAuthProviderIds = new Set<string>();

  for (const group of groups) {
    for (const entry of group) {
      if (options.deferNoAuth && entry.displayAuthType === "no-auth") {
        pushUniqueProviderEntry(deferredNoAuthEntries, seenDeferredNoAuthProviderIds, entry);
        continue;
      }

      pushUniqueProviderEntry(visibleEntries, seenProviderIds, entry);
    }
  }

  for (const entry of deferredNoAuthEntries) {
    pushUniqueProviderEntry(visibleEntries, seenProviderIds, entry);
  }

  return visibleEntries;
}

export function resolveDashboardProviderInfo(
  providerId: string,
  options?: {
    providerNode?: CompatibleProviderNodeLike | null;
    compatibleLabels?: CompatibleProviderLabels | null;
  }
): ResolvedProviderCatalogEntry | null {
  return resolveProviderCatalogEntry(providerId, options);
}
