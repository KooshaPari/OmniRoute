import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { shouldSkipBifrostStreamOutcome } from "../../open-sse/handlers/chatCore/bifrostStreamOutcome.ts";

describe("shouldSkipBifrostStreamOutcome", () => {
  it("suppresses confirmed client disconnect outcome", () => {
    const outcome = shouldSkipBifrostStreamOutcome({
      status: 499,
      streamError: "Client disconnected: request_signal_aborted",
      streamErrorCode: "client_disconnected",
    });

    assert.equal(outcome, true);
  });

  it("does not suppress upstream or pipeline failures", () => {
    const outcome = shouldSkipBifrostStreamOutcome({
      status: 500,
      streamError: "stream stalled",
      streamErrorCode: "stream_pipeline_error",
    });

    assert.equal(outcome, false);
  });

  it("does not suppress 499 without confirmed disconnect signal", () => {
    const outcome = shouldSkipBifrostStreamOutcome({
      status: 499,
      streamError: "Upstream returned 499",
      streamErrorCode: "stream_pipeline_error",
    });

    assert.equal(outcome, false);
  });

  it("suppresses 499 with disconnect wording even without explicit code", () => {
    const outcome = shouldSkipBifrostStreamOutcome({
      status: 499,
      streamError: "Client Disconnected",
      streamErrorCode: "stream_pipeline_error",
    });

    assert.equal(outcome, true);
  });
});
