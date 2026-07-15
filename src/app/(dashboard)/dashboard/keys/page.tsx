"use client";

/**
 * Dashboard: Virtual Keys (B5 of v8.1 Bifrost track, ADR-031)
 *
 * Operator-facing page for:
 *   - minting new per-tenant virtual keys (rawKey shown ONCE on create)
 *   - listing all keys for a tenant (active + revoked)
 *   - revoking keys
 *   - per-key cost summary (chart placeholder — data is attached so a
 *     follow-up PR can render without re-fetching)
 *
 * The raw key is shown exactly once (on mint) and never again — the server
 * stores only the sha256 hash. Operators are expected to copy the raw key
 * immediately and store it in their own secret manager.
 */

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input } from "@/shared/components";

interface VirtualKey {
  id: string;
  tenantId: string;
  keyPrefix: string;
  label: string;
  allowedModels: string[] | null;
  maxCostUsd: number | null;
  maxRpd: number | null;
  currentCostUsd: number;
  currentRpd: number;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface CostSummary {
  sinceIso: string;
  untilIso: string;
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  eventCount: number;
  byProvider: Array<{ key: string; costUsd: number; eventCount: number }>;
  byModel: Array<{ key: string; costUsd: number; eventCount: number }>;
  byDay: Array<{ day: string; costUsd: number; eventCount: number }>;
}

interface MintResponse {
  key: VirtualKey;
  rawKey: string;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusOf(k: VirtualKey): { label: string; tone: "ok" | "warn" | "off" } {
  if (k.revokedAt) return { label: "revoked", tone: "off" };
  if (k.expiresAt && new Date(k.expiresAt) < new Date()) return { label: "expired", tone: "off" };
  if (k.maxCostUsd !== null && k.currentCostUsd >= k.maxCostUsd) {
    return { label: "over budget", tone: "warn" };
  }
  if (k.maxRpd !== null && k.currentRpd >= k.maxRpd) {
    return { label: "over RPD", tone: "warn" };
  }
  return { label: "active", tone: "ok" };
}

export default function VirtualKeysPage() {
  const [tenantId, setTenantId] = useState("tenant_default");
  const [keys, setKeys] = useState<VirtualKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintedRawKey, setMintedRawKey] = useState<string | null>(null);
  const [mintedMeta, setMintedMeta] = useState<VirtualKey | null>(null);

  // mint form
  const [label, setLabel] = useState("");
  const [maxCostUsd, setMaxCostUsd] = useState<string>("");
  const [maxRpd, setMaxRpd] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [minting, setMinting] = useState(false);

