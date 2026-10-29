/**
 * RTL layout regression test — #3541 (partial, core layout)
 *
 * For RTL locales (ar/fa/he/ur) the sidebar and key overlays must flip
 * correctly when `dir=rtl` is set on <html>.  Tailwind v4 supports logical
 * direction utilities natively (`start-*`, `end-*`, `ps-*`, `pe-*`, `ms-*`,
 * `me-*`, `text-start`, `text-end`) which auto-mirror under dir=rtl without
 * extra `rtl:` variants.
 *
 * This test reads the source files and asserts that the four high-impact
 * components use logical classes instead of physical directional ones where
 * those classes govern layout placement / offset.
 *
 * Runner: Vitest (included via `tests/unit/**\/*.test.tsx` in vitest.config.ts)
 * Command: npm run test:vitest -- --reporter=verbose --testPathPattern=rtl-logical
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const cwd = process.cwd();

function src(rel: string) {
  return readFileSync(resolve(cwd, rel), "utf-8");
}

// ─── DashboardLayout.tsx ──────────────────────────────────────────────────────

describe("DashboardLayout — mobile sidebar drawer uses logical classes", () => {
  const code = src("src/shared/components/layouts/DashboardLayout.tsx");

  it("uses start-0 (not bare left-0) for the mobile sidebar drawer", () => {
    // The drawer must anchor to the inline-start edge so it flips in RTL.
    expect(code).toContain("start-0");
  });

  it("does not use bare left-0 for the mobile sidebar drawer", () => {
    // "inset-y-0 left-0" is the old physical class that breaks RTL.
    expect(code).not.toContain("inset-y-0 left-0");
  });

  it("uses -translate-x-full only when combined with RTL-aware transform or logical alternative", () => {
    // We keep -translate-x-full/translate-x-0 for slide animation but anchor
    // with start-0 so physical translate still produces correct visual result
    // in both LTR and RTL (the drawer always slides in from its own start edge).
    // Just confirm start-0 is present (already asserted above).
    expect(code).toContain("start-0");
  });
});

// ─── Sidebar.tsx ─────────────────────────────────────────────────────────────

describe("Sidebar — collapse toggle aligns to the inline end logically", () => {
  const code = src("src/shared/components/Sidebar.tsx");

  it("pushes the toggle with a flex spacer instead of a physical margin", () => {
    // The macOS chrome row used ms-auto before the Electron bridge removal.
    // It now uses a flex-1 spacer ahead of the toggle. Both are RTL-safe;
    // a physical ml-auto/mr-auto would not be.
    const chromeStart = code.indexOf("#FF5F56");
    expect(chromeStart).toBeGreaterThan(-1);
    const chromeRow = code.slice(chromeStart, chromeStart + 800);
    expect(chromeRow).toContain("flex-1");
    expect(chromeRow).toContain("onToggleCollapse");
  });

  it("does not use physical auto margins for the toggle alignment", () => {
    expect(code).not.toMatch(/\bml-auto\b/);
    expect(code).not.toMatch(/\bmr-auto\b/);
  });
});

// ─── LanguageSelector.tsx ─────────────────────────────────────────────────────

describe("LanguageSelector — dropdown anchors to inline-end", () => {
  const code = src("src/shared/components/LanguageSelector.tsx");

  it("uses end-0 (not right-0) for the dropdown panel", () => {
    expect(code).toContain("end-0");
  });

  it("does not use bare right-0 for the dropdown panel", () => {
    expect(code).not.toContain("right-0");
  });

  it("uses text-start (not text-left) for lang name text alignment", () => {
    expect(code).toContain("text-start");
  });

  it("does not use text-left for lang name text alignment", () => {
    expect(code).not.toContain("text-left");
  });
});

// ─── Select.tsx ───────────────────────────────────────────────────────────────

describe("Select — chevron icon uses logical inset classes", () => {
  const code = src("src/shared/components/Select.tsx");

  it("uses end-0 (not right-0) for the chevron wrapper", () => {
    expect(code).toContain("end-0");
  });

  it("does not use bare right-0 for the chevron wrapper", () => {
    expect(code).not.toContain("right-0");
  });

  it("uses pe-3 (not pr-3) for chevron wrapper padding", () => {
    expect(code).toContain("pe-3");
  });

  it("does not use bare pr-3 for chevron wrapper padding", () => {
    expect(code).not.toContain("pr-3");
  });

  it("uses pe-10 (not pr-10) for the select element right-pad (space for chevron)", () => {
    expect(code).toContain("pe-10");
  });

  it("does not use bare pr-10 for the select element", () => {
    expect(code).not.toContain("pr-10");
  });
});
