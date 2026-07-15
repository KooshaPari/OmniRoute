import { listProxies } from "@/lib/localDb";
import {
<<<<<<< Updated upstream
  handleProxyCreate,
  handleProxyDelete,
  handleProxyUpdate,
  resolveProxyLookupResponse,
} from "@/lib/api/proxyRegistryRouteHandlers";
import { createErrorResponseFromUnknown } from "@/lib/api/errorResponse";
=======
  createProxy,
  deleteProxyById,
  getProxyById,
  getProxyWhereUsed,
  listProxies,
  updateProxy,
} from "@/lib/localDb";
import { createProxyRegistrySchema, updateProxyRegistrySchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { createErrorResponse, createErrorResponseFromUnknown } from "@/lib/api/errorResponse";
>>>>>>> Stashed changes
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

function toPagination(searchParams: URLSearchParams) {
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(searchParams.get("offset") || 0));
  return { limit, offset };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const lookupResponse =
      (await resolveProxyLookupResponse(searchParams, "whereUsed")) ||
      (await resolveProxyLookupResponse(searchParams, "where_used"));
    if (lookupResponse) return lookupResponse;

    const { limit, offset } = toPagination(searchParams);
    const items = await listProxies({ includeSecrets: false });
    const paged = items.slice(offset, offset + limit);
    return Response.json({
      items: paged,
      page: { limit, offset, total: items.length },
    });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to load proxies");
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
<<<<<<< Updated upstream
  return handleProxyCreate(request);
=======

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createErrorResponse({
      status: 400,
      message: "Invalid JSON body",
      type: "invalid_request",
    });
  }

  try {
    const validation = validateBody(createProxyRegistrySchema, rawBody);
    if (isValidationFailure(validation)) {
      return createErrorResponse({
        status: 400,
        message: validation.error.message,
        details: validation.error.details,
        type: "invalid_request",
      });
    }

    const created = await createProxy(validation.data);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to create proxy");
  }
>>>>>>> Stashed changes
}

export async function PATCH(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
<<<<<<< Updated upstream
  return handleProxyUpdate(request);
=======

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createErrorResponse({
      status: 400,
      message: "Invalid JSON body",
      type: "invalid_request",
    });
  }

  try {
    const validation = validateBody(updateProxyRegistrySchema, rawBody);
    if (isValidationFailure(validation)) {
      return createErrorResponse({
        status: 400,
        message: validation.error.message,
        details: validation.error.details,
        type: "invalid_request",
      });
    }

    const { id, ...changes } = validation.data;
    const updated = await updateProxy(id, changes);
    if (!updated) {
      return createErrorResponse({ status: 404, message: "Proxy not found", type: "not_found" });
    }

    return Response.json(updated);
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to update proxy");
  }
>>>>>>> Stashed changes
}

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return handleProxyDelete(request);
}
