import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Agent management.
 *
 * Covers:
 *   - GET /api/dashboard/agents/cloud        cloud agents
 *   - GET /api/dashboard/agents/acp          ACP agents
 *   - GET /api/dashboard/agents/cli          CLI agents
 *   - GET /api/dashboard/agents/cli/:id      CLI agent detail
 *   - GET /api/dashboard/agents/cli-code     CLI code agents
 *   - GET /api/dashboard/agents/cli-code/:id CLI code agent detail
 */
export const agentsRoutes = new Hono()

  // GET /api/dashboard/agents/cloud
  .get("/cloud", (c) => c.json({ agents: [] }))

  // GET /api/dashboard/agents/acp
  .get("/acp", (c) => c.json({ agents: [] }))

  // GET /api/dashboard/agents/cli
  .get("/cli", (c) => c.json({ agents: [] }))

  // GET /api/dashboard/agents/cli/:id
  .get("/cli/:id", (c) => {
    const id = c.req.param("id");
    return c.json({ id, name: `CLI Agent ${id}` });
  })

  // GET /api/dashboard/agents/cli-code
  .get("/cli-code", (c) => c.json({ agents: [] }))

  // GET /api/dashboard/agents/cli-code/:id
  .get("/cli-code/:id", (c) => {
    const id = c.req.param("id");
    return c.json({ id, name: `CLI Code Agent ${id}` });
  });