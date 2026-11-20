import test from "node:test";
import assert from "node:assert/strict";
import { assessUsage185, USAGE_185_SHA256 } from "../../scripts/db/migration-usage185-assessment.mjs";
const input = { appliedName: "provider_param_filters", diskName: "usage_history_cpa_auth_index", sha256: USAGE_185_SHA256, tableExists: true, columns: [] };
test("missing column is a non-authorizing recovery candidate", () => {
  assert.deepEqual(assessUsage185(input), {state:"missing_column_requires_recovery",authorized:false});
});
test("identity mismatch, absent table and malformed present column block", () => {
  for (const altered of [{ appliedName:"other" }, {diskName:"other"}, {sha256:"0"}]) assert.equal(assessUsage185({...input,...altered}).state,"blocked_identity");
  assert.equal(assessUsage185({...input,tableExists:false}).state,"blocked_missing_table");
  assert.equal(assessUsage185({...input,columns:[{name:"cpa_auth_index",type:"INTEGER",notnull:0,dflt_value:null,pk:0}]}).state,"blocked_column_mismatch");
});
test("a matching physical column remains unverified and never authorizes a write", () => {
  assert.deepEqual(assessUsage185({...input,columns:[{name:"cpa_auth_index",type:"TEXT",notnull:0,dflt_value:null,pk:0}]}),{state:"column_present_unverified",authorized:false});
});
