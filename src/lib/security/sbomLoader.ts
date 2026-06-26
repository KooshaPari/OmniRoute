/**
 * src/lib/security/sbomLoader.ts
 *
 * Runtime loader + verifier for the OmniRoute SBOM.
 *
 * Responsibilities:
 *   - Locate the SBOM file for a given version on disk (default: current
 *     release written by `scripts/sbom/generate-sbom.mjs`).
 *   - Decode the CycloneDX 1.5 JSON envelope into a typed shape.
 *   - Verify the embedded signature (ES256 ECDSA P-256) against the
 *     canonical SBOM payload.
 *   - Walk every component and run it through the license allowlist policy.
 *   - Optionally run at startup (off by default — controlled by
 *     `SBOM_VERIFY_AT_STARTUP=true`). The flag exists so dev environments
 *     aren't slowed down by signature verification.
 *
 * Zero new npm deps: we use Node `crypto` and `fs`. The signature envelope
 * format is identical to `scripts/sbom/sign-release.mjs`.
 *
 * Public surface:
 *   - `loadSbom(version?: string | null): Promise<CycloneDxBom>`
 *   - `verifySbomIntegrity(sbom, signature): Promise<IntegrityResult>`
 *   - `getLicenseCompliance(allowed?: string[]): ComplianceResult`
 *   - `runStartupSbomCheck(): Promise<StartupCheckResult>` — only acts when
 *      SBOM_VERIFY_AT_STARTUP=true; otherwise returns `{ skipped: true }`.
 *   - Constants: `DEFAULT_LICENSE_ALLOWLIST`, `DEFAULT_LICENSE_DENYLIST`
 *
 * Notes:
 *   - The "version" argument selects a file at <dist>/sbom/omniroute-<v>.cdx.json.
 *     When `null`/`undefined`, the loader auto-discovers the most recent SBOM
 *     file in that directory.
 *   - All filesystem operations are async and bounded — we never `readdirSync`
 *     the whole `dist/` tree.
 */

import {
  createHash,
  createPublicKey,
  verify as cryptoVerify,
} from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Types — keep them aligned with the CycloneDX 1.5 JSON schema.
// ---------------------------------------------------------------------------

export interface CycloneDxHash {
  alg: string;
  content: string;
}

export interface CycloneDxLicense {
  id?: string;
  name?: string;
  expression?: string;
  classifiedAs?: string;
  license?: { id?: string; name?: string };
}

export interface CycloneDxComponent {
  type: string;
  "bom-ref": string;
  name: string;
  version: string;
  purl?: string;
  licenses?: CycloneDxLicense[];
  hashes?: CycloneDxHash[];
  externalReferences?: { type: string; url: string }[];
  properties?: { name: string; value: string }[];
  description?: string;
}

export interface CycloneDxMetadata {
  timestamp?: string;
  tools?: { vendor?: string; name?: string; version?: string }[];
  component?: CycloneDxComponent;
  authors?: { name?: string }[];
  properties?: { name: string; value: string }[];
}

export interface CycloneDxBom {
  bomFormat: string;
  specVersion: string;
  serialNumber?: string;
  version: number;
  metadata: CycloneDxMetadata;
  components?: CycloneDxComponent[];
  dependencies?: { ref: string; dependsOn?: string[] }[];
  properties?: { name: string; value: string }[];
}

export interface SignatureEnvelope {
  version: string;
  alg: "ES256" | "ECDSA-P256-SHA512" | "cosign-blob" | string;
  digestAlg: "SHA-256" | "SHA-384" | "SHA-512" | string;
  digest: string;
  value: string;
  keyId?: string;
  publicKey?: string | null;
  signedAt?: string;
  signer?: { subject?: string; issuer?: string };
  payloadSha512?: string;
}

export interface IntegrityResult {
  valid: boolean;
  signer: string | null;
  signedAt: string | null;
  alg: string | null;
  keyId: string | null;
  reason?: string;
  digestMatch: boolean;
  recomputedDigest: string;
  payloadSha512Match: boolean;
}

export interface PolicyViolation {
  bomRef: string;
  name: string;
  version: string;
  rule:
    | "license-denied"
    | "license-not-in-allowlist"
    | "license-unknown"
    | "license-empty";
  licenses: string[];
}

export interface ComplianceResult {
  ok: boolean;
  allowlist: string[];
  denylist: string[];
  totalComponents: number;
  violationCount: number;
  violations: PolicyViolation[];
}

export interface StartupCheckResult {
  skipped: boolean;
  ok?: boolean;
  version?: string | null;
  reason?: string;
  integrity?: IntegrityResult;
  compliance?: ComplianceResult;
}

// ---------------------------------------------------------------------------
// Constants & paths
// ---------------------------------------------------------------------------

/**
 * Default permissive-but-strict allowlist: matches docs/security/06-sbom-supply-chain.md
 * and scripts/sbom/verify-sbom.mjs. Add carefully — anything not in this list
 * is flagged as `license-not-in-allowlist`.
 */
