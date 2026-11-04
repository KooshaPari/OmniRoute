import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(),"omni-counter-presence-"));
const { upsertTokenLimit, resetWindowIfElapsed, incrementWindowTokens } = await import("../../src/lib/db/tokenLimits.ts");
const { getCurrentWindowUsage, clearTokenLimitCache } = await import("../../open-sse/services/tokenLimitCounter.ts");
const { saveRequestUsage } = await import("../../src/lib/usage/usageHistory.ts");
const { getDbInstance } = await import("../../src/lib/db/core.ts");
async function fixture(key:string, now:number) {
  const limit = upsertTokenLimit({apiKeyId:key,scopeType:"global",tokenLimit:1000,resetInterval:"daily"});
  await saveRequestUsage({timestamp:new Date(now).toISOString(),provider:"openai",model:"fixture",apiKeyId:key,tokens:{input:5,output:0}});
  clearTokenLimitCache();
  return limit;
}
test("absent counter seeds from history", {skip:process.platform === "win32"}, async () => {
  const now = Date.now();
  const limit = await fixture("presence-absent",now);
  assert.equal(getCurrentWindowUsage(limit,now,true),5);
});
test("existing zero is not seeded", {skip:process.platform === "win32"}, async () => {
  const now = Date.now();
  const limit = await fixture("presence-zero",now);
  incrementWindowTokens(limit.id,resetWindowIfElapsed(limit,now).windowStart,0);
  assert.equal(getCurrentWindowUsage(limit,now,true),0);
});
test("existing nonzero is unchanged", {skip:process.platform === "win32"}, async () => {
  const now = Date.now();
  const limit = await fixture("presence-nonzero",now);
  incrementWindowTokens(limit.id,resetWindowIfElapsed(limit,now).windowStart,2);
  assert.equal(getCurrentWindowUsage(limit,now,true),2);
});
test("failed seed insert propagates without creating a counter", {skip:process.platform === "win32"}, async () => {
  const now = Date.now();
  const limit = await fixture("presence-failure",now);
  const db = getDbInstance();
  db.exec("CREATE TRIGGER deny_seed BEFORE INSERT ON api_key_token_counters BEGIN SELECT RAISE(ABORT, 'seed denied'); END");
  try {
    assert.throws(()=>getCurrentWindowUsage(limit,now,true),/seed denied/);
    assert.equal((db.prepare("SELECT count(*) n FROM api_key_token_counters WHERE limit_id = ?").get(limit.id) as {n:number}).n,0);
  } finally { db.exec("DROP TRIGGER deny_seed"); }
});


test("cached empty window rechecks missing row after history arrives", {skip:process.platform === "win32"}, async () => {
  const now = Date.now();
  const key = "presence-cached-empty";
  const limit = upsertTokenLimit({apiKeyId:key,scopeType:"global",tokenLimit:1000,resetInterval:"daily"});
  clearTokenLimitCache();
  assert.equal(getCurrentWindowUsage(limit,now,true),0);
  await saveRequestUsage({timestamp:new Date().toISOString(),provider:"openai",model:"fixture",apiKeyId:key,tokens:{input:5,output:0}});
  assert.equal(getCurrentWindowUsage(limit,now,true),5);
});
