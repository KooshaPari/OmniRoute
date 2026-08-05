import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  Response.json({
    status: "ok",
    service: "argismonitor-renderer",
  });
