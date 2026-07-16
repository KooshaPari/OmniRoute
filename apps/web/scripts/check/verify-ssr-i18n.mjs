import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = '44321';
const server = spawn(process.execPath, ['build/index.js'], {
  cwd: new URL('../..', import.meta.url),
  env: { ...process.env, HOST: '127.0.0.1', PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
server.stderr.setEncoding('utf8');
server.stderr.on('data', (chunk) => {
  stderr += chunk;
});

try {
  let response;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) break;
    try {
      response = await fetch(`http://127.0.0.1:${port}/`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  assert.ok(response, `adapter-node did not start (exit ${server.exitCode}): ${stderr}`);
  const html = await response.text();
  assert.equal(response.status, 200, `SSR returned ${response.status}: ${html}`);
  assert.match(html, /Welcome to argismonitor v4/);
  assert.match(html, />Dashboard</);
  assert.doesNotMatch(html, /\$state is not defined/);
} finally {
  server.kill();
}
