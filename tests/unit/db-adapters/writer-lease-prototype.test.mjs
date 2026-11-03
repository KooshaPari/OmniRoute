import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { acquireWriterLease } from './writer-lease-prototype.mjs';

const moduleUrl = new URL('./writer-lease-prototype.mjs', import.meta.url).href;
const run = (source, ...args) => spawnSync(process.execPath, ['--input-type=module', '-e', source, ...args], { encoding: 'utf8', timeout: 10000 });

test('lease excludes cooperating processes, releases after crash, and does not fence bypass', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omni-lease-prototype-'));
  const lease = join(dir, 'lease.sqlite');
  const data = join(dir, 'data.sqlite');
  const db = new DatabaseSync(data);
  db.exec('CREATE TABLE witness (value INTEGER)');
  db.close();
  const holder = spawn(process.execPath, ['--input-type=module', '-e', `import { acquireWriterLease } from ${JSON.stringify(moduleUrl)}; acquireWriterLease(process.argv[1]); console.log('ready'); setInterval(() => {}, 1000);`, lease], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('holder did not become ready')), 10000);
      holder.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      holder.once('error', reject);
      holder.once('exit', code => reject(new Error(`holder exited ${code}`)));
    });
    const attempt = `import { acquireWriterLease } from ${JSON.stringify(moduleUrl)}; const release = acquireWriterLease(process.argv[1]); release();`;
    assert.notEqual(run(attempt, lease).status, 0, 'second cooperating writer must fail');
    const bypass = run(`import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync(process.argv[1]); db.exec('INSERT INTO witness VALUES (1)'); db.close();`, data);
    assert.equal(bypass.status, 0, bypass.stderr);
    holder.kill();
    await new Promise(resolve => holder.once('exit', resolve));
    const afterCrash = run(attempt, lease);
    assert.equal(afterCrash.status, 0, afterCrash.stderr);
  } finally {
    if (holder.exitCode === null && holder.signalCode === null) holder.kill();
  }
});
