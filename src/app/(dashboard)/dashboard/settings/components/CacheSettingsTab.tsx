"use client";

import { useState, useEffect } from "react";
import { Card, Button } from "@/shared/components";
import { useTranslations } from "next-intl";

interface CacheConfig {
  semanticCacheEnabled: boolean;
  semanticCacheMaxSize: number;
  semanticCacheTTL: number;
  promptCacheEnabled: boolean;
  promptCacheStrategy: "auto" | "system-only" | "manual";
  alwaysPreserveClientCache: "auto" | "always" | "never";
}

export default function CacheSettingsTab() {
  const t = useTranslations("settings");
  const [config, setConfig] = useState<CacheConfig>({
    semanticCacheEnabled: true,
    semanticCacheMaxSize: 100,
    semanticCacheTTL: 1800000,
    promptCacheEnabled: true,
    promptCacheStrategy: "auto",
    alwaysPreserveClientCache: "auto",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/cache-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings/cache-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-text-muted">{t("loading")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-main flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[20px]">cached</span>
        {t("cacheSettings")}
      </h3>

      <div className="space-y-6">
        {/* Semantic Cache */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-text-main">{t("semanticCache")}</h4>

          <label className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{t("enabled")}</span>
            <button
              onClick={() =>
                setConfig((c) => ({ ...c, semanticCacheEnabled: !c.semanticCacheEnabled }))
              }
              className={`relative w-10 h-5 rounded-full transition-colors ${
                config.semanticCacheEnabled ? "bg-green-500" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.semanticCacheEnabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{t("maxEntries")}</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={config.semanticCacheMaxSize}
              onChange={(e) =>
                setConfig((c) => ({ ...c, semanticCacheMaxSize: parseInt(e.target.value) || 100 }))
              }
              className="w-24 px-2 py-1 text-sm rounded border border-border bg-surface text-text-main"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{t("ttlMinutes")}</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={Math.round(config.semanticCacheTTL / 60000)}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  semanticCacheTTL: (parseInt(e.target.value) || 30) * 60000,
                }))
              }
              className="w-24 px-2 py-1 text-sm rounded border border-border bg-surface text-text-main"
            />
          </label>
        </div>

        {/* Prompt Cache */}
        <div className="space-y-3 pt-4 border-t border-border/30">
          <h4 className="text-sm font-medium text-text-main">{t("promptCache")}</h4>

          <label className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{t("enabled")}</span>
            <button
              onClick={() =>
                setConfig((c) => ({ ...c, promptCacheEnabled: !c.promptCacheEnabled }))
              }
              className={`relative w-10 h-5 rounded-full transition-colors ${
                config.promptCacheEnabled ? "bg-green-500" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.promptCacheEnabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{t("strategy")}</span>
            <select
              value={config.promptCacheStrategy}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  promptCacheStrategy: e.target.value as CacheConfig["promptCacheStrategy"],
                }))
              }
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text-main"
            >
              <option value="auto">Auto</option>
              <option value="system-only">System Only</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-text-muted">{t("preserveClientCache")}</span>
            <select
              value={config.alwaysPreserveClientCache}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  alwaysPreserveClientCache: e.target
                    .value as CacheConfig["alwaysPreserveClientCache"],
                }))
              }
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text-main"
            >
              <option value="auto">Auto</option>
              <option value="always">Always</option>
              <option value="never">Never</option>
            </select>
          </label>
        </div>

        {/* Save */}
        <div className="pt-4 border-t border-border/30">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
