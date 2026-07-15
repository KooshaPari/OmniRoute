<<<<<<< Updated upstream
export * from "./sidebarVisibility/types";
export { COMPRESSION_CONTEXT_GROUP, SIDEBAR_SECTIONS } from "./sidebarVisibility/sections";

import { HIDEABLE_SIDEBAR_ITEM_IDS } from "./sidebarVisibility/types";
import type {
  HideableSidebarItemId,
  SidebarSectionId,
  SidebarItemDefinition,
  SidebarSectionChild,
  SidebarSectionDefinition,
  SidebarPresetDefinition,
} from "./sidebarVisibility/types";

export const SIDEBAR_ICON_ACCENTS: Partial<Record<HideableSidebarItemId, string>> = {
  home: "#60A5FA",
  "api-manager": "#F59E0B",
  endpoints: "#38BDF8",
  providers: "#818CF8",
  combos: "#A855F7",
  quota: "#F472B6",
  "context-caveman": "#F97316",
  "context-rtk": "#2DD4BF",
  "context-combos": "#C084FC",
  "cli-code": "#FACC15",
  "cli-agents": "#93C5FD",
  "cloud-agents": "#7DD3FC",
  "api-endpoints": "#14B8A6",
  webhooks: "#EC4899",
  proxy: "#A3E635",
  "mitm-proxy": "#FB7185",
  "1proxy": "#22D3EE",
  analytics: "#06B6D4",
  "analytics-combo-health": "#34D399",
  "analytics-utilization": "#FBBF24",
  costs: "#FB923C",
  cache: "#84CC16",
  "analytics-compression": "#F97316",
  "analytics-search": "#38BDF8",
  "analytics-evals": "#A78BFA",
  logs: "#CBD5E1",
  "logs-proxy": "#A3E635",
  "logs-console": "#FACC15",
  "logs-activity": "#60A5FA",
  health: "#EF4444",
  runtime: "#F59E0B",
  "costs-pricing": "#FB923C",
  "costs-budget": "#22C55E",
  "costs-quota-share": "#06B6D4",
  audit: "#F43F5E",
  "audit-mcp": "#818CF8",
  "audit-a2a": "#A855F7",
  translator: "#3B82F6",
  playground: "#EAB308",
  "search-tools": "#0891B2",
  memory: "#10B981",
  skills: "#F43F5E",
  "agent-skills": "#D946EF",
  mcp: "#8B5CF6",
  a2a: "#06B6D4",
  leaderboard: "#FACC15",
  profile: "#60A5FA",
  tokens: "#A3E635",
  media: "#D946EF",
  batch: "#14B8A6",
  "batch-files": "#38BDF8",
  "settings-general": "#64748B",
  "settings-appearance": "#D946EF",
  "settings-ai": "#A78BFA",
  "settings-routing": "#06B6D4",
  "settings-resilience": "#22C55E",
  "settings-advanced": "#F97316",
  "settings-security": "#EF4444",
  "settings-feature-flags": "#FACC15",
  "settings-sidebar": "#38BDF8",
  docs: "#2563EB",
  issues: "#DC2626",
  changelog: "#F59E0B",
};

export const SIDEBAR_SUBITEM_ICON_ACCENTS: Record<string, string> = {};

function getDeterministicIconAccent(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  const saturation = 72;
  const lightness = 56;
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100);
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = lightness / 100 - chroma / 2;
  const [red, green, blue] =
    huePrime < 1
      ? [chroma, x, 0]
      : huePrime < 2
        ? [x, chroma, 0]
        : huePrime < 3
          ? [0, chroma, x]
          : huePrime < 4
            ? [0, x, chroma]
            : huePrime < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return [red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    )
    .join("")
    .replace(/^/, "#");
}

export function getSidebarIconAccent(id: string): string {
  return (
    SIDEBAR_ICON_ACCENTS[id as HideableSidebarItemId] ||
    SIDEBAR_SUBITEM_ICON_ACCENTS[id] ||
    getDeterministicIconAccent(id)
  );
}

export function getSectionItems(
  section: SidebarSectionDefinition | { children: readonly SidebarSectionChild[] }
): readonly SidebarItemDefinition[] {
  return section.children.flatMap((child) =>
    "type" in child && child.type === "group" ? child.items : [child as SidebarItemDefinition]
  );
}

// ─── Ordering & preset setting keys ──────────────────────────────────────────
=======
export const HIDEABLE_SIDEBAR_ITEM_IDS = [
  "home",
  "endpoints",
  "api-manager",
  "providers",
  "combos",
  "batch",
  "costs",
  "analytics",
  "cache",
  "limits",
  "cli-tools",
  "agents",
  "memory",
  "skills",
  "translator",
  "playground",
  "media",
  "search-tools",
  "logs",
  "audit",
  "webhooks",
  "health",
  "settings",
  "docs",
  "issues",
  "changelog",
] as const;

