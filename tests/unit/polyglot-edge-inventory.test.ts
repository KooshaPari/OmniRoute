import test from "node:test";
import assert from "node:assert/strict";
import { EDGE_INVENTORY, FFI_CRATES } from "../../open-sse/rpc/edgeInventory.ts";

void test("edgeInventory: every edge row has a unique name", () => {
  const names = EDGE_INVENTORY.map((row) => row.name);
  const unique = new Set(names);
  assert.equal(unique.size, names.length, `duplicate names found: ${names.filter((n, i) => names.indexOf(n) !== i).join(", ")}`);
});

void test("edgeInventory: every FFI edge references a real FFI crate", () => {
  for (const row of EDGE_INVENTORY) {
    if (row.crate) {
      assert.ok(
        FFI_CRATES.includes(row.crate),
        `edge ${row.name} references crate ${row.crate} which isn't in FFI_CRATES`
      );
    }
    if (row.symbol) {
      assert.ok(row.crate, `edge ${row.name} has symbol but no crate`);
    }
  }
});

void test("edgeInventory: providerScope is either an array or null", () => {
  for (const row of EDGE_INVENTORY) {
    if (row.providerScope !== null) {
      assert.ok(Array.isArray(row.providerScope), `${row.name} providerScope must be array or null`);
    }
  }
});

void test("edgeInventory: every defaultTier is one of T1/T2/T3", () => {
  for (const row of EDGE_INVENTORY) {
    assert.ok(["T1", "T2", "T3"].includes(row.defaultTier), `${row.name} has invalid tier ${row.defaultTier}`);
  }
});

void test("edgeInventory: total count expectations", () => {
  assert.equal(EDGE_INVENTORY.length, 17);
  assert.equal(FFI_CRATES.length, 6);
  const hotEdges = EDGE_INVENTORY.filter((row) => row.hotPathFiles.length > 0);
  assert.ok(hotEdges.length >= 1, "at least one edge should have a hot path file");
});

void test("edgeInventory: bifrost.chat references the cgo bridge crate", () => {
  const bifrost = EDGE_INVENTORY.find((row) => row.name === "bifrost.chat");
  assert.ok(bifrost, "bifrost.chat should be in inventory");
  assert.equal(bifrost!.crate, "omniroute_ffi_bifrost_bridge");
});
