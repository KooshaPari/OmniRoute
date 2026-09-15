// #6164: the always-on Auto-Routing (combo) banner was removed from the home page —
// it did not reflect live routing state and reappeared on every fresh browser.
// This guard replaces the deleted AutoRoutingBanner.test.tsx: the component was
// deleted along with its usage, so the contract to protect is its ABSENCE.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname ?? ".", "..", "..");

describe("AutoRoutingBanner removal (#6164)", () => {
  it("home page does not render the removed AutoRoutingBanner", () => {
    const homePage = fs.readFileSync(path.join(ROOT, "src/app/(dashboard)/home/page.tsx"), "utf8");
    expect(homePage).not.toContain("AutoRoutingBanner");
  });

  it("AutoRoutingBanner component stays deleted", () => {
    expect(fs.existsSync(path.join(ROOT, "src/shared/components/AutoRoutingBanner.tsx"))).toBe(
      false
    );
  });
});
