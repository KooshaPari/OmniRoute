/**
 * Vitest Mock for @octokit/rest
 * 
 * This file is automatically loaded by Vitest when @octokit/rest is imported
 * in any test file.
 */

import githubMocks from "../mocks/github";

// Re-export Octokit mock
export const { Octokit } = githubMocks;

// Set as default export
export default githubMocks;