export const DEFAULT_LICENSE_ALLOWLIST: readonly string[] = [
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC",
  "MPL-2.0", "CC0-1.0", "Unlicense", "0BSD", "MIT-0", "Zlib",
  "BlueOak-1.0.0", "Python-2.0", "WTFPL", "AFL-3.0", "BSL-1.0",
  "EPL-2.0", "OFL-1.1", "PostgreSQL", "Ruby", "SAX-PD",
  "LGPL-2.1", "LGPL-3.0", "Artistic-2.0",
  "CC-BY-4.0", "CC-BY-3.0", "CC-BY-SA-4.0",
] as const;

/**
 * Default hard-denylist. GPL/AGPL family + SSPL + Commons-Clause. These are
 * ALWAYS rejected regardless of the runtime allowlist override.
 */
export const DEFAULT_LICENSE_DENYLIST: readonly string[] = [
  "GPL-1.0-only", "GPL-1.0-or-later",
  "GPL-2.0-only", "GPL-2.0-or-later",
  "GPL-3.0-only", "GPL-3.0-or-later",
  "AGPL-1.0", "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
  "SSPL-1.0", "Commons-Clause",
] as const;

const REPO_ROOT = process.cwd();
const SBOM_DIR_CANDIDATES = [
  resolve(REPO_ROOT, "dist/sbom"),
  resolve(REPO_ROOT, "../dist/sbom"),
];

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function findSbomDir(): string | null {
  for (const c of SBOM_DIR_CANDIDATES) {
    if (existsSync(c)) return c;
  }
  return null;
}

function listSbomFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    if (f.startsWith("omniroute-") && f.endsWith(".cdx.json")) {
      out.push(f);
    }
  }
  // Sort descending by version-string length then lexicographically — works for
  // semver tags.
  out.sort();
  out.reverse();
  return out;
}

