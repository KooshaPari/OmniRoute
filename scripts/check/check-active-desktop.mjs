import { readFile } from "node:fs/promises";

const activeFiles = [
  "package.json",
  "docs/guides/SETUP_GUIDE.md",
  ".github/workflows/apps-quality.yml",
  ".github/workflows/cross-platform.yml",
  ".github/workflows/release.yml",
];

const forbidden = /(?:npm run )?electron(?::|\b)|desktop-electrobun|ElectroBun/gi;
const allowedHistorical = /(?:docs\/legacy|electron\/|desktop-electrobun\/)/;
const violations = [];

for (const file of activeFiles) {
  try {
    const text = await readFile(file, "utf8");
    for (const [index, line] of text.split("\n").entries()) {
      if (forbidden.test(line) && !allowedHistorical.test(line) && !/historical|inactive/i.test(line)) {
        violations.push(`${file}:${index + 1}: inactive desktop reference`);
      }
      forbidden.lastIndex = 0;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

for (const required of [
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/capabilities/default.json",
]) {
  try {
    await readFile(required);
  } catch {
    violations.push(`${required}: required active Tauri file is missing`);
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("[active-desktop] Tauri policy passed");
