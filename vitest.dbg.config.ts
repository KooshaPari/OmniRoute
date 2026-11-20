import base from "./vitest.config";
const c: any = base as any;
export default { ...c, test: { ...c.test, include: ["src/sse/handlers/__tests__/_dbg.test.ts"], retry: 0, maxWorkers: 1 } };
