"use client";
export const LANE_ENGINES = ["session-dedup", "ccr", "lite", "rtk", "ionizer", "headroom", "caveman", "aggressive", "ultra"] as const;
export interface PlaygroundInputProps { text: string; onText: (t: string) => void; active: string[]; onToggleActive: (engine: string) => void; onRun: () => void; loading: boolean; fidelityGate: boolean; onToggleFidelity: () => void; fuzzyDedup: boolean; onToggleFuzzy: () => void; riskGate: boolean; onToggleRisk: () => void; quantumLock: boolean; onToggleQuantum: () => void; heatmap: "ultra" | "universal" | false; onToggleHeatmap: () => void; }
export function PlaygroundInput({ text, onText, active, onToggleActive, onRun, loading, fidelityGate, onToggleFidelity, fuzzyDedup, onToggleFuzzy, riskGate, onToggleRisk, quantumLock, onToggleQuantum, heatmap, onToggleHeatmap }: PlaygroundInputProps) {
  return (
    <div>
      <div className="text-[10px] uppercase opacity-60">{t("activeCombined")}</div>
      {LANE_ENGINES.map((engine) => (
        <label key={engine} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active.includes(engine)}
            onChange={() => onToggleActive(engine)}
          />
          {engine}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm opacity-50">
        <input type="checkbox" disabled /> llmlingua{" "}
        <span className="text-[10px]">({t("requiresOnnx")})</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" data-testid="fuzzy-toggle" checked={fuzzyDedup} onChange={onToggleFuzzy} />
        Fuzzy dedup (near-duplicate → CCR)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" data-testid="risk-toggle" checked={riskGate} onChange={onToggleRisk} />
        Proteger conteúdo sensível (risk-gate)
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" data-testid="quantum-toggle" checked={quantumLock} onChange={onToggleQuantum} />
        QuantumLock (stabilize cache prefix)
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" data-testid="heatmap-toggle" checked={Boolean(heatmap)} onChange={onToggleHeatmap} />
        Saliency heatmap {heatmap ? `(${heatmap})` : ""}
      </label>
      <button data-testid="play-run" className="rounded bg-blue-500/30 py-2 font-semibold" onClick={onRun} disabled={loading}>{loading ? "Rodando..." : "▶ Run"}</button>
    </div>
  );
}
