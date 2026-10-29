import { describe, it, expect } from "vitest";
import { formatCost, truncateUrl, safePercentage } from "./formatting";

describe("formatCost", () => {
  it("formats sub-cent values with 6 decimals", () => {
    expect(formatCost(0.000_001)).toBe("$0.000001");
  });

  it("formats cent-range values with 4 decimals", () => {
    expect(formatCost(0.05)).toBe("$0.0500");
  });

  it("formats dollar-range values with 2 decimals", () => {
    expect(formatCost(12.345)).toBe("$12.35");
  });

  it("renders a zero amount for null/undefined/NaN", () => {
    expect(formatCost(null)).toBe("$0.00");
    expect(formatCost(undefined)).toBe("$0.00");
    expect(formatCost(NaN)).toBe("$0.00");
  });
});

describe("truncateUrl", () => {
  it("returns dash for empty input", () => {
    expect(truncateUrl(null)).toBe("-");
    expect(truncateUrl(undefined)).toBe("-");
  });

  it("truncates long URLs to hostname + pathname", () => {
    expect(truncateUrl("https://example.com/very/long/path/that/exceeds", 20)).toBe(
      "example.com/very/lon…"
    );
  });

  it("returns full display URL when under max", () => {
    expect(truncateUrl("https://example.com/short", 50)).toBe("example.com/short");
  });

  it("falls back to raw URL truncation on parse failure", () => {
    expect(truncateUrl("not-a-url-at-all-just-a-very-long-string-that-needs-truncation", 20)).toBe(
      "not-a-url-at-all-jus…"
    );
  });
});

describe("safePercentage", () => {
  it("returns the number for finite values", () => {
    expect(safePercentage(42)).toBe(42);
    expect(safePercentage(0)).toBe(0);
  });

  it("returns undefined for non-numbers and non-finite values", () => {
    expect(safePercentage("42")).toBeUndefined();
    expect(safePercentage(NaN)).toBeUndefined();
    expect(safePercentage(Infinity)).toBeUndefined();
    expect(safePercentage(null)).toBeUndefined();
    expect(safePercentage(undefined)).toBeUndefined();
  });
});
