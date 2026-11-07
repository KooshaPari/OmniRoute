import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock("next-intl", () => ({ useTranslations: () => Object.assign((key: string) => key, { has: () => false }) }));
vi.mock("@/shared/components/CloudSyncStatus", () => ({ default: () => null }));
vi.mock("@/shared/components/OmniRouteLogo", () => ({ default: () => null }));
vi.mock("@/shared/components/Modal", () => ({
  ConfirmModal: ({ isOpen, title, message, onConfirm }: any) => isOpen ? (
    <section role="dialog" aria-label={title}>{message}<button onClick={onConfirm}>confirm</button></section>
  ) : null,
}));

import Sidebar from "../../../src/shared/components/Sidebar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe.each(["shutdown", "restart"] as const)("sidebar %s", (action) => {
  for (const outcome of ["refused", "network", "accepted"] as const) {
    it(`${outcome} reports the correct state`, async () => {
      const originalTimeout = globalThis.setTimeout;
      const delayedReloads: number[] = [];
      vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
        if (ms === 3000) { delayedReloads.push(ms); return 0; }
        return originalTimeout(fn, ms, ...args);
      }) as typeof setTimeout);
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/settings") return Response.json({});
        expect(String(input)).toBe(`/api/${action}`);
        if (outcome === "network") throw new Error("offline");
        return Response.json(outcome === "refused" ? { error: "unavailable" } : { success: true }, { status: outcome === "refused" ? 503 : 200 });
      });
      vi.stubGlobal("fetch", fetchMock);
      render(<Sidebar />);
      fireEvent.click(screen.getByTitle(action));
      const modal = screen.getByRole("dialog", { name: action });
      fireEvent.click(within(modal).getByText("confirm"));
      if (outcome === "accepted") {
        await waitFor(() => expect(screen.getByText("serverDisconnected")).toBeTruthy());
        expect(screen.queryByRole("dialog", { name: action })).toBeNull();
        expect(delayedReloads.length).toBe(action === "restart" ? 1 : 0);
      } else {
        const alert = await within(modal).findByRole("alert");
        expect(alert.textContent).toContain(outcome === "refused" ? "unavailable" : "state is unknown");
        expect(screen.queryByText("serverDisconnected")).toBeNull();
        expect(delayedReloads).toEqual([]);
      }
      expect(fetchMock.mock.calls.filter(([url]) => String(url) === `/api/${action}`)).toHaveLength(1);
    });
  }
});
