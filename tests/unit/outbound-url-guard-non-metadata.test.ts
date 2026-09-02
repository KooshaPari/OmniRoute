import assert from "node:assert/strict";
import test from "node:test";
import {
  OutboundUrlGuardError,
  parseAndValidateNonMetadataUrl,
} from "../../src/shared/network/outboundUrlGuard.ts";

test("non-metadata URL guard allows LAN providers and rejects cloud metadata", () => {
  assert.equal(parseAndValidateNonMetadataUrl("http://192.168.1.8/v1").hostname, "192.168.1.8");
  assert.throws(
    () => parseAndValidateNonMetadataUrl("http://169.254.169.254/latest/meta-data"),
    OutboundUrlGuardError
  );
});
