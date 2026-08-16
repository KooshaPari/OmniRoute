import test from "node:test";
import assert from "node:assert/strict";

test("logger imports without a data-path initialization cycle", async () => {
  const previousLogToFile = process.env.APP_LOG_TO_FILE;
  process.env.APP_LOG_TO_FILE = "false";

  try {
    const loggerModule = await import("../../src/shared/utils/logger.ts");

    assert.equal(typeof loggerModule.logger.info, "function");
    assert.equal(typeof loggerModule.createLogger("import-cycle-test").warn, "function");
  } finally {
    if (previousLogToFile === undefined) {
      delete process.env.APP_LOG_TO_FILE;
    } else {
      process.env.APP_LOG_TO_FILE = previousLogToFile;
    }
  }
});
