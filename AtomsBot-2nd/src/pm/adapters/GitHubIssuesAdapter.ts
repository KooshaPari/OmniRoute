import { PMIssue, PMProviderAdapter, PMTransition } from '../interfaces';
import { octokit, repoCredentials } from '../../github/githubActions';

export class GitHubIssuesAdapter implements PMProviderAdapter {
  getLabel() { return 'GitHub'; }
  async isConfigured() { return true; }

  async createIssue(input: { title: string; description?: string }): Promise<PMIssue> {
    const { owner, repo } = repoCredentials;
    const resp = await octokit.rest.issues.create({ owner, repo, title: input.title, body: input.description || '' });
    return { key: String(resp.data.number), url: resp.data.html_url, title: input.title, description: input.description };
  }
  async linkExisting(key: string): Promise<PMIssue | null> {
    const { owner, repo } = repoCredentials;
    const num = Number(String(key).replace('#',''));
    const resp = await octokit.rest.issues.get({ owner, repo, issue_number: num });
    return { key: String(num), url: resp.data.html_url, title: resp.data.title, description: resp.data.body ?? undefined, status: resp.data.state };
  }
  async addComment(key: string, body: string): Promise<void> {
    const { owner, repo } = repoCredentials;
    const num = Number(String(key).replace('#',''));
    await octokit.rest.issues.createComment({ owner, repo, issue_number: num, body });
  }
  // GitHub Issues transitions via state changes can be simulated with comments/labels; leaving as not implemented
  async transitionIssue(_key: string, _transitionName: string) { return { ok: false, error: 'not_supported' }; }
  async getTransitions(_key: string): Promise<PMTransition[]> { return []; }
  async assignIssueAccountId(_key: string, _accountId: string) { return false; }
  async getIssue(key: string): Promise<PMIssue | null> { return this.linkExisting(key); }
  async deleteIssue(key: string): Promise<boolean> {
    // GitHub Issues cannot be truly deleted via API; we can close instead
    const { owner, repo } = repoCredentials;
    const num = Number(String(key).replace('#',''));
    await octokit.rest.issues.update({ owner, repo, issue_number: num, state: 'closed' });
    return true;
  }
}
