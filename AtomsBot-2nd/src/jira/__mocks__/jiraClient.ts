import { vi } from 'vitest';

export const jiraService = {
  createIssue: vi.fn(),
  getIssue: vi.fn(),
  updateIssue: vi.fn(),
  transitionIssue: vi.fn(),
  addComment: vi.fn(),
  assignIssue: vi.fn(),
  isConfigured: vi.fn(),
} as any;

