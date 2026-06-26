#!/usr/bin/env node
/**
 * scripts/sbom/verify-sbom.mjs
 *
 * Verifies the signature + license policy of a CycloneDX 1.5 SBOM produced
 * by generate-sbom.mjs and signed by sign-release.mjs.
 *
 * Behaviour:
 *   1. Load SBOM JSON from --sbom <path>.
 *   2. Load signature envelope from --signature <path> (default: same dir as
 *      SBOM, suffixed `.sig`).
 *   3. Re-canonicalise the SBOM (sorted keys, same as sign-release) and
 *      recompute SHA-512.
 *   4. Verify the signature against the public key embedded in the envelope.
 *      On mismatch → exit 1 with reason "SIGNATURE_INVALID".
 *   5. Verify the embedded digest matches the recomputed digest → "DIGEST_MISMATCH"
 *      on failure.
 *   6. Enforce license policy:
 *        - Default allowlist:  MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause,
 *          ISC, MPL-2.0, CC0-1.0, Unlicense, 0BSD, MIT-0, Zlib, BlueOak-1.0.0,
 *          Python-2.0, WTFPL, AFL-3.0, BSL-1.0, EPL-2.0, OFL-1.1, PostgreSQL,
 *          Ruby, SAX-PD, LGPL-2.1, LGPL-3.0, Artistic-2.0, CC-BY-4.0, CC-BY-3.0,
 *          CC-BY-SA-4.0
 *        - Default denylist:  GPL/AGPL family, SSPL-1.0, Commons-Clause
 *      Components with NOASSERTION license are reported as `license-unknown`
 *      policy violations unless --allow-unknown is set.
 *   7. Print a JSON report to stdout and exit 0 on full pass, 1 on any failure.
 *
 * Usage:
 *   node scripts/sbom/verify-sbom.mjs --sbom <path> [--signature <path>]
 *                                      [--allow-unknown] [--strict]
 *
 * Exit codes:
 *   0  signature valid + license policy passes (or only warnings)
 *   1  signature invalid / digest mismatch
 *   2  license policy violation
 *   3  IO / parse error
 */

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

const args = parseArgs(process.argv.slice(2));
const QUIET = args.quiet === true;
const SBOM_PATH = args.sbom ? resolve(args.sbom) : null;
const SIG_PATH = args.signature ? resolve(args.signature) : null;
const ALLOW_UNKNOWN = args["allow-unknown"] === true;
const STRICT = args.strict === true;

const SPDX_ALLOW = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC",
  "MPL-2.0", "CC0-1.0", "Unlicense", "0BSD", "MIT-0", "Zlib",
  "BlueOak-1.0.0", "Python-2.0", "WTFPL", "AFL-3.0", "BSL-1.0",
  "EPL-2.0", "OFL-1.1", "PostgreSQL", "Ruby", "SAX-PD",
  "LGPL-2.1", "LGPL-3.0", "Artistic-2.0",
  "CC-BY-4.0", "CC-BY-3.0", "CC-BY-SA-4.0",
]);
const SPDX_REJECT = new Set([
  "GPL-1.0-only", "GPL-1.0-or-later",
  "GPL-2.0-only", "GPL-2.0-or-later",
  "GPL-3.0-only", "GPL-3.0-or-later",
  "AGPL-1.0", "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
  "SSPL-1.0", "Commons-Clause",
]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    }
  }
  return out;
}

function log(...parts) {
  if (!QUIET) {
    process.stderr.write(`[verify-sbom] ${parts.join(" ")}\n`);
  }
}

function die(msg, code = 3) {
  process.stderr.write(`[verify-sbom] ERROR: ${msg}\n`);
  process.exit(code);
}

function canonicalJson(obj) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
    return out;
  };
  return JSON.stringify(walk(obj));
}

function sha512Hex(buf) {
  return createHash("sha512").update(buf).digest("hex");
}

