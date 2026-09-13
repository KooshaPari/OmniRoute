import { Hono } from "hono";

/**
 * Batch 3 BFF routes — Activity dashboard.
 *
 *   - GET  /  activity feed
 */
export const activityRoutes = new Hono()

  .get("/", (c) => {
    return c.json({
      items: [
        { ts: new Date().toISOString(), action: "session_start", detail: "user authenticated" },
        { ts: new Date().toISOString(), action: "tool_call", detail: "dashboard view" },
      ],
    });
  });
