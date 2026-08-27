import assert from "node:assert/strict";
import test from "node:test";

import {
  desktopWorkflows,
  workflowPath,
} from "../../web/src/lib/parity/workflows.ts";
import { desktopParityMatrix } from "./parity-matrix.ts";

test("Tauri parity matrix consumes the browser workflow contract", () => {
  assert.deepEqual(Object.keys(desktopParityMatrix), desktopWorkflows);

  for (const workflow of desktopWorkflows) {
    assert.equal(desktopParityMatrix[workflow].path, workflowPath[workflow]);
  }
});