export type HideableSidebarItemId = (typeof HIDEABLE_SIDEBAR_ITEM_IDS)[number];
export type SidebarSectionId = "primary" | "cli" | "debug" | "system" | "help";

export interface SidebarItemDefinition {
  id: HideableSidebarItemId;
  href: string;
  i18nKey: string;
  icon: string;
  exact?: boolean;
  external?: boolean;
}

export interface SidebarSectionDefinition {
  id: SidebarSectionId;
  titleKey: string;
  titleFallback: string;
  items: readonly SidebarItemDefinition[];
  showTitleInSidebar?: boolean;
  visibility?: "always" | "debug";
}

const PRIMARY_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "home", href: "/dashboard", i18nKey: "home", icon: "home", exact: true },
  { id: "endpoints", href: "/dashboard/endpoint", i18nKey: "endpoints", icon: "api" },
  { id: "api-manager", href: "/dashboard/api-manager", i18nKey: "apiManager", icon: "vpn_key" },
  { id: "providers", href: "/dashboard/providers", i18nKey: "providers", icon: "dns" },
  { id: "combos", href: "/dashboard/combos", i18nKey: "combos", icon: "layers" },
  { id: "batch", href: "/dashboard/batch", i18nKey: "batch", icon: "view_list" },
  { id: "costs", href: "/dashboard/costs", i18nKey: "costs", icon: "account_balance_wallet" },
  { id: "analytics", href: "/dashboard/analytics", i18nKey: "analytics", icon: "analytics" },
  { id: "cache", href: "/dashboard/cache", i18nKey: "cache", icon: "cached" },
  { id: "limits", href: "/dashboard/limits", i18nKey: "limits", icon: "tune" },
  { id: "media", href: "/dashboard/cache/media", i18nKey: "media", icon: "perm_media" },
];

const CLI_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "cli-tools", href: "/dashboard/cli-tools", i18nKey: "cliToolsShort", icon: "terminal" },
  { id: "agents", href: "/dashboard/agents", i18nKey: "agents", icon: "smart_toy" },
  { id: "memory", href: "/dashboard/memory", i18nKey: "memory", icon: "psychology" },
  { id: "skills", href: "/dashboard/skills", i18nKey: "skills", icon: "auto_fix_high" },
];

const DEBUG_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "translator", href: "/dashboard/translator", i18nKey: "translator", icon: "translate" },
  { id: "playground", href: "/dashboard/playground", i18nKey: "playground", icon: "science" },
  {
    id: "search-tools",
    href: "/dashboard/search-tools",
    i18nKey: "searchTools",
    icon: "manage_search",
  },
];

const SYSTEM_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "logs", href: "/dashboard/logs", i18nKey: "logs", icon: "description" },
  { id: "audit", href: "/dashboard/audit", i18nKey: "auditLog", icon: "policy" },
  { id: "webhooks", href: "/dashboard/webhooks", i18nKey: "webhooks", icon: "webhook" },
  { id: "health", href: "/dashboard/health", i18nKey: "health", icon: "health_and_safety" },
  { id: "settings", href: "/dashboard/settings", i18nKey: "settings", icon: "settings" },
];

const HELP_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "docs", href: "/docs", i18nKey: "docs", icon: "menu_book", external: true },
  {
    id: "issues",
    href: "https://github.com/diegosouzapw/OmniRoute/issues",
    i18nKey: "issues",
    icon: "bug_report",
    external: true,
  },
  { id: "changelog", href: "/dashboard/changelog", i18nKey: "changelog", icon: "campaign" },
];

export const SIDEBAR_SECTIONS: readonly SidebarSectionDefinition[] = [
  {
    id: "primary",
    titleKey: "primarySection",
    titleFallback: "Main",
    items: PRIMARY_SIDEBAR_ITEMS,
    showTitleInSidebar: false,
  },
  {
    id: "cli",
    titleKey: "cliSection",
    titleFallback: "CLI",
    items: CLI_SIDEBAR_ITEMS,
  },
  {
    id: "debug",
    titleKey: "debugSection",
    titleFallback: "Debug",
    items: DEBUG_SIDEBAR_ITEMS,
    visibility: "debug",
  },
  {
    id: "system",
    titleKey: "systemSection",
    titleFallback: "System",
    items: SYSTEM_SIDEBAR_ITEMS,
  },
  {
    id: "help",
    titleKey: "helpSection",
    titleFallback: "Help",
    items: HELP_SIDEBAR_ITEMS,
  },
] as const;
>>>>>>> Stashed changes

export const HIDDEN_SIDEBAR_ITEMS_SETTING_KEY = "hiddenSidebarItems";
export const SIDEBAR_SETTINGS_UPDATED_EVENT = "omniroute:settings-updated";

