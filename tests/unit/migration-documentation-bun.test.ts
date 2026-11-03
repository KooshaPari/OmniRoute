Warning: truncated output (original token count: 612)
Total output lines: 68

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBunSqliteAdapter } from "../../s…512 tokens truncated…prepare("SELECT count(*) AS n FROM _omniroute_migrations WHERE version = '201'")
          .get() as {
          n: number;
        }
      ).n,
      0
    );
  } finally {
    db.close();
  }
});
