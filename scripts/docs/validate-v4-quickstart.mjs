import { readFile } from "node:fs/promises";
import process from "node:process";

const read = (file) => readFile(file, "utf8");
const [doc, webPackageText, bffPackageText, bffSource, homeSource, smokeTest] = await Promise.all([
  read("docs/public/QUICKSTART_V4.md"),
  read("apps/web/package.json"),
  read("apps/bff/package.json"),
  read("apps/bff/src/index.ts"),
  read("apps/web/src/routes/+page.svelte"),
  read("tests/e2e/smoke.spec.ts"),
]);
const webPackage = JSON.parse(webPackageText);
const bffPackage = JSON.parse(bffPackageText);
const failures = [];
const requireEvidence = (condition, message) => {
  if (!condition) failures.push(message);
};

requireEvidence(webPackage.scripts?.dev === "vite dev --port 4321", "web dev command/port changed");
requireEvidence(bffPackage.scripts?.start === "bun run src/index.ts", "BFF start command changed");
requireEvidence(doc.includes("bun run --cwd apps/web dev"), "documented web command missing");
requireEvidence(doc.includes("PORT=4322 bun run --cwd apps/bff start"), "documented BFF command missing");
for (const packagePath of ["packages/api-contracts", "apps/bff", "apps/web"]) {
  requireEvidence(
    doc.includes(`bun install --frozen-lockfile --cwd ${packagePath} --ignore-scripts`),
    `locked install missing for ${packagePath}`
  );
}
requireEvidence(bffSource.includes("app.get('/healthz'"), "BFF /healthz route changed");
requireEvidence(bffSource.includes("status: 'ok'") && bffSource.includes("service: 'argismonitor-bff'"), "BFF health contract changed");
requireEvidence(homeSource.includes("fetch('/api/bff/healthz')"), "home BFF health proxy URL changed");
requireEvidence(homeSource.includes("Welcome to argismonitor v4"), "implemented home heading changed");
requireEvidence(doc.includes("Welcome to argismonitor v4"), "documented home heading missing");

const smokeMatchesSource = smokeTest.includes("Welcome to argismonitor v4");
requireEvidence(smokeMatchesSource, "smoke-test heading no longer matches source");
requireEvidence(!doc.includes("test is stale relative"), "stale smoke-test warning remains in Quickstart");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Validated v4 Quickstart commands, smoke heading, and source provenance.");