<<<<<<< Updated upstream
const MINIMAL_SHOWN: ReadonlySet<HideableSidebarItemId> = new Set([
  "home",
  "endpoints",
  "api-manager",
  "providers",
  "combos",
  "analytics",
  "costs",
  "logs",
  "health",
  "settings-general",
  "settings-sidebar",
  "docs",
  "changelog",
]);

const DEVELOPER_SHOWN: ReadonlySet<HideableSidebarItemId> = new Set([
  "home",
  "endpoints",
  "api-manager",
  "providers",
  "combos",
  "quota",
  "context-caveman",
  "context-rtk",
  "context-combos",
  "cli-code",
  "cli-agents",
  "acp-agents",
  "api-endpoints",
  "analytics",
  "analytics-combo-health",
  "costs",
  "cache",
  "logs",
  "health",
  "runtime",
  "translator",
  "playground",
  "memory",
  "skills",
  "mcp",
  "a2a",
  "settings-general",
  "settings-routing",
  "settings-resilience",
  "settings-sidebar",
  "docs",
  "issues",
  "changelog",
]);

const ADMIN_SHOWN: ReadonlySet<HideableSidebarItemId> = new Set([
  "home",
  "endpoints",
  "api-manager",
  "providers",
  "combos",
  "quota",
  "analytics",
  "analytics-combo-health",
  "analytics-utilization",
  "costs",
  "costs-pricing",
  "costs-budget",
  "costs-quota-share",
  "cache",
  "logs",
  "activity",
  "health",
  "runtime",
  "audit",
  "audit-mcp",
  "audit-a2a",
  "settings-general",
  "settings-routing",
  "settings-resilience",
  "settings-security",
  "settings-access-tokens",
  "settings-feature-flags",
  "settings-sidebar",
  "docs",
  "changelog",
]);

function buildHiddenList(shown: ReadonlySet<HideableSidebarItemId>): HideableSidebarItemId[] {
  return HIDEABLE_SIDEBAR_ITEM_IDS.filter((id) => !shown.has(id));
}

export const SIDEBAR_PRESETS: readonly SidebarPresetDefinition[] = [
  { id: "all", icon: "select_all", hiddenItems: [] },
  { id: "minimal", icon: "minimize", hiddenItems: buildHiddenList(MINIMAL_SHOWN) },
  { id: "developer", icon: "code", hiddenItems: buildHiddenList(DEVELOPER_SHOWN) },
  { id: "admin", icon: "admin_panel_settings", hiddenItems: buildHiddenList(ADMIN_SHOWN) },
];

// ─── Ordering utilities ───────────────────────────────────────────────────────

export function applySectionOrder(
  sections: readonly SidebarSectionDefinition[],
  order: SidebarSectionId[]
): SidebarSectionDefinition[] {
  if (order.length === 0) return [...sections];
  const knownIds = new Set(sections.map((s) => s.id));
  const validOrder = order.filter((id) => knownIds.has(id));
  const orderMap = new Map(validOrder.map((id, i) => [id, i]));
  return [...sections].sort((a, b) => {
    const ai = orderMap.get(a.id) ?? validOrder.length + sections.indexOf(a);
    const bi = orderMap.get(b.id) ?? validOrder.length + sections.indexOf(b);
    return ai - bi;
  });
}

export function applyItemOrder(
  children: readonly SidebarSectionChild[],
  order: string[]
): SidebarSectionChild[] {
  if (order.length === 0) return [...children];
  const getChildId = (c: SidebarSectionChild): string =>
    "type" in c && c.type === "group" ? c.id : (c as SidebarItemDefinition).id;
  const knownIds = new Set(children.map(getChildId));
  const validOrder = order.filter((id) => knownIds.has(id));
  const orderMap = new Map(validOrder.map((id, i) => [id, i]));
  return [...children].sort((a, b) => {
    const aId = getChildId(a);
    const bId = getChildId(b);
    const ai = orderMap.get(aId) ?? validOrder.length + children.indexOf(a);
    const bi = orderMap.get(bId) ?? validOrder.length + children.indexOf(b);
    return ai - bi;
  });
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

=======
>>>>>>> Stashed changes
export function normalizeHiddenSidebarItems(value: unknown): HideableSidebarItemId[] {
  if (!Array.isArray(value)) return [];

  const hiddenItems = new Set<HideableSidebarItemId>();

  for (const item of value) {
    if (
      typeof item === "string" &&
      HIDEABLE_SIDEBAR_ITEM_IDS.includes(item as HideableSidebarItemId)
    ) {
      hiddenItems.add(item as HideableSidebarItemId);
    }
  }

  return HIDEABLE_SIDEBAR_ITEM_IDS.filter((item) => hiddenItems.has(item));
}
