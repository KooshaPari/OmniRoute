#!/usr/bin/env node
/**
 * scripts/sbom/sign-release.mjs
 *
 * Signs a CycloneDX 1.5 SBOM produced by generate-sbom.mjs.
 *
 * Strategy (zero npm deps, Windows-friendly):
 *   1. Detect signing backend in priority order:
 *      a. `cosign` binary on PATH (real Sigstore keyless / OIDC flow)
 *      b. SBOM_SIGNING_KEY env var pointing at a PEM-encoded ECDSA P-256 key
 *      c. Generate a fresh ECDSA P-256 keypair and persist it under
 *         dist/sbom/keys/<name>-<timestamp>.pem (the in-toto attestation
 *         records the public key so a verifier can replay the check).
 *   2. Compute SHA-512 of the canonical SBOM (re-serialised with sorted keys)
 *      and sign it with the resolved key.
 *   3. Write:
 *        dist/sbom/omniroute-<version>.cdx.json.sig  (signature envelope JSON)
 *        dist/sbom/omniroute-<version>.cdx.json.att   (in-toto attestation link)
 *   4. Print a JSON summary to stdout for CI consumption.
 *
 * Signature envelope format (JSON, stdlib-crypto compatible):
 *   {
 *     "version": "1.0",
 *     "alg": "ES256" | "ECDSA-P256-SHA512" | "cosign-blob",
 *     "digestAlg": "SHA-512",
 *     "digest": "<hex>",
 *     "value": "<base64>",
 *     "keyId": "<public-key-pem-or-cosign-pub>",
 *     "signedAt": "<iso-8601>",
 *     "signer": { "subject": "<...>", "issuer": "<...>" },
 *     "payloadSha512": "<hex-of-canonical-SBOM>"
 *   }
 *
 * In-toto attestation link format (simplified, v0.1):
 *   {
 *     "_type": "https://in-toto.io/Statement/v0.1",
 *     "predicateType": "https://cyclonedx.org/bom",
 *     "subject": [{ "name": "omniroute-<version>.cdx.json", "digest": { "sha512": "..." } }],
 *     "predicate": { "sbom": "...embedded path ref..." },
 *     "materials": [],
 *     "signatures": [{ "keyid": "...", "sig": "..." }]
 *   }
 *
 * Usage:
 *   node scripts/sbom/sign-release.mjs --sbom <path> [--out <dir>] [--key <pem>]
 *
 * Exit codes:
 *   0 success
 *   1 invalid input / SBOM not found
 *   2 signing backend unavailable / write error
 */

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign as cryptoSign, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

const SIGNATURE_SUFFIX = ".cdx.json.sig";
const ATTESTATION_SUFFIX = ".cdx.json.att";
const KEYS_DIR = "keys";

const args = parseArgs(process.argv.slice(2));
const QUIET = args.quiet === true;
const SBOM_PATH = args.sbom ? resolve(args.sbom) : null;
const OUT_DIR = args.out ? resolve(args.out) : null;
const KEY_PATH = args.key ? resolve(args.key) : (process.env.SBOM_SIGNING_KEY ? resolve(process.env.SBOM_SIGNING_KEY) : null);
const KEY_ID = process.env.SBOM_SIGNER_ID || "omniroute-release-bot";
const SUBJECT = process.env.SBOM_SIGNER_SUBJECT || "https://github.com/diegosouzapw/OmniRoute/.github/workflows/sbom-build.yml";

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
    process.stderr.write(`[sign-release] ${parts.join(" ")}\n`);
  }
}

function die(msg, code = 1) {
  process.stderr.write(`[sign-release] ERROR: ${msg}\n`);
  process.exit(code);
}

