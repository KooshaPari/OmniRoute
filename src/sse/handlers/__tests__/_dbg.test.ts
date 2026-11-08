import { describe, expect, it, beforeEach, vi } from "vitest";
const mockState = vi.hoisted(() => ({ combos: [{ id: "default-combo" }] as unknown[], calls: 0, version: 0 }));
vi.mock("@/lib/localDb", () => ({
  getCombos: vi.fn(async () => { mockState.calls += 1; return mockState.combos; }),
  getCombosCacheVersion: vi.fn(() => mockState.version),
}));
import { getCombosCachedForChat, __resetCombosCacheForTests, __getCombosCacheStateForTests } from "../chatCombosCache";
import { getCombosCacheVersion } from "@/lib/localDb";

describe("dbg", () => {
  beforeEach(() => { __resetCombosCacheForTests(); mockState.calls = 0; mockState.version = 0; mockState.combos = [{ id: "default-combo" }]; });
  it("plain call increments", async () => {
    const pre = __getCombosCacheStateForTests();
    console.log("PRE", JSON.stringify(pre), "ver", getCombosCacheVersion(), "calls", mockState.calls);
    const v = await getCombosCachedForChat();
    console.log("POST calls", mockState.calls, "val", JSON.stringify(v), "state", JSON.stringify(__getCombosCacheStateForTests()));
    expect(mockState.calls).toBe(1);
  });
});
