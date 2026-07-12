import { describe, expect, it } from "vitest";
import {
  PLAYBOOK_ACTIONS,
  parsePlaybook,
  validatePlaybook,
  type Playbook,
} from "../playbooks";

describe("playbooks", () => {
  it("exposes the canonical action list", () => {
    expect(PLAYBOOK_ACTIONS).toEqual([
      "degrade-provider",
      "force-proxy-rotation",
      "drop-cooldown",
    ]);
  });

  it("accepts a well-formed degrade-provider playbook", () => {
    const pb: Playbook = {
      action: "degrade-provider",
      providerId: "anthropic-prod",
      reason: "rolling-z-score:latency:p99=4.7",
      cooloffSec: 300,
    };
    expect(validatePlaybook(pb)).toBeNull();
    expect(parsePlaybook(pb)).toEqual(pb);
  });

  it("accepts a well-formed force-proxy-rotation playbook", () => {
    const pb: Playbook = {
      action: "force-proxy-rotation",
      providerId: "openai-prod",
      reason: "rolling-z-score:error-rate:4.1",
      rotateCount: 2,
    };
    expect(validatePlaybook(pb)).toBeNull();
    expect(parsePlaybook(pb)).toEqual(pb);
  });

  it("accepts a well-formed drop-cooldown playbook", () => {
    const pb: Playbook = {
      action: "drop-cooldown",
      providerId: "deepseek-prod",
      reason: "post-recovery-clear",
    };
    expect(validatePlaybook(pb)).toBeNull();
    expect(parsePlaybook(pb)).toEqual(pb);
  });

  it("rejects unknown actions", () => {
    const err = validatePlaybook({
      action: "reboot-server",
      providerId: "x",
      reason: "y",
    });
    expect(err).toMatch(/unknown playbook.action/);
  });

  it("rejects empty providerId", () => {
    const err = validatePlaybook({
      action: "drop-cooldown",
      providerId: "",
      reason: "r",
    });
    expect(err).toMatch(/providerId must be a non-empty string/);
  });

  it("rejects non-positive cooloffSec", () => {
    const err = validatePlaybook({
      action: "degrade-provider",
      providerId: "p",
      reason: "r",
      cooloffSec: 0,
    });
    expect(err).toMatch(/cooloffSec must be a positive number/);
  });

  it("rejects non-integer rotateCount", () => {
    const err = validatePlaybook({
      action: "force-proxy-rotation",
      providerId: "p",
      reason: "r",
      rotateCount: 1.5,
    });
    expect(err).toMatch(/rotateCount must be a positive integer/);
  });

  it("rejects non-object input", () => {
    expect(validatePlaybook("hello")).toMatch(/playbook must be an object/);
    expect(validatePlaybook(null)).toMatch(/playbook must be an object/);
  });

  it("parsePlaybook returns null when validation fails", () => {
    expect(parsePlaybook({ action: "drop-cooldown" })).toBeNull();
  });
});