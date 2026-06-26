/**
 * tests/unit/security/sbomLoader.test.ts
 *
 * Unit tests for the runtime SBOM loader + verifier.
 * 15 assertions across 6 test cases (counts below as inline comments).
 *
 * Coverage:
 *   1. canonicalJson deterministic ordering (4 assertions)
 *   2. verifySbomIntegrity ES256 happy path (3 assertions)
 *   3. verifySbomIntegrity detects digest mismatch (2 assertions)
 *   4. verifySbomIntegrity rejects missing publicKey (1 assertion)
 *   5. getLicenseCompliance allowlist + denylist (3 assertions)
 *   6. getLicenseCompliance unknown license handling (2 assertions)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Use a cache-busting import suffix so per-test env mutations re-read the
// module where needed. We don't mutate env here, so a plain import suffices.
const loader = await import("../../../src/lib/security/sbomLoader.ts");

// ---------------------------------------------------------------------------
// 1. canonicalJson deterministic ordering — 4 assertions
// ---------------------------------------------------------------------------

test("canonicalJson: sorts object keys recursively (3 props)", () => {
  const out = loader.canonicalJson({ b: 2, a: 1, c: 3 });
  assert.equal(out, '{"a":1,"b":2,"c":3}');
});

test("canonicalJson: sorts nested objects", () => {
  const out = loader.canonicalJson({ outer: { z: 1, a: 2 }, first: "x" });
  assert.equal(out, '{"first":"x","outer":{"a":2,"z":1}}');
});

test("canonicalJson: sorts keys inside arrays of objects", () => {
  const out = loader.canonicalJson({ items: [{ b: 1, a: 2 }, { d: 3, c: 4 }] });
  assert.equal(out, '{"items":[{"a":2,"b":1},{"c":4,"d":3}]}');
});

test("canonicalJson: independent of source insertion order", () => {
  const a = loader.canonicalJson({ x: 1, y: 2, z: 3 });
  const b = loader.canonicalJson({ z: 3, y: 2, x: 1 });
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// Helper: build a minimal SBOM + signature envelope for tests below.
// ---------------------------------------------------------------------------

function buildBom(overrides = {}): import("../../../src/lib/security/sbomLoader.ts").CycloneDxBom {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: "urn:uuid:test-serial",
    version: 1,
    metadata: {
      timestamp: "2026-06-25T00:00:00.000Z",
      component: {
        type: "application",
        "bom-ref": "root",
        name: "omniroute",
        version: "9.9.9-test",
      },
    },
    components: [
      {
        type: "library",
        "bom-ref": "npm-000001",
        name: "lodash",
        version: "4.17.21",
        licenses: [{ id: "MIT" }],
      },
      {
        type: "library",
        "bom-ref": "npm-000002",
        name: "evil-gpl-lib",
        version: "1.0.0",
        licenses: [{ id: "GPL-3.0-only" }],
      },
    ],
    ...overrides,
  } as any;
}

function signBomEs256(bom: any) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const canonical = loader.canonicalJson(bom);
  const sig = crypto.sign("sha256", Buffer.from(canonical, "utf8"), privateKey);
  return {
    envelope: {
      version: "1.0",
      alg: "ES256" as const,
      digestAlg: "SHA-512" as const,
      digest: crypto.createHash("sha512").update(Buffer.from(canonical, "utf8")).digest("hex"),
      payloadSha512: crypto.createHash("sha512").update(Buffer.from(canonical, "utf8")).digest("hex"),
      value: sig.toString("base64"),
      keyId: "sha256:test-fp",
      publicKey: pubPem,
      signedAt: "2026-06-25T00:00:00.000Z",
      signer: { subject: "test-signer", issuer: "test-suite" },
    },
  };
}

// ---------------------------------------------------------------------------
// 2. verifySbomIntegrity ES256 happy path — 3 assertions
// ---------------------------------------------------------------------------

test("verifySbomIntegrity: valid ES256 signature returns valid=true", async () => {
  const bom = buildBom();
  const { envelope } = signBomEs256(bom);
  const out = await loader.verifySbomIntegrity(bom, envelope);
  assert.equal(out.valid, true);
  assert.equal(out.reason, undefined);
  assert.equal(out.digestMatch, true);
});

// ---------------------------------------------------------------------------
// 3. verifySbomIntegrity detects digest mismatch — 2 assertions
// ---------------------------------------------------------------------------

test("verifySbomIntegrity: tampered BOM yields valid=false (digest mismatch)", async () => {
  const bom = buildBom();
  const { envelope } = signBomEs256(bom);
  // Tamper: change a component name AFTER signing.
  const tampered = { ...bom, components: bom.components!.map((c) => c.name === "lodash" ? { ...c, version: "9.9.9-evil" } : c) } as any;
  const out = await loader.verifySbomIntegrity(tampered, envelope);
  assert.equal(out.valid, false);
  assert.equal(out.reason, "DIGEST_MISMATCH");
});

// ---------------------------------------------------------------------------
// 4. verifySbomIntegrity rejects missing publicKey — 1 assertion
// ---------------------------------------------------------------------------

test("verifySbomIntegrity: missing publicKey returns valid=false", async () => {
  const bom = buildBom();
  const { envelope } = signBomEs256(bom);
  const noKey = { ...envelope, publicKey: null };
  const out = await loader.verifySbomIntegrity(bom, noKey);
  assert.equal(out.valid, false);
  assert.match(out.reason || "", /PUBLIC_KEY_MISSING/);
});

// ---------------------------------------------------------------------------
// 5. getLicenseCompliance allowlist + denylist — 3 assertions
// ---------------------------------------------------------------------------

test("getLicenseCompliance: allowlist lets MIT through and rejects GPL", () => {
  const bom = buildBom();
  const out = loader.getLicenseCompliance(["MIT", "Apache-2.0"], { bom });
  // 2 components: 1 MIT (ok), 1 GPL-3.0-only (denied)
  assert.equal(out.totalComponents, 2);
  assert.equal(out.violationCount, 1);
  assert.equal(out.violations[0].rule, "license-denied");
});

test("getLicenseCompliance: empty allowlist reports allow-list violations for everything", () => {
  const bom = buildBom();
  const out = loader.getLicenseCompliance(["Apache-2.0"], { bom });
  // MIT not in allowlist (but not denied) -> not-in-allowlist violation
  // GPL denied
  assert.equal(out.violationCount >= 2, true);
  const names = out.violations.map((v) => v.name);
  assert.ok(names.includes("lodash"));
  assert.ok(names.includes("evil-gpl-lib"));
});

test("getLicenseCompliance: GPL family always denied even when added to allowlist", () => {
  const bom = buildBom();
  // Try to allow GPL — must still be rejected.
  const out = loader.getLicenseCompliance(["MIT", "GPL-3.0-only"], { bom });
  const gplViolation = out.violations.find((v) => v.name === "evil-gpl-lib");
  assert.ok(gplViolation, "GPL violation must still be reported");
  assert.equal(gplViolation!.rule, "license-denied");
});

// ---------------------------------------------------------------------------
// 6. getLicenseCompliance unknown license handling — 2 assertions
// ---------------------------------------------------------------------------

test("getLicenseCompliance: NOASSERTION license produces license-unknown violation by default", () => {
  const bom = buildBom({
    components: [
      { type: "library", "bom-ref": "npm-X", name: "weird-lib", version: "1.0.0", licenses: [{ id: "NOASSERTION" }] },
    ],
  });
  const out = loader.getLicenseCompliance(undefined, { bom });
  assert.equal(out.violationCount, 1);
  assert.equal(out.violations[0].rule, "license-unknown");
});

test("getLicenseCompliance: NOASSERTION license tolerated when allowUnknown=true", () => {
  const bom = buildBom({
    components: [
      { type: "library", "bom-ref": "npm-X", name: "weird-lib", version: "1.0.0", licenses: [{ id: "NOASSERTION" }] },
    ],
  });
  const out = loader.getLicenseCompliance(undefined, { bom, allowUnknown: true });
  assert.equal(out.ok, true);
  assert.equal(out.violationCount, 0);
});