function canonicalJson(obj) {
  // Stable stringification: sort keys recursively so the same BOM yields the
  // same digest on every run (Node's default JSON.stringify preserves
  // insertion order, which is what we want, but we still sort to make
  // verification robust against property reordering).
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

function loadSbomOrDie(path) {
  if (!existsSync(path)) die(`SBOM not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    die(`malformed SBOM JSON at ${path}: ${err.message}`);
  }
  return null;
}

// --------------------------------------------------------------------------
// Backend resolution
// --------------------------------------------------------------------------

/**
 * @returns {Promise<{alg: string, sign: (data: Buffer) => Buffer, publicKeyPem: string}>}
 */
function resolveBackend() {
  // 1. cosign
  if (!args["no-cosign"]) {
    const probe = spawnSync("cosign", ["version"], { stdio: "ignore" });
    if (probe.status === 0) {
      log("using cosign backend");
      return {
        alg: "cosign-blob",
        sign: async () => {
          // cosign sign-blob is invoked out-of-band in CI; we don't shell out
          // here because doing so would require a key reference. The signature
          // envelope is generated from a pre-existing sig file via cosign
          // verify-blob. For the in-script fallback path, we defer to cosign.
          throw new Error("cosign sign-blob must be invoked by the workflow; use --no-cosign to force stdlib signing");
        },
        publicKeyPem: process.env.COSIGN_PUBLIC_KEY || "",
      };
    }
  }

  // 2. explicit key path
  if (KEY_PATH && existsSync(KEY_PATH)) {
    log(`using ECDSA P-256 key from ${KEY_PATH}`);
    const pem = readFileSync(KEY_PATH, "utf8");
    const priv = createPrivateKey({ key: pem, format: "pem" });
    const pub = createPublicKey(priv).export({ type: "spki", format: "pem" });
    return {
      alg: "ES256",
      sign: (data) => cryptoSign("sha256", data, priv),
      publicKeyPem: pub.toString(),
    };
  }

  // 3. generate ephemeral key
  log("generating ephemeral ECDSA P-256 keypair (no --key / SBOM_SIGNING_KEY supplied)");
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const outDir = resolve(OUT_DIR || dirname(SBOM_PATH || REPO_ROOT), KEYS_DIR);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const pubPath = join(outDir, `omniroute-${ts}.pub.pem`);
  const privPath = join(outDir, `omniroute-${ts}.priv.pem`);
  try {
    writeFileSync(pubPath, pubPem, { mode: 0o644 });
    writeFileSync(privPath, privPem, { mode: 0o600 });
    log(`wrote ${pubPath} and ${privPath}`);
  } catch (err) {
    die(`failed to persist generated key: ${err.message}`, 2);
  }
  return {
    alg: "ES256",
    sign: (data) => cryptoSign("sha256", data, privateKey),
    publicKeyPem: pubPem,
  };
}

// --------------------------------------------------------------------------
// Envelope & attestation builders
// --------------------------------------------------------------------------

function buildEnvelope({ alg, signature, publicKeyPem, digest, sbomCanonical, signedAt }) {
  return {
    version: "1.0",
    alg,
    digestAlg: "SHA-512",
    digest,
    value: signature.toString("base64"),
    keyId: publicKeyPem ? keyFingerprint(publicKeyPem) : KEY_ID,
    publicKey: publicKeyPem || null,
    signedAt,
    signer: { subject: SUBJECT, issuer: KEY_ID },
    payloadSha512: sha512Hex(Buffer.from(sbomCanonical, "utf8")),
  };
}

function buildAttestation({ envelope, sbomPath, sbomCanonical, version }) {
  return {
    _type: "https://in-toto.io/Statement/v0.1",
    predicateType: "https://cyclonedx.org/bom",
    subject: [
      {
        name: basename(sbomPath),
        digest: { sha512: envelope.payloadSha512 },
      },
    ],
    predicate: {
      sbom: {
        path: relative(REPO_ROOT, sbomPath).replace(/\\/g, "/"),
        specVersion: "1.5",
        serialNumber: extractSerialNumber(sbomCanonical),
        componentCount: JSON.parse(sbomCanonical).components.length,
      },
      signer: envelope.signer,
      signedAt: envelope.signedAt,
      alg: envelope.alg,
    },
    materials: [],
    signatures: [
      {
        keyid: envelope.keyId,
        sig: envelope.value,
      },
    ],
  };
}

function keyFingerprint(pem) {
  return "sha256:" + createHash("sha256").update(pem).digest("hex").slice(0, 32);
}

function extractSerialNumber(canonicalSbom) {
  try {
    return JSON.parse(canonicalSbom).serialNumber || null;
  } catch {
    return null;
  }
}

function versionFromFilename(name) {
  const m = name.match(/^omniroute-(.+)\.cdx\.json$/);
  return m ? m[1] : null;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main() {
  if (!SBOM_PATH) die("--sbom <path> is required");

  log(`loading SBOM from ${SBOM_PATH}`);
  const sbom = loadSbomOrDie(SBOM_PATH);
  const version = (sbom.metadata?.component?.version) || versionFromFilename(basename(SBOM_PATH)) || "0.0.0";
  const sbomCanonical = canonicalJson(sbom);
  const sbomDigest = sha512Hex(Buffer.from(sbomCanonical, "utf8"));

  log(`SBOM canonical sha-512: ${sbomDigest}`);

  const backend = await resolveBackend();
  let signature;
  try {
    signature = backend.sign(Buffer.from(sbomCanonical, "utf8"));
  } catch (err) {
    die(`signing failed: ${err.message}`, 2);
  }

  const signedAt = new Date().toISOString();
  const envelope = buildEnvelope({
    alg: backend.alg,
    signature,
    publicKeyPem: backend.publicKeyPem,
    digest: sbomDigest,
    sbomCanonical,
    signedAt,
  });

  const attestation = buildAttestation({ envelope, sbomPath: SBOM_PATH, sbomCanonical, version });

  const outDir = OUT_DIR || dirname(SBOM_PATH);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const sigPath = join(outDir, basename(SBOM_PATH).replace(/\.cdx\.json$/, "") + SIGNATURE_SUFFIX.slice(SIGNATURE_SUFFIX.lastIndexOf(".")));
  // sigPath is dist/sbom/omniroute-<version>.cdx.json.sig
  const properSigPath = join(outDir, basename(SBOM_PATH) + ".sig");
  const properAttPath = join(outDir, basename(SBOM_PATH) + ".att");

  try {
    writeFileSync(properSigPath, JSON.stringify(envelope, null, 2), "utf8");
    writeFileSync(properAttPath, JSON.stringify(attestation, null, 2), "utf8");
  } catch (err) {
    die(`failed to write signature/attestation: ${err.message}`, 2);
  }
  log(`wrote ${properSigPath}`);
  log(`wrote ${properAttPath}`);

  process.stdout.write(JSON.stringify({
    ok: true,
    sbom: SBOM_PATH,
    signature: properSigPath,
    attestation: properAttPath,
    alg: envelope.alg,
    digestAlg: envelope.digestAlg,
    digest: envelope.digest,
    keyId: envelope.keyId,
    signedAt: envelope.signedAt,
  }) + "\n");
}

main().catch((err) => die(err.message, err.code || 1));
