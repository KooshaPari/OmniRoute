// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

// Test the device-code-first dispatch path in InAppLoginService without spinning
// up a full Playwright browser session.  We validate:
//   1. preferDeviceCode defaults to true (device code attempted first)
//   2. The service toggles properly
//   3. startLogin is callable (constructor works)

let InAppLoginService: any;
let service: any;

beforeAll(async () => {
  const mod = await import("../../../open-sse/services/inAppLoginService");
  InAppLoginService = mod.InAppLoginService;
  service = new InAppLoginService(); // preferDeviceCode = true by default
});

describe("InAppLoginService — device-code config", () => {
  it("should default to preferDeviceCode=true", () => {
    expect(service.preferDeviceCode).toBe(true);
  });

  it("should allow toggling preferDeviceCode", () => {
    service.preferDeviceCode = false;
    expect(service.preferDeviceCode).toBe(false);
    service.preferDeviceCode = true;
    expect(service.preferDeviceCode).toBe(true);
  });

  it("should have startLogin method", () => {
    expect(typeof service.startLogin).toBe("function");
  });
});
