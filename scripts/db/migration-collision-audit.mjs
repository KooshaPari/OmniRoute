import { createHash } from "node:crypto";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function uniqueByVersion(items, label) {
  const byVersion = new Map();
  for (const item of items) {
    if (typeof item.version !== "string" || !/^\d+$/.test(item.version)) {
      throw new Error(`Invalid ${label} version`);
    }
    if (typeof item.name !== "string" || !item.name) throw new Error(`Invalid ${label} name`);
    if (byVersion.has(item.version)) throw new Error(`Duplicate ${label} version: ${item.version}`);
    byVersion.set(item.version, item);
  }
  return byVersion;
}

/** Pure inventory: callers supply a consistent ledger snapshot and exact migration bytes. */
export function auditMigrationCollisions(ledger, migrations, recipes = []) {
  const applied = uniqueByVersion(ledger, "ledger");
  const files = uniqueByVersion(migrations, "migration");
  const recipeKeys = new Set();
  for (const recipe of recipes) {
    if (!/^\d+$/.test(recipe.version) || !recipe.appliedName || !recipe.diskName ||
        !/^[a-f0-9]{64}$/.test(recipe.sha256) || !recipe.id) {
      throw new Error("Invalid recipe identity");
    }
    const key = JSON.stringify([recipe.version, recipe.appliedName, recipe.diskName, recipe.sha256]);
    if (recipeKeys.has(key)) throw new Error("Duplicate recipe identity");
    recipeKeys.add(key);
  }
  const collisions = [];
  for (const [version, file] of files) {
    if (!(typeof file.bytes === "string" || file.bytes instanceof Uint8Array)) {
      throw new Error(`Migration ${version} has no bytes`);
    }
    const previous = applied.get(version);
    if (!previous || previous.name === file.name) continue;
    const hash = sha256(file.bytes);
    const recipe = recipes.find((r) => r.version === version && r.appliedName === previous.name &&
      r.diskName === file.name && r.sha256 === hash);
    collisions.push({ version, appliedName: previous.name, diskName: file.name, sha256: hash,
      recipeId: recipe?.id ?? null, disposition: "unverified" });
  }
  collisions.sort((a, b) => compare(a.version, b.version) || compare(a.diskName, b.diskName));
  return { format: 1, collisions };
}
