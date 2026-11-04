import fs from "node:fs";
import path from "node:path";
const {getTokenLimitsForRequest} = await import("../../../src/lib/db/tokenLimits.ts");
const {getDbInstance} = await import("../../../src/lib/db/core.ts");
const {getCurrentWindowUsage} = await import("../../../open-sse/services/tokenLimitCounter.ts");
const db = getDbInstance();
const original = db.prepare.bind(db);
const barrier = process.argv[2];
(db as any).prepare = (sql:string) => {
  if (sql.startsWith("INSERT OR IGNORE INTO api_key_token_counters")) {
    fs.writeFileSync(path.join(barrier,String(process.pid)),"ready",{flag:"wx"});
    const deadline = Date.now() + 60000;
    while (fs.readdirSync(barrier).length < 2) {
      if (Date.now() >= deadline) throw new Error("seed race barrier timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
    }
  }
  return original(sql);
};
const limit = getTokenLimitsForRequest("concurrent-seed","openai","fixture")[0];
if (getCurrentWindowUsage(limit,Date.now(),true) !== 5) throw new Error("unexpected counter");
