import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceRoot = path.resolve("journey-evidence/anonymous-home-smoke");
const forbiddenText = /(api[-_ ]?key|authorization|token|secret|cookie)\s*[:=]\s*\S+|bearer\s+\S+/i;

test.use({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
  colorScheme: "light",
});

test("captures anonymous v4 home journey evidence", async ({ page, context }) => {
  await mkdir(evidenceRoot, { recursive: true });

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/", { waitUntil: "networkidle" });

  const heading = page.locator("h1").first();
  await expect(heading).toContainText("Welcome to argismonitor v4");
  await expect(page.locator("body")).not.toContainText(forbiddenText);

  await page.locator("input[type='password'], [data-sensitive='true']").evaluateAll((nodes) => {
    for (const node of nodes) {
      node.setAttribute("value", "[REDACTED]");
      node.textContent = "[REDACTED]";
    }
  });

  const accessibility = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((element) => ({
      level: Number(element.tagName.slice(1)),
      text: element.textContent?.trim() ?? "",
    }));
    const hasHeadingSkip = headings.some((heading, index) =>
      index > 0 && heading.level > headings[index - 1].level + 1
    );
    return {
      title: document.title,
      language: document.documentElement.lang || null,
      headingCount: headings.length,
      hasHeadingSkip,
      landmarks: {
        main: document.querySelectorAll("main").length,
        navigation: document.querySelectorAll("nav").length,
      },
      imagesMissingAlt: document.querySelectorAll("img:not([alt])").length,
      unnamedButtons: Array.from(document.querySelectorAll("button")).filter(
        (button) => !(button.getAttribute("aria-label") || button.textContent?.trim())
      ).length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });

  expect(accessibility.title).not.toBe("");
  expect(accessibility.headingCount).toBeGreaterThan(0);
  expect(accessibility.hasHeadingSkip).toBe(false);
  expect(accessibility.landmarks.main).toBeGreaterThan(0);
  expect(accessibility.imagesMissingAlt).toBe(0);
  expect(accessibility.unnamedButtons).toBe(0);
  expect(accessibility.horizontalOverflow).toBe(false);
  expect(accessibility.reducedMotion).toBe(true);

  await writeFile(
    path.join(evidenceRoot, "accessibility-smoke.json"),
    JSON.stringify(accessibility, null, 2) + "\n",
    { mode: 0o600 }
  );
  await page.screenshot({
    path: path.join(evidenceRoot, "home.png"),
    fullPage: false,
    animations: "disabled",
  });
  await context.tracing.stop({ path: path.join(evidenceRoot, "trace.zip") });
});
