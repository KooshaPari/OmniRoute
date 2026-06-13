/**
 * Vitest Mock for winston
 * 
 * This file is automatically loaded by Vitest when winston is imported
 * in any test file. It provides a complete winston mock implementation.
 */

import winstonMocks from "../mocks/winston";

// Re-export all winston mocks
export const {
  createLogger,
  format,
  transports,
  Logger,
  error,
  warn,
  info,
  http,
  verbose,
  debug,
  silly,
  log,
  levels,
  configure,
  add,
  remove,
  clear,
  profile,
  startTimer,
  query,
  stream,
  close,
  handleExceptions,
  unhandleExceptions,
  handleRejections,
  unhandleRejections,
  Container,
  logform,
  version,
  child
} = winstonMocks;

// Set as default export
export default winstonMocks;