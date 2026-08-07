import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  new Response(JSON.stringify({ status: "ok", service: "argismonitor-renderer" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
