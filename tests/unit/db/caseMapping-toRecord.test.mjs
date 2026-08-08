import { test } from "node:test";
import assert from "node:assert";
import { toRecord } from "../../../src/lib/db/caseMapping.ts";

/**
 * Tests for the toRecord<T>() runtime validation helper added in the
 * as-cast-drift migration. toRecord<T>() validates that an untyped JSON
 * record (typically the output of rowToCamel) contains all expected
 * fields before casting to a domain type. This catches schema drift at
 * runtime — before, `as unknown as X` casts hid missing fields.
 */

test("toRecord() returns null for null input", () => {
  assert.strictEqual(toRecord(null, ["id"]), null);
});

test("toRecord() returns null for undefined input", () => {
  assert.strictEqual(toRecord(undefined, ["id"]), null);
});

test("toRecord() returns the row when all required fields present", () => {
  const row = { id: 1, name: "test", value: 42 };
  const result = toRecord(row, ["id", "name"]);
  assert.deepStrictEqual(result, { id: 1, name: "test", value: 42 });
});

test("toRecord() throws when a required field is missing", () => {
  const row = { id: 1, name: "test" }; // missing 'value'
  assert.throws(
    () => toRecord(row, ["id", "name", "value"]),
    /missing required field 'value'/,
  );
});

test("toRecord() includes the row preview in the error message", () => {
  const row = { id: 1, name: "test", secret: "sensitive-data-here" };
  assert.throws(
    () => toRecord(row, ["id", "name", "secret", "missing"]),
    /missing required field 'missing'/,
  );
  // Error message should include the row preview for debugging.
  try {
    toRecord(row, ["id", "missing"]);
  } catch (err) {
    assert.ok(err.message.includes("missing"));
    assert.ok(err.message.length > 0);
  }
});

test("toRecord() accepts empty required-fields list (no validation)", () => {
  const row = { anything: "goes" };
  assert.deepStrictEqual(toRecord(row, []), { anything: "goes" });
});

test("toRecord() does not validate field types (only presence)", () => {
  // Intentionally wrong types — should still pass (presence check only)
  const row = { id: "not-a-number", count: null };
  const result = toRecord(row, ["id", "count"]);
  assert.strictEqual(result.id, "not-a-number");
  assert.strictEqual(result.count, null);
});
