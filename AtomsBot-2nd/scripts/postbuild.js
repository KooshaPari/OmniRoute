#!/usr/bin/env node
// Minimal postbuild to ensure dist has an index.js that imports and runs initializeApplication
// Only runs if tsconfig.build emitted ESM without bundling.

import fs from 'fs';
import path from 'path';

const distIndex = path.join(process.cwd(), 'dist', 'index.js');

if (!fs.existsSync(distIndex)) {
  // Generate a small ESM entry that imports src/index.js build output
  // tsc will emit src/index.js to dist/src/index.js; create a top-level proxy.
  const candidate = path.join('dist', 'src', 'index.js');
  if (fs.existsSync(candidate)) {
    const content = [
      "import * as entry from './src/index.js';",
      "if (entry && typeof entry.initializeApplication === 'function' && process.env.NODE_ENV !== 'test') {",
      "  // Ensure auto-start in production start script",
      "  entry.initializeApplication();",
      "}",
      "export * from './src/index.js';",
      "export default entry;",
      ""
    ].join('\n');
    fs.writeFileSync(distIndex, content, 'utf8');
    console.log('[postbuild] Created dist/index.js proxy to dist/src/index.js');
  } else {
    console.warn('[postbuild] dist/src/index.js not found; nothing to do.');
  }
} else {
  // If exists, do nothing.
}

