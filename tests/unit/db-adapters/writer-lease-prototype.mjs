// Experiment only: all writers must participate before this can fence recovery.
import { DatabaseSync } from 'node:sqlite';

export function acquireWriterLease(leasePath) {
  const db = new DatabaseSync(leasePath, { timeout: 0 });
  try {
    db.exec('BEGIN IMMEDIATE');
  } catch (error) {
    db.close();
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try { db.exec('ROLLBACK'); } finally { db.close(); }
  };
}
