import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const slug = "anonymous-landing-smoke";
const evidenceDir = path.resolve(process.env.JOURNEY_EVIDENCE_DIR ?? "journey-evidence", slug);

test("captures anonymous current-main landing journey evidence", async ({ context, page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) await route.continue();
    else await route.abort("blockedbyclient");
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/landing", { waitUntil: "networkidle" });

  await expect(page).toHaveTitle(/OmniRoute/i);
  await expect(page.locator("h1").first()).toBeVisible();

  const structure = await page.evaluate(() => {
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) =>
      Number(node.tagName.slice(1))
    );
    const headingOrder = headings.every(
      (level, index) => index === 0 || level <= headings[index - 1] + 1
    );
    return {
      title: document.title,
      headingOrder,
      landmarks: document.querySelectorAll(
        "main,nav,header,footer,[role='main'],[role='navigation'],[role='banner'],[role='contentinfo']"
      ).length,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });

  let focusVisible = false;
  let focusTarget = "";
  for (let attempt = 0; attempt < 20 && !focusVisible; attempt += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body)
        return { visible: false, target: "" };
      const style = getComputedStyle(element);
      const visible =
        (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== "none";
      return {
        visible,
        target: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`,
      };
    });
    focusVisible = focus.visible;
    focusTarget = focus.target;
  }

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const contrastViolations = axe.violations.filter(
    (violation) => violation.id === "color-contrast"
  );
  const nameViolations = axe.violations.filter((violation) =>
    /name|label|title/.test(violation.id)
  );
  const checks = {
    "document-title": { passed: structure.title.trim().length > 0 },
    "heading-order": { passed: structure.headingOrder },
    landmarks: { passed: structure.landmarks > 0, count: structure.landmarks },
    "focus-visible": { passed: focusVisible, target: focusTarget },
    "accessible-names": { passed: nameViolations.length === 0, violations: nameViolations },
    contrast: { passed: contrastViolations.length === 0, violations: contrastViolations },
    "no-horizontal-overflow": { passed: !structure.horizontalOverflow },
    "reduced-motion": { passed: structure.reducedMotion },
  };
  expect(Object.values(checks).every((result) => result.passed)).toBe(true);

  const report = JSON.stringify(
    {
      schemaVersion: 1,
      slug,
      url: "/landing",
      serverMode: process.env.OMNIROUTE_PLAYWRIGHT_SERVER_MODE ?? "start",
      viewport: { width: 1280, height: 800 },
      checks,
      axe: { violations: axe.violations, incomplete: axe.incomplete },
    },
    null,
    2
  );
  expect(report).not.toMatch(/(api[-_ ]?key|authorization|token|secret|cookie)\s*[:=]\s*\S+/i);
  expect(report).not.toMatch(/bearer\s+\S+/i);
  await writeFile(path.join(evidenceDir, "accessibility.json"), `${report}\n`);
  await page.screenshot({
    path: path.join(evidenceDir, "landing.png"),
    fullPage: true,
    animations: "disabled",
    mask: [page.locator("input[type='password']"), page.locator("[data-sensitive='true']")],
  });
  await context.tracing.stop({ path: path.join(evidenceDir, "trace.zip") });
});
