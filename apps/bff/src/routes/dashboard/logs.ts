import { Hono } from "hono";

/**
 * Batch 3 BFF routes — Logs dashboard.
 *
 *   - GET  /               activity + recent logs
 *   - GET  /activity       activity feed
 *   - GET  /console        console output
 *   - GET  /proxy          proxy log stream
 *   - GET  /timeline       timeline entries
 */
export const logsRoutes = new Hono()

  .get("/", (c) => {
    const logs = [
      { ts: new Date().toISOString(), level: "info", service: "bff", message: "Ready" },
    ];
    return c.json({ logs, total: 1 });
  })

  .get("/activity", (c) => {
    return c.json({
      activity: [
        { ts: new Date().toISOString(), action: "health_check", status: "ok" },
      ],
      total: 1,
    });
  })

  .get("/console", (c) => {
    return c.json({
      entries: [
        { ts: new Date().toISOString(), level: "info", message: "BFF server started" },
      ],
      total: 1,
    });
  })

  .get("/proxy", (c) => {
    return c.json({
      entries: [
        { ts: new Date().toISOString(), path: "/api/v1/proxy", status: 200, latencyMs: 12 },
      ],
      total: 1,
    });
  })

  .get("/timeline", (c) => {
    return c.json({
      entries: [
        { ts: new Date().toISOString(), event: "heartbeat", detail: "all systems nominal" },
      ],
      total: 1,
    });
  });
