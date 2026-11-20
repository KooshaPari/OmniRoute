import base from "./vitest.config";
const cfg: any = base as any;
export default {
  ...cfg,
  test: {
    ...cfg.test,
    include: [
      "src/sse/handlers/__tests__/chatCombosCache.test.ts",
      "src/sse/handlers/__tests__/chatCooldown.helpers.test.ts",
    ],
    retry: 0,
    maxWorkers: 2,
  },
};