  // cost chart
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/virtual-keys", window.location.origin);
      url.searchParams.set("tenantId", tenantId);
      const res = await fetch(url.toString());
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { keys: VirtualKey[] };
      setKeys(j.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleMint = useCallback(async () => {
    setMinting(true);
    setError(null);
    setMintedRawKey(null);
    setMintedMeta(null);
    try {
      const body: Record<string, unknown> = { tenantId, label };
      if (maxCostUsd.trim().length > 0) body.maxCostUsd = Number(maxCostUsd);
      if (maxRpd.trim().length > 0) body.maxRpd = Number(maxRpd);
      if (expiresAt.trim().length > 0) body.expiresAt = new Date(expiresAt).toISOString();
      const res = await fetch("/api/virtual-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as MintResponse;
      setMintedRawKey(j.rawKey);
      setMintedMeta(j.key);
      setLabel("");
      setMaxCostUsd("");
      setMaxRpd("");
      setExpiresAt("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMinting(false);
    }
  }, [tenantId, label, maxCostUsd, maxRpd, expiresAt, refresh]);

  const handleRevoke = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/virtual-keys/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh],
  );

  const loadCost = useCallback(async (id: string) => {
    setSelectedKeyId(id);
    setCostSummary(null);
    try {
      const res = await fetch(`/api/virtual-keys/${encodeURIComponent(id)}/cost`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setCostSummary((await res.json()) as CostSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Virtual Keys</h1>
        <p className="text-sm text-gray-500">
          Per-tenant scoped credentials. The raw key is shown once on creation and never again.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {mintedRawKey && mintedMeta && (
        <Card title="Key minted — copy the raw key now">
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <span className="text-gray-500">Key ID:</span>{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5">{mintedMeta.id}</code>
            </div>
            <div>
              <span className="text-gray-500">Tenant:</span>{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5">{mintedMeta.tenantId}</code>
            </div>
            <div>
              <span className="text-gray-500">Raw key (shown once):</span>
              <div className="mt-1 flex items-center gap-2">
                <code className="block w-full select-all break-all rounded bg-yellow-50 px-2 py-1 font-mono text-xs">
                  {mintedRawKey}
                </code>
                <Button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(mintedRawKey);
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Store this in your secret manager. The server only retains the sha256 hash.
            </p>
          </div>
        </Card>
      )}

      <Card title="Mint a key">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>Tenant ID</span>
            <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Label (optional)</span>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Max cost (USD, optional)</span>
              <Input
                value={maxCostUsd}
                onChange={(e) => setMaxCostUsd(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Max requests / day (optional)</span>
              <Input
                value={maxRpd}
                onChange={(e) => setMaxRpd(e.target.value)}
                inputMode="numeric"
                placeholder="e.g. 1000"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span>Expires at (optional)</span>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <Button type="button" onClick={handleMint} disabled={minting || !tenantId}>
            {minting ? "Minting…" : "Mint key"}
          </Button>
        </div>
      </Card>

      <Card title={`Keys for tenant: ${tenantId}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-500">
            {loading ? "Loading…" : `${keys.length} key(s)`}
          </span>
          <Button type="button" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-2">Prefix</th>
                <th className="py-1 pr-2">Label</th>
                <th className="py-1 pr-2">Caps</th>
                <th className="py-1 pr-2">Usage</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Created</th>
                <th className="py-1 pr-2">Last used</th>
                <th className="py-1 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const status = statusOf(k);
                const caps: string[] = [];
                if (k.maxCostUsd !== null) caps.push(`$${k.maxCostUsd}`);
                if (k.maxRpd !== null) caps.push(`${k.maxRpd}/day`);
                if (k.allowedModels) caps.push(`${k.allowedModels.length} model(s)`);
                if (k.expiresAt) caps.push(`exp ${formatDate(k.expiresAt)}`);
                return (
                  <tr key={k.id} className="border-b">
                    <td className="py-1 pr-2 font-mono text-xs">{k.keyPrefix}…</td>
                    <td className="py-1 pr-2">{k.label || "—"}</td>
                    <td className="py-1 pr-2 text-xs text-gray-600">{caps.join(" · ") || "none"}</td>
                    <td className="py-1 pr-2 text-xs">
                      {formatUsd(k.currentCostUsd)} / {k.currentRpd} req
                    </td>
                    <td className="py-1 pr-2">
                      <span
                        className={
                          status.tone === "ok"
                            ? "text-green-700"
                            : status.tone === "warn"
                              ? "text-yellow-700"
                              : "text-gray-500 line-through"
                        }
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-xs">{formatDate(k.createdAt)}</td>
                    <td className="py-1 pr-2 text-xs">{formatDate(k.lastUsedAt)}</td>
                    <td className="py-1 pr-2">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          onClick={() => loadCost(k.id)}
                          disabled={!!k.revokedAt}
                        >
                          Cost
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleRevoke(k.id)}
                          disabled={!!k.revokedAt}
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && keys.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-3 text-center text-sm text-gray-500">
                    No keys yet — mint one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedKeyId && (
        <Card title={`Cost summary — ${selectedKeyId}`}>
          {costSummary ? (
            <div className="flex flex-col gap-3" data-cost-chart-placeholder>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  <div className="text-gray-500">Total cost</div>
                  <div className="font-mono">{formatUsd(costSummary.totalCostUsd)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Events</div>
                  <div className="font-mono">{costSummary.eventCount}</div>
                </div>
                <div>
                  <div className="text-gray-500">Prompt tokens</div>
                  <div className="font-mono">{costSummary.totalPromptTokens}</div>
                </div>
                <div>
                  <div className="text-gray-500">Completion tokens</div>
                  <div className="font-mono">{costSummary.totalCompletionTokens}</div>
                </div>
              </div>
              {/* Cost chart placeholder — no chart library dep per B5 constraint.
                  Follow-up PR can render the byDay series. */}
              <div
                className="rounded border border-dashed border-gray-300 p-3 text-xs text-gray-500"
                data-cost-by-day={JSON.stringify(costSummary.byDay)}
              >
                Cost chart placeholder — <code>byDay</code> series attached as
                <code> data-cost-by-day</code> for a follow-up chart-library PR.
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium">By provider</div>
                  <ul className="text-xs">
                    {costSummary.byProvider.map((b) => (
                      <li key={b.key} className="flex justify-between border-b py-0.5">
                        <span>{b.key || "—"}</span>
                        <span className="font-mono">{formatUsd(b.costUsd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium">By model</div>
                  <ul className="text-xs">
                    {costSummary.byModel.map((b) => (
                      <li key={b.key} className="flex justify-between border-b py-0.5">
                        <span>{b.key || "—"}</span>
                        <span className="font-mono">{formatUsd(b.costUsd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading…</div>
          )}
        </Card>
      )}
    </div>
  );
}
