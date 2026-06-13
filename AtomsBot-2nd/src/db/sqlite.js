// Optional runtime stub for shadow DB. Safe no-ops for bundling.

export async function openDatabase(_opts = {}) {
  return {
    prepare(_sql) {
      return {
        async run() {},
        finalize() {},
      };
    },
    async close() {},
  };
}

export async function ensureSchema(_db) {
  // no-op
}

export async function upsertJiraLink(_db, _entry) {
  // no-op
}

export async function upsertGitHubLink(_db, _entry) {
  // no-op
}
