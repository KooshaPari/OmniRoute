import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { auditMigrationCollisions } from "../../scripts/db/migration-collision-audit.mjs";

const hash = (s) => createHash("sha256").update(s).digest("hex");

test("all 53 identities are deterministic regardless of enumeration order", () => {
  const ledger = Array.from({ length: 53 }, (_, n) => ({ version: String(n).padStart(3, "0"), name: `old${n}` }));
  const files = ledger.map(({ version }, n) => ({ version, name: `new${n}`, bytes: `sql${n}` }));
  const before = JSON.stringify([ledger, files]);
  const result = auditMigrationCollisions(ledger, files);
  assert.equal(result.collisions.length, 53);
  assert.deepEqual(result, auditMigrationCollisions([...ledger].reverse(), [...files].reverse()));
  assert.equal(JSON.stringify([ledger, files]), before);
  assert.ok(result.collisions.every((item) => item.disposition === "unverified" && item.recipeId === null));
});

test("a recipe matches only exact version, both names, and migration bytes", () => {
  const ledger = [{ version: "185", name: "old" }];
  const file = { version: "185", name: "new", bytes: "ALTER" };
  const recipe = { id: "candidate", version: "185", appliedName: "old", diskName: "new", sha256: hash("ALTER") };
  assert.equal(auditMigrationCollisions(ledger, [file], [recipe]).collisions[0].recipeId, "candidate");
  for (const mismatch of [{ ...recipe, appliedName: "other" }, { ...recipe, diskName: "other" },
    { ...recipe, version: "186" }, { ...recipe, sha256: hash("changed") }]) {
    assert.equal(auditMigrationCollisions(ledger, [file], [mismatch]).collisions[0].recipeId, null);
  }
  assert.equal(auditMigrationCollisions(ledger, [{ ...file, bytes: "changed" }], [recipe]).collisions[0].recipeId, null);
  assert.equal(auditMigrationCollisions(ledger, [file], [recipe]).collisions[0].disposition, "unverified");
});

test("ambiguous slots and malformed recipes fail closed", () => {
  const ledger = [{ version: "185", name: "old" }];
  const file = { version: "185", name: "new", bytes: "x" };
  assert.throws(() => auditMigrationCollisions([...ledger, ...ledger], [file]), /Duplicate ledger/);
  assert.throws(() => auditMigrationCollisions(ledger, [file, file]), /Duplicate migration/);
  assert.throws(() => auditMigrationCollisions(ledger, [file], [{ id: "x", version: "185", appliedName: "old", diskName: "new", sha256: "x" }]), /Invalid recipe/);
  const recipe = { id: "x", version: "185", appliedName: "old", diskName: "new", sha256: hash("x") };
  assert.throws(() => auditMigrationCollisions(ledger, [file], [recipe, recipe]), /Duplicate recipe/);
});

test("matching identities and unapplied migrations are not collisions", () => {
  assert.deepEqual(auditMigrationCollisions([{version:"001",name:"same"}], [
    {version:"001",name:"same",bytes:"a"}, {version:"002",name:"pending",bytes:"b"}
  ]).collisions, []);
});
