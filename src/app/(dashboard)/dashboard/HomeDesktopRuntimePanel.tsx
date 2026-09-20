"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@/shared/components";
import { useOpenExternal, useRuntime, type RuntimeState } from "@/shared/hooks/useTauri";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { cn } from "@/shared/utils/cn";

const STATE_BADGE: Record<RuntimeState, string> = {
  running: "bg-green-500",
  starting: "bg-amber-500 animate-pulse",
  stopped: "bg-text-muted/50",
};

/**
 * Desktop-only runtime panel: live state of the local OmniRoute server plus
 * start/stop controls.
 *
 * Renders nothing on the plain web build (`useRuntime().isDesktop` is false).
 * There is deliberately NO update UI here: the Tauri updater requires signing keys
 * that this repository does not configure (`tauri.conf.json` sets
 * `bundle.createUpdaterArtifacts: false`), so an "update" button could not work.
 * The existing HTTP update flow in `HomePageClient` remains the only update path.
 */
export default function HomeDesktopRuntimePanel() {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const { isDesktop, status, error, pending, refresh, start, stop } = useRuntime();
  const { openExternal } = useOpenExternal();
  const [copied, setCopied] = useState(false);
  const detail = status?.detail ?? null;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const serverUrl = status?.origin ?? "";

  const handleCopy = useCallback(async () => {
    if (!serverUrl) return;
    setCopied(await copyToClipboard(serverUrl));
  }, [serverUrl]);

  const handleOpen = useCallback(() => {
    if (!serverUrl) return;
    void openExternal(serverUrl);
  }, [openExternal, serverUrl]);

  if (!isDesktop) return null;

  const state = status?.state ?? null;
  const busy = pending !== "idle";
  const stateLabel =
    state === "running"
      ? t("desktopStateRunning")
      : state === "starting"
        ? t("desktopStateStarting")
        : t("desktopStateStopped");

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center justify-center size-9 shrink-0 rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                desktop_windows
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{t("desktopPanelTitle")}</h2>
              <p className="text-sm text-text-muted">{t("desktopPanelSubtitle")}</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={busy}>
            {tc("refresh")}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-bg-subtle p-4">
            <p className="text-xs text-text-muted">{t("desktopServerState")}</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn("size-2 shrink-0 rounded-full", STATE_BADGE[state ?? "stopped"])}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold">{stateLabel}</span>
            </div>
            {detail && !error && (
              <p className="mt-2 text-xs text-text-muted">{t("desktopStateDetail", { detail })}</p>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-500">
                {t("desktopStatusUnavailable", { error })}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-bg-subtle p-4">
            <p className="text-xs text-text-muted">{t("desktopServerOrigin")}</p>
            <p className="mt-1 truncate font-mono text-sm" title={serverUrl}>
              {serverUrl || tc("notAvailable")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={handleCopy} disabled={!serverUrl}>
                {copied ? tc("copied") : tc("copy")}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleOpen} disabled={!serverUrl}>
                {t("desktopOpenOrigin")}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => void start()}
            disabled={busy || state === "running" || state === "starting"}
          >
            {t("desktopStartServer")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void stop()}
            disabled={busy || state === "stopped"}
          >
            {t("desktopStopServer")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
