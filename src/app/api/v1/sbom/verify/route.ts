/**
 * src/app/api/v1/sbom/verify/route.ts
 *
 * POST /api/v1/sbom/verify
 *
 * Verifies a signature for an uploaded (or referenced) SBOM and returns the
 * verification + license-compliance report.
 *
 * Body shapes accepted:
 *   1. JSON: { sbom: CycloneDxBom, signature: SignatureEnvelope,
 *              allowUnknown?: boolean }
 *   2. JSON: { sbomPath: string, signaturePath: string,
 *              allowUnknown?: boolean }
 *      (paths are resolved relative to dist/sbom; absolute paths are also ok)
 *
 * Auth: same model as /api/v1/sbom — OMNIROUTE_SBOM_API_TOKEN bearer, or
 *       dev-open when unset and NODE_ENV !== 'production'.
 *
 * Response (200):
 *   {
 *     ok: boolean,
 *     integrity: IntegrityResult,
 *     compliance: ComplianceResult,
 *     summary: { version, componentCount, serialNumber, timestamp }
 *   }
 *
 * Response (4xx):
 *   { error: string, hint?: string }
 */

import { NextResponse } from "next/server";
import {
  getLicenseCompliance,
  verifySbomIntegrity,
  type CycloneDxBom,
  type IntegrityResult,
  type ComplianceResult,
  type SignatureEnvelope,
} from "@/lib/security/sbomLoader";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

const SBOM_DIR_CANDIDATES = [
  resolve(process.cwd(), "dist/sbom"),
  resolve(process.cwd(), "../dist/sbom"),
];

function isAuthorized(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.OMNIROUTE_SBOM_API_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 503, error: "SBOM endpoint not configured (set OMNIROUTE_SBOM_API_TOKEN)" };
    }
    return { ok: true };
  }
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (!bearer || !constantTimeEqual(bearer, expected)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

interface VerifyRequestBody {
  sbom?: CycloneDxBom;
  signature?: SignatureEnvelope;
  sbomPath?: string;
  signaturePath?: string;
  allowUnknown?: boolean;
}

function resolvePathSafe(p: string): string | null {
  if (!p) return null;
  const abs = resolve(p);
  if (!existsSync(abs)) return null;
  return abs;
}

function resolveUnderSbomDir(p: string): string | null {
  if (!p) return null;
  for (const dir of SBOM_DIR_CANDIDATES) {
    const abs = resolve(dir, p);
    if (existsSync(abs)) return abs;
  }
  return resolvePathSafe(p);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: Request) {
  const authz = isAuthorized(request);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  let body: VerifyRequestBody;
  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_json", hint: (err as Error).message },
      { status: 400 },
    );
  }

  let bom: CycloneDxBom | null = body.sbom ?? null;
  let envelope: SignatureEnvelope | null = body.signature ?? null;

  if ((!bom || !envelope) && body.sbomPath) {
    const sbomAbs = resolveUnderSbomDir(body.sbomPath);
    if (!sbomAbs) {
      return NextResponse.json(
        { error: "sbom_path_not_found", hint: body.sbomPath },
        { status: 404 },
      );
    }
    try {
      bom = JSON.parse(readFileSync(sbomAbs, "utf8")) as CycloneDxBom;
    } catch (err) {
      return NextResponse.json(
        { error: "sbom_path_unreadable", hint: (err as Error).message },
        { status: 400 },
      );
    }
  }
  if (!envelope && body.signaturePath) {
    const sigAbs = resolveUnderSbomDir(body.signaturePath);
    if (!sigAbs) {
      return NextResponse.json(
        { error: "signature_path_not_found", hint: body.signaturePath },
        { status: 404 },
      );
    }
    try {
      envelope = JSON.parse(readFileSync(sigAbs, "utf8")) as SignatureEnvelope;
    } catch (err) {
      return NextResponse.json(
        { error: "signature_path_unreadable", hint: (err as Error).message },
        { status: 400 },
      );
    }
  }

  if (!bom) {
    return NextResponse.json(
      { error: "missing_sbom", hint: "Provide { sbom } or { sbomPath }" },
      { status: 400 },
    );
  }
  if (!envelope) {
    return NextResponse.json(
      { error: "missing_signature", hint: "Provide { signature } or { signaturePath }" },
      { status: 400 },
    );
  }

  let integrity: IntegrityResult;
  try {
    integrity = await verifySbomIntegrity(bom, envelope);
  } catch (err) {
    return NextResponse.json(
      { error: "integrity_check_threw", hint: (err as Error).message },
      { status: 400 },
    );
  }

  const compliance: ComplianceResult = getLicenseCompliance(undefined, {
    allowUnknown: body.allowUnknown === true,
    bom,
  });

  return NextResponse.json(
    {
      ok: integrity.valid && compliance.ok,
      integrity,
      compliance,
      summary: {
        version: bom.metadata?.component?.version ?? null,
        componentCount: (bom.components ?? []).length,
        serialNumber: bom.serialNumber ?? null,
        timestamp: bom.metadata?.timestamp ?? null,
      },
    },
    {
      status: integrity.valid ? 200 : 422,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
