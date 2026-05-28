"use client";

import dynamic from "next/dynamic";
import type { InterceptedRequest } from "@/mitm/inspector/types";

interface StatsTabProps {
  requests: InterceptedRequest[];
}

// Recharts bundle is split via Next.js dynamic() — not included in the initial page chunk.
const StatsCharts = dynamic(() => import("./StatsCharts"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-muted-foreground">Loading charts…</div>,
});

export function StatsTab({ requests }: StatsTabProps) {
  if (requests.length === 0) {
    return (
      <div className="p-4 text-sm text-text-muted">
        No requests yet. Start a session recording to capture data for stats.
      </div>
    );
  }
  return <StatsCharts requests={requests} />;
}
