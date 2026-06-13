import { PMIssue, PMProviderAdapter, PMTransition } from '../interfaces';

export class CodaAdapter implements PMProviderAdapter {
  getLabel() { return 'Coda'; }
  async isConfigured() { return !!(process.env.CODA_API_TOKEN && process.env.CODA_DOC_ID); }
  async createIssue(input: { title: string; description?: string }): Promise<PMIssue> {
    // Mirror-only: no canonical creation, return pseudo key
    return { key: `CODA-${Date.now()}`, title: input.title, description: input.description, provider: 'coda' };
  }
  async linkExisting(key: string): Promise<PMIssue | null> { return { key, provider: 'coda' }; }
  async addComment(_key: string, _body: string): Promise<void> {}
  async transitionIssue(_key: string, _transitionName: string) { return { ok: true, transitionUsed: _transitionName }; }
  async getTransitions(_key: string): Promise<PMTransition[]> { return []; }
  async assignIssueAccountId(_key: string, _accountId: string) { return true; }
  async getIssue(key: string): Promise<PMIssue | null> { return { key, provider: 'coda' }; }
  async deleteIssue(_key: string): Promise<boolean> { return true; }
}

