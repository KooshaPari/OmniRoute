import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  msToOptionalSecondsInput,
  secondsInputToOptionalMs,
  updateFusionTuning,
} from "../../src/app/(dashboard)/dashboard/combos/comboFormInputs.ts";

describe("combo form input transforms", () => {
  it("rounds positive milliseconds to seconds and rejects invalid values", () => {
    assert.equal(msToOptionalSecondsInput(1_501), "2");
    assert.equal(msToOptionalSecondsInput(0), "");
    assert.equal(msToOptionalSecondsInput("invalid"), "");
  });

  it("rounds seconds to milliseconds and applies the configured cap", () => {
    assert.equal(secondsInputToOptionalMs("1.6"), 2_000);
    assert.equal(secondsInputToOptionalMs("100", 10), 10_000);
    assert.equal(secondsInputToOptionalMs(""), undefined);
  });

  it("keeps only finite Fusion tuning values and removes an empty object", () => {
    assert.deepEqual(updateFusionTuning({}, "qualityWeight", "0.5"), {
      fusionTuning: { qualityWeight: 0.5 },
    });
    assert.deepEqual(
      updateFusionTuning({ fusionTuning: { qualityWeight: 0.5 } }, "qualityWeight", ""),
      { fusionTuning: undefined }
    );
  });
});
