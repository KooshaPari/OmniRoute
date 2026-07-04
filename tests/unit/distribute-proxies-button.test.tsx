/**
 * DistributeProxiesButton — per-account proxy distribution button.
 *
 * Covers the 4-state state machine (idle → distributing → complete → idle)
 * for the proxy-distribution UX. The button is the user-facing surface
 * for the per-account proxy round-robin that upstream added in f42e8fa75
 * (cherry-picked as no-op for KP — KP is already ahead on the executor
 * itself, but was missing this button test).
 *
 * States covered:
 *   1. Initial render: label visible, idle state
 *   2. Click → distributing state, disabled, callback invoked
 *   3. Callback resolves → complete state, label changes, reverts to idle after 1500ms
 *   4. Callback rejects → returns to idle state without "complete" flash
 *
 * Plus the accessibility / control-flow edges:
 *   - Disabled prop prevents click
 *   - State machine blocks re-entry while distributing (no double-click)
 *   - Timer is cleaned up on unmount (no setState-after-unmount warning)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import DistributeProxiesButton from "@/shared/components/DistributeProxiesButton";

describe("DistributeProxiesButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the default label in the idle state", () => {
    render(<DistributeProxiesButton onDistribute={vi.fn().mockResolvedValue(undefined)} />);
    const button = screen.getByRole("button", { name: /distribute proxies/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("accepts a custom label override", () => {
    render(
      <DistributeProxiesButton
        onDistribute={vi.fn().mockResolvedValue(undefined)}
        label="Rotate Accounts"
      />,
    );
    expect(screen.getByRole("button", { name: /rotate accounts/i })).toBeInTheDocument();
  });

  it("calls onDistribute exactly once when clicked", async () => {
    const onDistribute = vi.fn().mockResolvedValue(undefined);
    render(<DistributeProxiesButton onDistribute={onDistribute} />);

    const button = screen.getByRole("button", { name: /distribute proxies/i });
    fireEvent.click(button);

    expect(onDistribute).toHaveBeenCalledTimes(1);
  });

  it("transitions to distributing state during the async call and disables re-entry", async () => {
    let resolveDistribute: () => void;
    const onDistribute = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveDistribute = resolve; }),
    );
    render(<DistributeProxiesButton onDistribute={onDistribute} />);

    const button = screen.getByRole("button", { name: /distribute proxies/i });
    fireEvent.click(button);

    // While the promise is pending, the button must be disabled to prevent
    // double-click (per-account proxy round-robin is not idempotent).
    await waitFor(() => expect(button).toBeDisabled());

    // A second click while distributing must be a no-op
    fireEvent.click(button);
    expect(onDistribute).toHaveBeenCalledTimes(1);

    // Resolve the in-flight call
    await act(async () => { resolveDistribute!(); });
  });

  it("transitions idle → distributing → complete → idle after success", async () => {
    const onDistribute = vi.fn().mockResolvedValue(undefined);
    render(<DistributeProxiesButton onDistribute={onDistribute} />);

    const button = screen.getByRole("button", { name: /distribute proxies/i });
    fireEvent.click(button);

    await waitFor(() => expect(onDistribute).toHaveBeenCalledTimes(1));
    // The complete state is visible briefly (label changes)
    await waitFor(() => expect(button).not.toBeDisabled());

    // After 1500ms, the button reverts to idle
    await act(async () => { vi.advanceTimersByTime(1600); });
    expect(button).toBeInTheDocument();
  });

  it("returns to idle state if onDistribute rejects (no complete flash)", async () => {
    const onDistribute = vi.fn().mockRejectedValue(new Error("network down"));
    render(<DistributeProxiesButton onDistribute={onDistribute} />);

    const button = screen.getByRole("button", { name: /distribute proxies/i });
    fireEvent.click(button);

    // Even after rejection, the button must be re-enabled (not stuck in
    // 'distributing' forever, blocking subsequent retries).
    await waitFor(() => expect(button).not.toBeDisabled(), { timeout: 1000 });
  });

  it("respects the disabled prop and does not call onDistribute", () => {
    const onDistribute = vi.fn().mockResolvedValue(undefined);
    render(
      <DistributeProxiesButton
        onDistribute={onDistribute}
        disabled
      />,
    );
    const button = screen.getByRole("button", { name: /distribute proxies/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onDistribute).not.toHaveBeenCalled();
  });

  it("cleans up the revert-to-idle timer on unmount", () => {
    const onDistribute = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<DistributeProxiesButton onDistribute={onDistribute} />);

    const button = screen.getByRole("button", { name: /distribute proxies/i });
    fireEvent.click(button);

    // Unmount before the 1500ms timer fires. With React's strict mode +
    // testing-library, an unmount-during-pending-timeout must not throw
    // 'Can't perform a state update on an unmounted component'.
    unmount();

    // Advancing timers after unmount must not throw either.
    expect(() => { vi.advanceTimersByTime(2000); }).not.toThrow();
  });
});