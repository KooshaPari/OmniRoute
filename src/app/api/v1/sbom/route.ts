/**
 * src/app/api/v1/sbom/route.ts
 *
 * GET /api/v1/sbom?version=<v>
 *
 * Returns the CycloneDX 1.5 SBOM for the requested version. Defaults to the
 * most recent SBOM in dist/sbom/.
 *
 * Auth model:
 *   - This endpoint exposes the inventory of every dependency shipped with the
 *     release. By default we require a bearer token, read from
 *     `OMNIROUTE_SBOM_API_TOKEN`. If the env var is unset, the endpoint
 *     falls back to allowing any caller in development (NODE_ENV !== 'production')
 *     and rejects otherwise. This matches the security stance of the rest of
 *     the v1 API surface — public metadata, controlled mutation.
 *
 * Response shape (200):
 *   {
 *     version: string,
 *     bomFormat: 'CycloneDX',
 *     specVersion: '1.5',
 *     serialNumber: string,
 *     timestamp: string,
 *     componentCount: number,
 *     signatureAvailable: boolean,
 *     bom: CycloneDxBom
 *   }
 *
 * Error shape (4xx/5xx):
 *   { error: string, code?: string, hint?: string }
 */

import { NextResponse } from "next/server";
import {
  loadSbom,
  type CycloneDxBom,
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

function findSigPath(version: string | null): string | null {
  if (!version) return null;
  const dir = SBOM_DIR_CANDIDATES.find((p) => existsSync(p));
  if (!dir) return null;
  const sig = resolve(dir, `omniroute-${version}.cdx.json.sig`);
  return existsSync(sig) ? sig : null;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(request: Request) {
  const authz = isAuthorized(request);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const url = new URL(request.url);
  const versionParam = url.searchParams.get("version");
  const includeBom = url.searchParams.get("includeBom") !== "false";

  let bom: CycloneDxBom;
  try {
    bom = await loadSbom(versionParam);
  } catch (err) {
    return NextResponse.json(
      {
        error: "sbom_not_found",
        hint: (err as Error).message,
      },
      { status: 404 },
    );
  }

  const sigPath = findSigPath(bom.metadata?.component?.version ?? versionParam);
  let signatureAvailable = false;
  let signatureDigest: string | null = null;
  if (sigPath) {
    signatureAvailable = true;
    try {
      const sig = JSON.parse(readFileSync(sigPath, "utf8")) as { digest?: string };
      signatureDigest = sig.digest ?? null;
    } catch {
      signatureDigest = null;
    }
  }

  const summary = {
    version: bom.metadata?.component?.version ?? null,
    bomFormat: bom.bomFormat,
    specVersion: bom.specVersion,
    serialNumber: bom.serialNumber ?? null,
    timestamp: bom.metadata?.timestamp ?? null,
    componentCount: (bom.components ?? []).length,
    signatureAvailable,
    signatureDigest,
  };

  return NextResponse.json(
    includeBom
      ? { ...summary, bom }
      : { ...summary, _links: { bom: "/api/v1/sbom?includeBom=true" } },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Omniroute-SBOM-Spec": bom.specVersion,
        "X-Omniroute-SBOM-Version": bom.metadata?.component?.version ?? "",
      },
    },
  );
}
