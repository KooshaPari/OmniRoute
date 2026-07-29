import { describe, expect, it } from 'vitest';

import { legacyDashboardRoute } from '../../../src/lib/dashboard/route-aliases';

describe('dashboard route aliases', () => {
  it.each([
    ['/dashboard/costs', '/dashboard/cost'],
    ['/dashboard/settings/routing', '/dashboard/router'],
    ['/dashboard/analytics', '/dashboard/observability'],
    ['/dashboard/agent-skills', '/dashboard/skills'],
    ['/dashboard/settings/feature-flags', '/dashboard/flags'],
    ['/dashboard/settings/security', '/dashboard/security'],
  ])('preserves the existing Svelte feature for %s', (canonicalRoute, legacyRoute) => {
    expect(legacyDashboardRoute(canonicalRoute)).toBe(legacyRoute);
  });

  it('does not invent aliases for Next routes without an equivalent Svelte feature', () => {
    expect(legacyDashboardRoute('/dashboard/billing')).toBeNull();
    expect(legacyDashboardRoute('/dashboard/diagnostics')).toBeNull();
  });
});
