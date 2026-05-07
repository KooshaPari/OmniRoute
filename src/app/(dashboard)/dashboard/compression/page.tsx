"use client";

import CompressionSettingsTab from "@/app/(dashboard)/dashboard/settings/components/CompressionSettingsTab";

export default function CompressionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[28px]">compress</span>
          Compression
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Configure context compression settings to reduce token usage and costs.
        </p>
      </div>
      <CompressionSettingsTab />
    </div>
  );
}
