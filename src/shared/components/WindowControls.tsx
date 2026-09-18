"use client";

import { useTranslations } from "next-intl";
import { useWindowControls } from "@/shared/hooks/useTauri";

/**
 * Native window controls (minimize / maximize / close) for the Tauri desktop shell.
 *
 * Rendered only inside the Tauri webview — `useWindowControls().isDesktop` is false
 * everywhere else — so the plain web build keeps its existing header untouched.
 *
 * No macOS/Windows chrome variant: the shell keeps native window decorations, so the
 * platform already draws its own titlebar buttons and traffic lights. See
 * `tauri.conf.json` (`app.windows[0]` has no `decorations: false`).
 */
export default function WindowControls() {
  const t = useTranslations("header");
  const { isDesktop, minimize, toggleMaximize, close } = useWindowControls();

  if (!isDesktop) return null;

  const buttonClass =
    "flex items-center justify-center p-2 rounded-lg text-text-muted transition-colors hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5";

  return (
    <div
      role="group"
      aria-label={t("windowControls")}
      className="flex items-center gap-1 border-s border-black/10 ps-2 dark:border-white/10"
    >
      <button
        type="button"
        onClick={minimize}
        className={buttonClass}
        title={t("minimizeWindow")}
        aria-label={t("minimizeWindow")}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          remove
        </span>
      </button>
      <button
        type="button"
        onClick={toggleMaximize}
        className={buttonClass}
        title={t("maximizeWindow")}
        aria-label={t("maximizeWindow")}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          check_box_outline_blank
        </span>
      </button>
      <button
        type="button"
        onClick={close}
        className="flex items-center justify-center p-2 rounded-lg text-text-muted transition-colors hover:text-red-500 hover:bg-red-500/10"
        title={t("closeWindow")}
        aria-label={t("closeWindow")}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          close
        </span>
      </button>
    </div>
  );
}
