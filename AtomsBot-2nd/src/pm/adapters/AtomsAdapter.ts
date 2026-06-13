import { PMIssue, PMProviderAdapter, PMTransition } from '../interfaces';

export class AtomsAdapter implements PMProviderAdapter {
  getLabel() { return 'Atoms'; }
  async isConfigured() { return !!process.env.ATOMS_API_KEY || false; }
  async createIssue(input: { title: string; description?: string }): Promise<PMIssue> {
    return { key: `ATOMS-${Date.now()}`, title: input.title, description: input.description, provider: 'atoms' };
  }
  async linkExisting(key: string): Promise<PMIssue | null> { return { key, provider: 'atoms' }; }
  async addComment(_key: string, _body: string): Promise<void> {}
  async transitionIssue(_key: string, _transitionName: string) { return { ok: true, transitionUsed: _transitionName }; }
  async getTransitions(_key: string): Promise<PMTransition[]> { return []; }
  async assignIssueAccountId(_key: string, _accountId: string) { return true; }
  async getIssue(key: string): Promise<PMIssue | null> { return { key, provider: 'atoms' }; }
  async deleteIssue(_key: string): Promise<boolean> { return true; }
}