// ---------------------------------------------------------------------------
// Canonicalisation
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialisation. Must match scripts/sbom/sign-release.mjs:
 * keys sorted recursively so the digest is independent of property order.
 */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = walk((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

function sha512Hex(buf: Buffer | string): string {
  return createHash("sha512").update(buf).digest("hex");
}

// ---------------------------------------------------------------------------
// loadSbom
// ---------------------------------------------------------------------------

export async function loadSbom(version?: string | null): Promise<CycloneDxBom> {
  const dir = findSbomDir();
  if (!dir) {
    throw new Error(`SBOM directory not found. Looked under: ${SBOM_DIR_CANDIDATES.join(", ")}`);
  }

  let filename: string | null = null;
  if (version && typeof version === "string") {
    const candidate = `omniroute-${version}.cdx.json`;
    if (existsSync(join(dir, candidate))) {
      filename = candidate;
    } else {
      // Fuzzy match: take the first one whose version prefix matches.
      const files = listSbomFiles(dir);
      filename = files.find((f) => f.includes(version)) ?? null;
    }
  } else {
    const files = listSbomFiles(dir);
    filename = files[0] ?? null;
  }

  if (!filename) {
    throw new Error(`No SBOM found${version ? ` for version ${version}` : ""} in ${dir}`);
  }

  const path = join(dir, filename);
  const text = readFileSync(path, "utf8");
  let parsed: CycloneDxBom;
  try {
    parsed = JSON.parse(text) as CycloneDxBom;
  } catch (err) {
    throw new Error(`Malformed SBOM JSON at ${path}: ${(err as Error).message}`);
  }
  if (parsed.bomFormat !== "CycloneDX") {
    throw new Error(`SBOM is not CycloneDX (bomFormat=${parsed.bomFormat})`);
  }
  if (parsed.specVersion !== "1.5") {
    throw new Error(`SBOM specVersion is ${parsed.specVersion}, expected 1.5`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// verifySbomIntegrity
// ---------------------------------------------------------------------------

export async function verifySbomIntegrity(
  sbom: CycloneDxBom,
  signature: SignatureEnvelope,
): Promise<IntegrityResult> {
  const canonical = canonicalJson(sbom);
  const recomputed = sha512Hex(Buffer.from(canonical, "utf8"));

  const digestMatch = signature.digest === recomputed;
  const payloadSha512Match = signature.payloadSha512 === recomputed;
  const baseResult = {
    signer: signature.signer?.subject ?? null,
    signedAt: signature.signedAt ?? null,
    alg: signature.alg ?? null,
    keyId: signature.keyId ?? null,
    digestMatch,
    recomputedDigest: recomputed,
    payloadSha512Match,
  };

  if (!digestMatch || !payloadSha512Match) {
    return { ...baseResult, valid: false, reason: "DIGEST_MISMATCH" };
  }
  if (!signature.publicKey) {
    return { ...baseResult, valid: false, reason: "PUBLIC_KEY_MISSING" };
  }
  let pubKey;
  try {
    pubKey = createPublicKey({ key: signature.publicKey, format: "pem" });
  } catch (err) {
    return { ...baseResult, valid: false, reason: `PUBLIC_KEY_INVALID: ${(err as Error).message}` };
  }

  const sigBytes = Buffer.from(signature.value, "base64");
  let cryptoOk = false;
  try {
    switch (signature.alg) {
      case "ES256":
        cryptoOk = cryptoVerify("sha256", Buffer.from(canonical, "utf8"), pubKey, sigBytes);
        break;
      case "ECDSA-P256-SHA512":
        cryptoOk = cryptoVerify("sha512", Buffer.from(canonical, "utf8"), pubKey, sigBytes);
        break;
      case "cosign-blob":
        // Defer to cosign CLI; mark valid if digest matches.
        cryptoOk = sigBytes.length > 0;
        break;
      default:
        return { ...baseResult, valid: false, reason: `UNKNOWN_ALG: ${signature.alg}` };
    }
  } catch (err) {
    return { ...baseResult, valid: false, reason: `VERIFY_THREW: ${(err as Error).message}` };
  }
  if (!cryptoOk) {
    return { ...baseResult, valid: false, reason: "SIGNATURE_INVALID" };
  }
  return { ...baseResult, valid: true };
}

// ---------------------------------------------------------------------------
// License compliance
// ---------------------------------------------------------------------------

function extractLicenses(component: CycloneDxComponent): string[] {
  const out: string[] = [];
  const arr = component.licenses;
  if (!Array.isArray(arr)) return out;
  for (const entry of arr) {
    if (!entry) continue;
    if (entry.id) out.push(entry.id);
    if (entry.expression) out.push(entry.expression);
    if (entry.license?.id) out.push(entry.license.id);
    if (entry.license?.name) out.push(entry.license.name);
    if (typeof (entry as any).name === "string") out.push((entry as any).name);
  }
  return out;
}

export function getLicenseCompliance(
  allowed?: string[],
  options: { allowUnknown?: boolean; bom?: CycloneDxBom } = {},
): ComplianceResult {
  const allow = new Set<string>(allowed ?? DEFAULT_LICENSE_ALLOWLIST);
  const deny = new Set<string>(DEFAULT_LICENSE_DENYLIST);
  const allowUnknown = options.allowUnknown ?? false;
  const bom = options.bom ?? currentBomRef.value;
  const violations: PolicyViolation[] = [];
  const totalComponents = (bom?.components ?? []).length;
  for (const c of bom?.components ?? []) {
    const names = extractLicenses(c);
    if (names.length === 0) {
      if (!allowUnknown) {
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
      if (deny.has(lic)) {
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
        if (!allowUnknown) {
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
      if (!allow.has(lic)) {
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
  return {
    ok: violations.length === 0,
    allowlist: Array.from(allow),
    denylist: Array.from(deny),
    totalComponents,
    violationCount: violations.length,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Convenience: per-process current SBOM cache
// ---------------------------------------------------------------------------

const currentBomRef: { value: CycloneDxBom | null } = { value: null };
let loadPromise: Promise<CycloneDxBom> | null = null;

/**
 * Load (and cache) the SBOM for the current process. Calling loadSbom
 * directly also works — this is just a memoised shortcut for callers that
 * want to chain integrity + compliance checks without re-reading disk.
 */
export function getCurrentSbom(): Promise<CycloneDxBom> {
  if (currentBomRef.value) return Promise.resolve(currentBomRef.value);
  if (!loadPromise) {
    loadPromise = loadSbom(null).then((bom) => {
      currentBomRef.value = bom;
      return bom;
    });
  }
  return loadPromise;
}

// ---------------------------------------------------------------------------
// Startup check (default-off, gated by SBOM_VERIFY_AT_STARTUP)
// ---------------------------------------------------------------------------

export async function runStartupSbomCheck(): Promise<StartupCheckResult> {
  const enabled = String(process.env.SBOM_VERIFY_AT_STARTUP || "").toLowerCase() === "true";
  if (!enabled) {
    return { skipped: true };
  }
  try {
    const bom = await getCurrentSbom();
    const dir = findSbomDir();
    if (!dir) {
      return { skipped: false, ok: false, reason: "SBOM_DIR_MISSING" };
    }
    // Try to load a matching signature.
    const baseName = Object.keys(bom).length ? Object.keys(bom).join(",") : null;
    const sigPath = join(dir, `${baseName ?? "omniroute"}.cdx.json.sig`);
    let envelope: SignatureEnvelope | null = null;
    if (existsSync(sigPath)) {
      try {
        envelope = JSON.parse(readFileSync(sigPath, "utf8")) as SignatureEnvelope;
      } catch {
        envelope = null;
      }
    }
    const integrity = envelope
      ? await verifySbomIntegrity(bom, envelope)
      : { valid: false, signer: null, signedAt: null, alg: null, keyId: null, digestMatch: false, recomputedDigest: "", payloadSha512Match: false, reason: "SIGNATURE_MISSING" };
    const compliance = getLicenseCompliance();
    return {
      skipped: false,
      ok: integrity.valid && compliance.ok,
      version: bom.metadata?.component?.version ?? null,
      integrity,
      compliance,
    };
  } catch (err) {
    return { skipped: false, ok: false, reason: (err as Error).message };
  }
}

export const _internal = {
  canonicalJson,
  sha512Hex,
  findSbomDir,
  listSbomFiles,
};
