import { bffUrl } from "$lib/server/bff";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const BFF_ROUTE_FAMILIES = new Set(["auth", "dashboard", "trpc"]);

function proxyHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function proxyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  const contentType = source.get("content-type");
  headers.set("content-type", contentType ?? "application/json");

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
  { params, request, fetch, url }: Parameters<RequestHandler>[0],
  method: "GET" | "POST"
): Promise<Response> {
  const [family] = params.path.split("/");
  if (!BFF_ROUTE_FAMILIES.has(family)) error(404, "API route not found");

  const target = bffUrl(`/api/${params.path}`);
  target.search = url.search;
  const response = await fetch(target, {
    method,
    headers: proxyHeaders(request),
    body: method === "POST" ? await request.arrayBuffer() : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: proxyResponseHeaders(response.headers),
  });
}

export const GET: RequestHandler = (event) => proxyToBff(event, "GET");
export const POST: RequestHandler = (event) => proxyToBff(event, "POST");
