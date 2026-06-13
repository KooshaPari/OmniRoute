import { PMIssue, PMProviderAdapter, PMTransition } from '../interfaces';
import { jiraService } from '../../jira/jiraClient';

export class JiraAdapter implements PMProviderAdapter {
  getLabel() { return 'Jira'; }
  async isConfigured() { return jiraService.isConfigured(); }

  async createIssue(input: { title: string; description?: string }): Promise<PMIssue> {
    const issue = await jiraService.createIssue({ summary: input.title, description: input.description || '', issueType: 'Story' });
    return { key: issue.key, url: issue.self, title: input.title, description: input.description, provider: 'jira' };
  }

  async linkExisting(key: string): Promise<PMIssue | null> {
    const issue = await jiraService.getIssue(key);
    if (!issue) return null;
    return { key, url: issue?.self, title: issue?.fields?.summary, description: issue?.fields?.description, status: issue?.fields?.status?.name, provider: 'jira' } as any;
  }
  async addComment(key: string, body: string): Promise<void> {
    await jiraService.addComment(key, body);
  }
  async transitionIssue(key: string, transitionName: string) {
    const res = await jiraService.transitionIssue?.(key, transitionName);
    if (res?.ok) return { ok: true, transitionUsed: res.transitionUsed };
    return { ok: false, error: res?.error || 'transition failed' };
  }
  async getTransitions(key: string): Promise<PMTransition[]> {
    const list = await jiraService.getTransitions(key);
    return list.map((t: any) => ({ id: t.id, name: t.name }));
  }
  async assignIssueAccountId(key: string, accountId: string) {
    return await jiraService.assignIssueAccountId?.(key, accountId);
  }
  async getIssue(key: string): Promise<PMIssue | null> {
    const issue = await jiraService.getIssue(key);
    if (!issue) return null;
    return { key, url: issue?.self, title: issue?.fields?.summary, description: issue?.fields?.description, status: issue?.fields?.status?.name, provider: 'jira' } as any;
  }
  async deleteIssue(key: string): Promise<boolean> {
    const deleted = await jiraService.deleteIssue?.(key);
    return !!deleted;
  }
}
