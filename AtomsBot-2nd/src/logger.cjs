// CommonJS shim to support `require('../logger')` in tests
// Delegates to the TypeScript module via Vitest/Vite transform
module.exports = require('./logger.ts');

