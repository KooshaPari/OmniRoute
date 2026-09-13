import { Hono } from "hono";

/**
 * Batch 4 BFF routes — Skills.
 *
 * Covers:
 *   - GET /api/dashboard/skills/agent-skills  agent skills
 *   - GET /api/dashboard/skills/omni-skills    omni skills
 */
export const skillsRoutes = new Hono()

  // GET /api/dashboard/skills/agent-skills
  .get("/agent-skills", (c) => c.json({ skills: [] }))

  // GET /api/dashboard/skills/omni-skills
  .get("/omni-skills", (c) => c.json({ skills: [] }));