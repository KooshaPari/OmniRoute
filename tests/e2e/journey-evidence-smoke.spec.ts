import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceRoot = path.resolve("journey-evidence/anonymous-home-smoke");
const forbiddenText = /(api[-_ ]?key|authorization|token|secret|cookie)\s*[:=]\s*\S+|bearer\s+\S+/i;
const focusStyleProperties = [
  "outlineStyle", "outlineWidth", "outlineColor", "outlineOffset", "boxShadow",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "backgroundColor", "color",
] as const;

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "light" });

test("captures anonymous v4 home journey evidence", async ({ page, context }) => {
  await mkdir(evidenceRoot, { recursive: true });
  const runtimeErrors: string[] = [];
  const failedResponses: string[] = [];
  const telemetryIds: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => runtimeErrors.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) runtimeErrors.push(`request: ${request.method()} ${url.pathname} ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) && response.status() >= 400) failedResponses.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    if (url.pathname === "/api/v1/telemetry/web-vitals") {
      try {
        const data = JSON.parse(response.request().postData() ?? "null") as { id?: string } | null;
        if (data?.id) telemetryIds.push(data.id);
      } catch (error) { runtimeErrors.push(`telemetry payload: ${(error as Error).message}`); }
    }
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) await route.continue();
    else await route.abort("blockedbyclient");
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  try {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("h1").first()).toContainText("Welcome to argismonitor v4");
  await expect(page.getByText("healthy", { exact: true })).toBeVisible();
  const telemetryStatus = await page.evaluate(async () => (await fetch("/api/v1/telemetry/web-vitals", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "phenotype-journey-metric", name: "LCP", value: 1, rating: "good", delta: 1, navigationType: "navigate", ts: Date.now() }),
  })).status);
  expect(telemetryStatus).toBe(202);
  expect(runtimeErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(telemetryIds).toContain("phenotype-journey-metric");
  expect(new Set(telemetryIds).size).toBe(telemetryIds.length);
  await expect(page.locator("body")).not.toContainText(forbiddenText);
  await page.locator("input[type='password'], [data-sensitive='true']").evaluateAll((nodes) => {
    for (const node of nodes) { node.setAttribute("value", "[REDACTED]"); node.textContent = "[REDACTED]"; }
  });

  const structure = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((element) => ({
      level: Number(element.tagName.slice(1)), text: element.textContent?.trim() ?? "",
    }));
    return {
      title: document.title, language: document.documentElement.lang || null, headingCount: headings.length,
      hasHeadingSkip: headings.some((heading, index) => index > 0 && heading.level > headings[index - 1].level + 1),
      landmarks: { main: document.querySelectorAll("main").length, navigation: document.querySelectorAll("nav").length },
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  expect(structure.title).not.toBe("");
  expect(structure.headingCount).toBeGreaterThan(0);
  expect(structure.hasHeadingSkip).toBe(false);
  expect(structure.landmarks).toEqual({ main: 1, navigation: 1 });
  expect(structure.horizontalOverflow).toBe(false);
  expect(structure.reducedMotion).toBe(true);

  const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
  const axeResult = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  const landmarkRules = ["landmark-one-main", "region"];
  const landmarkResult = await new AxeBuilder({ page }).withRules(landmarkRules).analyze();
  const summarizeAxe = (items: typeof axeResult.violations) => items
    .map(({ id, impact, help, nodes }) => ({ id, impact, help, targetCount: nodes.length }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const axe = {
    engine: { name: axeResult.testEngine.name, version: axeResult.testEngine.version },
    tags: axeTags,
    explicitRules: landmarkRules,
    violations: summarizeAxe([...axeResult.violations, ...landmarkResult.violations]),
    incomplete: summarizeAxe([...axeResult.incomplete, ...landmarkResult.incomplete]),
    rules: Array.from(new Map([
      ...axeResult.passes.map(({ id }) => ({ id, result: "passed" })),
      ...axeResult.inapplicable.map(({ id }) => ({ id, result: "inapplicable" })),
      ...landmarkResult.passes.map(({ id }) => ({ id, result: "passed" })),
      ...landmarkResult.inapplicable.map(({ id }) => ({ id, result: "inapplicable" })),
    ].map((item) => [item.id, item])).values()).sort((left, right) => left.id.localeCompare(right.id)),
  };
  const axeHasFinding = (ruleIds: string[]) => [...axe.violations, ...axe.incomplete].some(({ id }) => ruleIds.includes(id));
  const checks: Record<string, unknown> = {
    "document-title": { status: "passed", title: structure.title },
    "heading-order": { status: "passed", headingCount: structure.headingCount, hasHeadingSkip: structure.hasHeadingSkip },
    landmarks: { status: "passed", ...structure.landmarks },
    "focus-visible": { status: "pending", keyboardOnly: true, targets: [] },
    "accessible-names": {
      status: axeHasFinding(["aria-command-name", "aria-input-field-name", "aria-toggle-field-name", "button-name", "image-alt", "input-button-name", "link-name", "select-name"]) ? "failed" : "passed",
      axeRules: axe.rules.filter(({ id }) => id.includes("name") || id === "image-alt"),
    },
    contrast: { status: axeHasFinding(["color-contrast", "color-contrast-enhanced"]) ? "failed" : "passed", axeRule: "color-contrast" },
    "no-horizontal-overflow": { status: "passed", horizontalOverflow: structure.horizontalOverflow },
    "reduced-motion": { status: "passed", reducedMotion: structure.reducedMotion },
  };
  const persistAccessibility = () => writeFile(
    path.join(evidenceRoot, "accessibility-smoke.json"),
    `${JSON.stringify({ schemaVersion: 2, viewport: structure.viewport, checks, axe }, null, 2)}\n`,
    { mode: 0o600 },
  );
  await persistAccessibility();
  expect(
    { violations: axe.violations, incomplete: axe.incomplete },
    "axe violations and incomplete results require remediation or explicit review before capture",
  ).toEqual({ violations: [], incomplete: [] });
  for (const rule of ["color-contrast", "button-name", "image-alt", "landmark-one-main"]) expect(axe.rules.map(({ id }) => id)).toContain(rule);

  const focusSetup = await page.evaluate((properties) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("*")).filter((element) => {
      const style = getComputedStyle(element);
      return element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert],[aria-hidden='true']")
        && style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    }).sort((left, right) => {
      const leftOrder = left.tabIndex > 0 ? left.tabIndex : Number.MAX_SAFE_INTEGER;
      const rightOrder = right.tabIndex > 0 ? right.tabIndex : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
    const styleOf = (element: HTMLElement) => Object.fromEntries(properties.map((property) => [property, getComputedStyle(element)[property]]));
    return candidates.map((element, index) => {
      element.dataset.journeyFocusIndex = String(index);
      return { index, element: element.tagName.toLowerCase(), role: element.getAttribute("role"), type: element.getAttribute("type"), before: styleOf(element) };
    });
  }, focusStyleProperties);
  expect(focusSetup.length).toBeGreaterThan(0);
  const focusTraversal = [];
  const seenFocusIndexes = new Set<number>();
  for (let index = 0; index < focusSetup.length; index += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate((properties) => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return null;
      return { index: Number(element.dataset.journeyFocusIndex), focusVisible: element.matches(":focus-visible"), after: Object.fromEntries(properties.map((property) => [property, getComputedStyle(element)[property]])) };
    }, focusStyleProperties);
    expect(focused).not.toBeNull();
    const baseline = focusSetup.find((item) => item.index === focused?.index);
    expect(baseline).toBeDefined();
    expect(seenFocusIndexes.has(focused?.index ?? -1), "Tab traversal must not cycle before inventory completion").toBe(false);
    seenFocusIndexes.add(focused?.index ?? -1);
    const changedProperties = focusStyleProperties.filter((property) => baseline?.before[property] !== focused?.after[property]);
    expect(focused?.focusVisible).toBe(true);
    expect(changedProperties.length).toBeGreaterThan(0);
    focusTraversal.push({ ...baseline, after: focused?.after, focusVisible: focused?.focusVisible, changedProperties });
    checks["focus-visible"] = { status: "pending", keyboardOnly: true, targets: focusTraversal };
    await persistAccessibility();
  }
  expect(focusTraversal.map(({ index }) => index)).toEqual(focusSetup.map(({ index }) => index));

  checks["focus-visible"] = { status: "passed", keyboardOnly: true, targets: focusTraversal };
  await persistAccessibility();
  expect(runtimeErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(new Set(telemetryIds).size).toBe(telemetryIds.length);
  await page.screenshot({ path: path.join(evidenceRoot, "home.png"), fullPage: false, animations: "disabled" });
  } finally {
  await context.tracing.stop({ path: path.join(evidenceRoot, "trace.zip") });
  }
});
