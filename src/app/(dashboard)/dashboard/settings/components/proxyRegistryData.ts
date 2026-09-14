import { z } from "zod";
import type { HealthInfo, UsageInfo } from "./proxyRegistryConstants";

type SetState<T> = (value: T | ((previous: T) => T)) => void;
type Assignment = { scope: string; scopeId: string | null };

function uniqueAssignments(assignments: Assignment[]) {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    const key = `${assignment.scope}:${assignment.scopeId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function loadProxyHealth(setHealthById: SetState<Record<string, HealthInfo>>) {
  try {
    const response = await fetch("/api/settings/proxies/health?hours=24");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const entries = Array.isArray(data?.items) ? data.items : [];
    setHealthById(Object.fromEntries(entries.map((entry: HealthInfo) => [entry.proxyId, entry])));
  } catch {
    // Ignore health-loading errors in the UI.
  }
}

export async function loadAllProxyUsage(
  proxyIds: string[],
  setUsageById: SetState<Record<string, UsageInfo>>
) {
  if (!proxyIds.length) return;
  try {
    const results = await Promise.all(
      proxyIds.map((id) =>
        fetch(`/api/settings/proxies/assignments?proxyId=${encodeURIComponent(id)}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            const assignments = uniqueAssignments(
              Array.isArray(data?.items) ? data.items : []
            );
            return [id, { count: assignments.length, assignments }] as [string, UsageInfo];
          })
          .catch(() => [id, { count: 0, assignments: [] }] as [string, UsageInfo])
      )
    );
    setUsageById(Object.fromEntries(results));
  } catch {
    // Ignore usage-loading errors in the UI.
  }
}

export const repairRelayResponseSchema = z.object({
  repaired: z.boolean().optional(),
  mode: z.enum(["noop", "recovered", "redeploy"]).optional(),
  error: z.object({ message: z.string() }).optional(),
});

export async function loadProxyUsage(
  proxyId: string,
  setUsageById: SetState<Record<string, UsageInfo>>
) {
  try {
    const response = await fetch(
      `/api/settings/proxies/assignments?proxyId=${encodeURIComponent(proxyId)}`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const assignments = uniqueAssignments(Array.isArray(data?.items) ? data.items : []);
    setUsageById((previous) => ({
      ...previous,
      [proxyId]: { count: assignments.length, assignments },
    }));
  } catch {
    // Ignore usage-loading errors in the UI.
  }
}
