import { bffUrl } from "$lib/server/bff";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const BFF_ROUTE_FAMILIES = new Set(["auth", "dashboard", "trpc"]);
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function proxyHeaders(
  request: Request,
  url: URL,
  getClientAddress?: () => string
): Headers {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "x-request-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
  headers.set("x-forwarded-host", url.host);
  const clientAddress = getClientAddress?.();
  if (clientAddress) headers.set("x-forwarded-for", clientAddress);
  return headers;
}

function proxyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  const connectionHeaders = new Set(
    (source.get("connection") ?? "")
      .split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean)
  );
  source.forEach((value, name) => {
    const normalizedName = name.toLowerCase();
    if (
      normalizedName !== "set-cookie" &&
      !HOP_BY_HOP_HEADERS.has(normalizedName) &&
      !connectionHeaders.has(normalizedName)
    ) {
      headers.set(name, value);
    }
  });

  type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };
  const getSetCookie = (source as HeadersWithSetCookie).getSetCookie;
  const cookies = getSetCookie
    ? getSetCookie.call(source)
    : [source.get("set-cookie")].filter((cookie): cookie is string => cookie !== null);
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return headers;
}

async function proxyToBff(
  { params, request, fetch, getClientAddress, url }: Parameters<RequestHandler>[0],
  method: "GET" | "POST" | "PUT" | "DELETE"
): Promise<Response> {
  const [family] = params.path.split("/");
  if (!BFF_ROUTE_FAMILIES.has(family)) error(404, "API route not found");

  const target = bffUrl(`/api/${params.path}`);
  target.search = url.search;
  const response = await fetch(target, {
    method,
    headers: proxyHeaders(request, url, getClientAddress),
    body: method === "GET" ? undefined : await request.arrayBuffer(),
  });

  return new Response(response.body, {
    status: response.status,
    headers: proxyResponseHeaders(response.headers),
  });
}

export const GET: RequestHandler = (event) => proxyToBff(event, "GET");
export const POST: RequestHandler = (event) => proxyToBff(event, "POST");
export const PUT: RequestHandler = (event) => proxyToBff(event, "PUT");
export const DELETE: RequestHandler = (event) => proxyToBff(event, "DELETE");
