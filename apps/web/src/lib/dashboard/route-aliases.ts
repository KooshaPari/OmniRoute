const legacyRouteByCanonicalRoute: Readonly<Record<string, string>> = {
  '/dashboard/costs': '/dashboard/cost',
  '/dashboard/settings/routing': '/dashboard/router',
  '/dashboard/analytics': '/dashboard/observability',
  '/dashboard/agent-skills': '/dashboard/skills',
  '/dashboard/settings/feature-flags': '/dashboard/flags',
  '/dashboard/settings/security': '/dashboard/security',
};

export function legacyDashboardRoute(canonicalRoute: string): string | null {
  return legacyRouteByCanonicalRoute[canonicalRoute] ?? null;
}
