export type PMKey = string;

export interface PMIssue {
  key: PMKey; // Jira key or Linear id or Projects item id
  url?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  // Canonical provider identifier for this issue (e.g., 'jira' | 'linear' | 'github_projects' | 'coda' | 'atoms')
  provider?: string;
}

export interface PMTransition {
  id: string;
  name: string;
}

export interface PMProviderAdapter {
  isConfigured(): Promise<boolean> | boolean;
  getLabel(): string;

  createIssue(input: { title: string; description?: string }): Promise<PMIssue>;
  linkExisting(key: PMKey): Promise<PMIssue | null>;
  addComment(key: PMKey, body: string): Promise<void>;
  transitionIssue?(key: PMKey, transitionName: string): Promise<{ ok: boolean; transitionUsed?: string; error?: string }>;
  getTransitions?(key: PMKey): Promise<PMTransition[]>;
  assignIssueAccountId?(key: PMKey, accountId: string): Promise<boolean>;
  getIssue?(key: PMKey): Promise<PMIssue | null>;
  deleteIssue?(key: PMKey): Promise<boolean>;
}

