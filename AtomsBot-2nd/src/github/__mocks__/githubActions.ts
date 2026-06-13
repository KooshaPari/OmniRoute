import { vi } from 'vitest';

export const octokit = {
  rest: {
    issues: {
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      addLabels: vi.fn(),
      listLabelsOnIssue: vi.fn(),
      removeLabel: vi.fn(),
      createComment: vi.fn(),
    },
  },
} as any;

export const repoCredentials = { owner: 'owner', repo: 'repo' };
export const ensureOctokitAuthFromDb = vi.fn();
export const refreshDefaultRepoFromDb = vi.fn();
export const getRepoCredentialsForThread = vi.fn().mockReturnValue(repoCredentials);
export const ensureThreadRepoBinding = vi.fn();
export const ensureThreadIssueIdentifiers = vi.fn();

