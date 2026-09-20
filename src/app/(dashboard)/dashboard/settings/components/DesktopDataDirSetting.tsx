"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components";
import { useDataDir } from "@/shared/hooks/useTauri";
import { copyToClipboard } from "@/shared/utils/clipboard";

/**
 * Desktop-only settings row: where OmniRoute keeps its local data (database,
 * backups, logs) on this machine, with a copy affordance for support requests.
 *
 * Renders nothing on the plain web build (`useDataDir().isDesktop` is false).
 *
 * No "reveal in Finder" action: that requires a Tauri opener/shell command with a
 * filesystem scope, and the desktop capability set is `core:default` only — the
 * `open_external` command in the command contract takes a URL, not a path.
 */
export default function DesktopDataDirSetting() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { isDesktop, dataDir, loading, error } = useDataDir();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (!dataDir) return;
    setCopied(await copyToClipboard(dataDir));
  }, [dataDir]);

  if (!isDesktop) return null;

  const placeholder = loading ? tc("loading") : tc("notAvailable");

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-border">
      <div>
        <p className="font-medium">{t("dataDirectory")}</p>
        <p className="text-xs text-text-muted mt-0.5">{t("dataDirectoryDesc")}</p>
      </div>
      <div className="flex items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-lg border border-border bg-bg-subtle px-3 py-2 font-mono text-xs"
          title={dataDir ?? ""}
        >
          {dataDir || placeholder}
        </code>
        <Button size="sm" variant="secondary" onClick={handleCopy} disabled={!dataDir}>
          {copied ? tc("copied") : tc("copy")}
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{t("dataDirectoryUnavailable", { error })}</p>}
    </div>
  );
}
