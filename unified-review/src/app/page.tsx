"use client";

import { useEffect, useState } from "react";

interface ToolQuota {
  tool: string;
  enabled: boolean;
  weight: number;
  quota: { used: number; remaining: number; limit: number; degraded: boolean; resetAt: string };
  queue_size: number;
}

interface HealthData {
  ok: boolean;
  timestamp: string;
  tools: ToolQuota[];
  config: { primary_surface: string; incremental_enabled: boolean };
}

const SEVERITY_COLORS: Record<string, string> = {
  P0: "#f85149",
  P1: "#d29922",
  P2: "#58a6ff",
  P3: "#8b949e",
};

export default function Dashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ borderBottom: "1px solid #30363d", paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>🔍 Unified Review</h1>
        <p style={{ margin: "8px 0 0", color: "#8b949e", fontSize: 14 }}>
          Single unified review surface across Copilot, CodeRabbit, Cursor, Forge, and KiloCode.
        </p>
      </header>

      {loading && <p style={{ color: "#8b949e" }}>Loading…</p>}
      {error && (
        <div style={{ padding: 12, background: "#3d1f1f", border: "1px solid #f85149", borderRadius: 6, color: "#ffa198" }}>
          Error: {error}
        </div>
      )}

      {data && (
        <>
          <section style={{ display: "flex", gap: 12, marginBottom: 24, fontSize: 13, color: "#8b949e" }}>
            <span>Primary surface: <strong style={{ color: "#c9d1d9" }}>{data.config.primary_surface}</strong></span>
            <span>•</span>
            <span>Incremental: <strong style={{ color: "#c9d1d9" }}>{data.config.incremental_enabled ? "on" : "off"}</strong></span>
            <span>•</span>
            <span>Last update: {new Date(data.timestamp).toLocaleTimeString()}</span>
          </section>

          <section>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Reviewer Quotas</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {data.tools.map((t) => {
                const pct = t.quota.limit > 0 ? (t.quota.used / t.quota.limit) * 100 : 0;
                const color = pct > 80 ? "#f85149" : pct > 50 ? "#d29922" : "#3fb950";
                return (
                  <div key={t.tool} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 16, opacity: t.enabled ? 1 : 0.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong style={{ fontSize: 14 }}>{t.tool}</strong>
                      <span style={{ fontSize: 11, color: "#8b949e", background: "#21262d", padding: "2px 6px", borderRadius: 4 }}>
                        weight: {t.weight}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>
                      {t.quota.used} / {t.quota.limit} used
                      {t.quota.degraded && <span style={{ color: "#f85149", marginLeft: 8 }}>• degraded</span>}
                    </div>
                    <div style={{ height: 6, background: "#21262d", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#8b949e" }}>
                      <span>queue: {t.queue_size}</span>
                      <span>resets: {new Date(t.quota.resetAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>How It Works</h2>
            <ol style={{ color: "#c9d1d9", lineHeight: 1.6, fontSize: 14 }}>
              <li>PR opened → <code style={{ background: "#21262d", padding: "1px 4px", borderRadius: 3 }}>reviewer:&lt;tool&gt;</code> label assigned (weighted random, biased by remaining quota)</li>
              <li>Sticky assignment: same tool reviews all incremental commits on the same PR</li>
              <li>All findings normalized to P0–P3 severity, deduplicated, then posted as a single Check Run</li>
              <li>Mandatory checks (CodeQL) always run in parallel and post as their own Check Run</li>
              <li>If selected tool is exhausted, reassign to next available and re-review</li>
            </ol>
          </section>

          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Severity Legend</h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
                <div key={sev} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, background: color, borderRadius: 2 }} />
                  <span style={{ fontSize: 13 }}>{sev}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
