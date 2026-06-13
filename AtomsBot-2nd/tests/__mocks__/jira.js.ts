/**
 * Vitest Mock for jira.js
 * 
 * This file is automatically loaded by Vitest when jira.js is imported
 * in any test file.
 */

import jiraMocks from "../mocks/jira";

// Re-export Jira mock
export const { Version3Client } = jiraMocks;

// Set as default export
export default jiraMocks;