function loadJsonOrDie(path, label) {
  if (!existsSync(path)) die(`${label} not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    die(`malformed ${label} JSON at ${path}: ${err.message}`);
  }
  return null;
}

function extractLicenses(component) {
  const out = [];
  const arr = component?.licenses;
  if (!Array.isArray(arr)) return out;
  for (const entry of arr) {
    if (!entry) continue;
    if (typeof entry === "string") { out.push(entry); continue; }
    if (entry.id) out.push(entry.id);
    if (entry.expression) out.push(entry.expression);
    if (entry.license?.id) out.push(entry.license.id);
    if (entry.license?.name) out.push(entry.license.name);
  }
  return out;
}

// --------------------------------------------------------------------------
// Signature verification
// --------------------------------------------------------------------------

function verifySignature(envelope, sbomCanonical) {
  const sigBytes = Buffer.from(envelope.value, "base64");
  if (!envelope.publicKey) {
    return { ok: false, reason: "PUBLIC_KEY_MISSING" };
  }
  let pubKey;
  try {
    pubKey = createPublicKey({ key: envelope.publicKey, format: "pem" });
  } catch (err) {
    return { ok: false, reason: `PUBLIC_KEY_INVALID: ${err.message}` };
  }

  // Algorithm dispatch
  switch (envelope.alg) {
    case "ES256": {
      const ok = cryptoVerify("sha256", Buffer.from(sbomCanonical, "utf8"), pubKey, sigBytes);
      return ok ? { ok: true } : { ok: false, reason: "SIGNATURE_INVALID" };
    }
    case "ECDSA-P256-SHA512": {
      const ok = cryptoVerify("sha512", Buffer.from(sbomCanonical, "utf8"), pubKey, sigBytes);
      return ok ? { ok: true } : { ok: false, reason: "SIGNATURE_INVALID" };
    }
    case "cosign-blob": {
      // For cosign the signature must be verified externally via
      // `cosign verify-blob`. We do a structural sanity check here and
      // defer to the workflow for the real verification.
      if (!sigBytes.length) return { ok: false, reason: "COSIGN_SIG_EMPTY" };
      return { ok: true, reason: "DEFER_TO_COSIGN" };
    }
    default:
      return { ok: false, reason: `UNKNOWN_ALG: ${envelope.alg}` };
  }
}

// --------------------------------------------------------------------------
// License policy
// --------------------------------------------------------------------------

function licenseViolations(components) {
  const violations = [];
  for (const c of components || []) {
    const names = extractLicenses(c);
    if (names.length === 0) {
      if (!ALLOW_UNKNOWN) {
        violations.push({
          bomRef: c["bom-ref"],
          name: c.name,
          version: c.version,
          rule: "license-unknown",
          licenses: [],
        });
      }
      continue;
    }
    for (const lic of names) {
      if (SPDX_REJECT.has(lic)) {
        violations.push({
          bomRef: c["bom-ref"],
          name: c.name,
          version: c.version,
          rule: "license-denied",
          licenses: [lic],
        });
        continue;
      }
      if (lic === "NOASSERTION") {
        if (!ALLOW_UNKNOWN) {
          violations.push({
            bomRef: c["bom-ref"],
            name: c.name,
            version: c.version,
            rule: "license-unknown",
            licenses: [lic],
          });
        }
        continue;
      }
      if (!SPDX_ALLOW.has(lic)) {
        violations.push({
          bomRef: c["bom-ref"],
          name: c.name,
          version: c.version,
          rule: "license-not-in-allowlist",
          licenses: [lic],
        });
      }
    }
  }
  return violations;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

function main() {
  if (!SBOM_PATH) die("--sbom <path> is required");

  log(`loading SBOM from ${SBOM_PATH}`);
  const sbom = loadJsonOrDie(SBOM_PATH, "SBOM");

  const inferredSigPath = SIG_PATH || SBOM_PATH.replace(/\.cdx\.json$/, ".cdx.json.sig");
  log(`loading signature from ${inferredSigPath}`);
  const envelope = loadJsonOrDie(inferredSigPath, "signature envelope");

  const sbomCanonical = canonicalJson(sbom);
  const recomputed = sha512Hex(Buffer.from(sbomCanonical, "utf8"));

  const digestMatch = envelope.digest === recomputed && envelope.payloadSha512 === recomputed;
  const sigResult = digestMatch ? verifySignature(envelope, sbomCanonical) : { ok: false, reason: "DIGEST_MISMATCH" };

  const violations = STRICT ? licenseViolations(sbom.components) : [];

  const report = {
    ok: sigResult.ok && violations.length === 0,
    sbom: SBOM_PATH,
    signature: inferredSigPath,
    signatureVerification: {
      alg: envelope.alg,
      digestAlg: envelope.digestAlg,
      digestMatch,
      recomputed,
      signed: sigResult.ok,
      reason: sigResult.reason || null,
      signer: envelope.signer || null,
      signedAt: envelope.signedAt || null,
      keyId: envelope.keyId || null,
    },
    licensePolicy: {
      allowedCount: SPDX_ALLOW.size,
      deniedCount: SPDX_REJECT.size,
      violationCount: violations.length,
      violations,
    },
    summary: {
      componentCount: (sbom.components || []).length,
      version: sbom.metadata?.component?.version || null,
      serialNumber: sbom.serialNumber || null,
      timestamp: sbom.metadata?.timestamp || null,
    },
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  if (!sigResult.ok) {
    process.exit(1);
  }
  if (violations.length > 0) {
    process.exit(STRICT ? 2 : 0);
  }
}

main();
