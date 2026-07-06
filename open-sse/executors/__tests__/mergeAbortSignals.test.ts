import { describe, expect, it } from "vitest";

import { mergeAbortSignals } from "../mergeAbortSignals";

describe("mergeAbortSignals", () => {
  it("returns undefined when no signals are provided", () => {
    expect(mergeAbortSignals(undefined, undefined)).toBeUndefined();
  });

  it("returns the provided signal when only one signal exists", () => {
    const controller = new AbortController();

    expect(mergeAbortSignals(controller.signal, undefined)).toBe(controller.signal);
    expect(mergeAbortSignals(undefined, controller.signal)).toBe(controller.signal);
  });

  it("returns the aborted signal directly when one signal is already aborted", () => {
    const aborted = new AbortController();
    aborted.abort(new Error("pre-aborted"));
    const fresh = new AbortController();

    const merged = mergeAbortSignals(aborted.signal, fresh.signal);

    expect(merged).toBe(aborted.signal);
    expect(merged?.aborted).toBe(true);
    expect(merged?.reason).toBeInstanceOf(Error);
  });

  it("returns undefined for two fresh signals", () => {
    const first = new AbortController();
    const second = new AbortController();

    expect(mergeAbortSignals(first.signal, second.signal)).toBeUndefined();
  });
});
