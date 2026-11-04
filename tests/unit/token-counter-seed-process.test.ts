import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(),"omni-seed-process-"));
const { upsertTokenLimit, getWindowUsage } = await import("../../src/lib/db/tokenLimits.ts");
const { saveRequestUsage } = await import("../../src/lib/usage/usageHistory.ts");
test("two processes cold seed without duplicate addition", {skip:process.platform === "win32",timeout:180000}, async () => {
  const limit = upsertTokenLimit({apiKeyId:"concurrent-seed",scopeType:"global",tokenLimit:1000,resetInterval:"daily"});
  await saveRequestUsage({timestamp:new Date().toISOString(),provider:"openai",model:"fixture",apiKeyId:"concurrent-seed",tokens:{input:5,output:0}});
  const barrier = fs.mkdtempSync(path.join(os.tmpdir(),"omni-seed-barrier-"));
  const run = () => new Promise<void>((resolve,reject)=>{
    const child = spawn(process.execPath,["--import","tsx/esm","tests/fixtures/usage-outbox/counter-seed-worker.ts",barrier],{cwd:process.cwd(),env:process.env,stdio:"pipe"});
    let errors = "";
    child.stderr.on("data",chunk=>errors+=String(chunk));
    child.once("error",reject);
    child.once("exit",code=>code === 0 ? resolve() : reject(new Error(`worker exited ${code}: ${errors}`)));
  });
  await Promise.all([run(),run()]);
  assert.equal(fs.readdirSync(barrier).length,2);
  assert.equal(getWindowUsage(limit),5);
});
