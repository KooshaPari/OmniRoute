import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { getBatch } from "@/lib/localDb";
import { NextResponse } from "next/server";
import { getApiKeyRequestScope } from "@/app/api/v1/_helpers/apiKeyScope";
import { formatBatchResponse } from "../formatBatchResponse";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await getApiKeyRequestScope(request);
  if (scope.rejection) return scope.rejection;
  const apiKeyId = scope.apiKeyId;

  const { id } = await params;
  const batch = getBatch(id);

  if (!batch || (batch.apiKeyId !== null && batch.apiKeyId !== apiKeyId)) {
    return NextResponse.json(
      { error: { message: "Batch not found", type: "invalid_request_error" } },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(formatBatchResponse(batch), { headers: CORS_HEADERS });
}
