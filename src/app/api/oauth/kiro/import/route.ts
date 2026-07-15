import { NextResponse } from "next/server";
import { KiroService } from "@/lib/oauth/services/kiro";
import { createProviderConnection, isCloudEnabled, resolveProxyForProvider } from "@/models";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { syncToCloud } from "@/lib/cloudSync";
import { kiroImportSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { runWithProxyContext } from "@omniroute/open-sse/utils/proxyFetch.ts";

/**
 * POST /api/oauth/kiro/import
 * Import and validate refresh token from Kiro IDE
 */
export async function POST(request: any) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetProvider = searchParams.get("targetProvider") === "amazon-q" ? "amazon-q" : "kiro";
    const validation = validateBody(kiroImportSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
<<<<<<< Updated upstream
    const { refreshToken, region, clientId, clientSecret, authMethod, profileArn } =
      validation.data;
=======
    const { refreshToken } = validation.data;
>>>>>>> Stashed changes

    const kiroService = new KiroService();

    // Resolve proxy for this provider (provider-level → global → direct)
    const proxy = await resolveProxyForProvider(targetProvider);

<<<<<<< Updated upstream
    // For IDC tokens the client already has OIDC client credentials extracted from the
    // SSO cache registration file by auto-import (#2059). Refresh directly via the
    // regional OIDC endpoint without calling registerClient() again. For social /
    // Builder-ID tokens (no clientId) use validateImportToken() which handles
    // registerClient() internally to obtain an isolated refresh session (#2328).
    const isIdc = !!(clientId && clientSecret);
    let tokenData: Awaited<ReturnType<typeof kiroService.validateImportToken>>;
    if (isIdc) {
      const providerSpecificData = {
        clientId,
        clientSecret,
        region: region || "us-east-1",
        authMethod: "idc",
      };
      const refreshed = await runWithProxyContext(proxy, () =>
        kiroService.refreshToken(refreshToken.trim(), providerSpecificData)
      );
      tokenData = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || refreshToken.trim(),
        expiresIn: refreshed.expiresIn || 3600,
        profileArn: profileArn || null,
        authMethod: "idc",
        clientId,
        clientSecret,
      } as any;
    } else {
      // Validate and refresh token (through proxy if configured).
      // validateImportToken also calls registerClient() to obtain a per-connection OIDC
      // client pair so multiple Kiro accounts do not share a single backend session (#2328).
      tokenData = await runWithProxyContext(proxy, () =>
        kiroService.validateImportToken(refreshToken.trim(), region)
      );
    }
=======
    // Validate and refresh token (through proxy if configured)
    const tokenData = await runWithProxyContext(proxy, () =>
      kiroService.validateImportToken(refreshToken.trim())
    );
>>>>>>> Stashed changes

    // Extract email from JWT if available
    const email = kiroService.extractEmailFromJWT(tokenData.accessToken);

    const resolvedAuthMethod = isIdc ? "idc" : (tokenData as any).authMethod || "imported";
    const resolvedProfileArn = (tokenData as any).profileArn || null;

    // Save to database
    const connection: any = await createProviderConnection({
      provider: targetProvider,
      authType: "oauth",
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || refreshToken.trim(),
      expiresAt: new Date(Date.now() + (tokenData.expiresIn || 3600) * 1000).toISOString(),
      email: email || null,
      providerSpecificData: {
<<<<<<< Updated upstream
        profileArn: resolvedProfileArn,
        authMethod: resolvedAuthMethod,
        provider: isIdc ? "Enterprise" : "Imported",
        ...(tokenData.clientId
          ? {
              clientId: tokenData.clientId,
              clientSecret: tokenData.clientSecret,
              region: region || "us-east-1",
              ...(tokenData.clientSecretExpiresAt
                ? { clientSecretExpiresAt: tokenData.clientSecretExpiresAt }
                : {}),
            }
          : {}),
=======
        profileArn: tokenData.profileArn,
        authMethod: "imported",
        provider: "Imported",
>>>>>>> Stashed changes
      },
      testStatus: "active",
    });

    // Auto sync to Cloud if enabled
    await syncToCloudIfEnabled();

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
      },
    });
  } catch (error: any) {
    console.log("Kiro-compatible import token error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync to Cloud if enabled
 */
async function syncToCloudIfEnabled() {
  try {
    const cloudEnabled = await isCloudEnabled();
    if (!cloudEnabled) return;

    const machineId = await getConsistentMachineId();
    await syncToCloud(machineId);
  } catch (error) {
    console.log("Error syncing to cloud after Kiro import:", error);
  }
}
