import { PMIssue, PMProviderAdapter, PMTransition } from '../interfaces';
import { getLinearConfig } from '../../settings/ProviderResolver';

async function linearGraphQL(query: string, variables?: any) {
  const { apiKey } = await getLinearConfig();
  if (!apiKey) throw new Error('Linear not configured');
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`Linear API error ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Linear GraphQL error');
  return json.data;
}

export class LinearAdapter implements PMProviderAdapter {
  getLabel() { return 'Linear'; }
  async isConfigured() { const { apiKey } = await getLinearConfig(); return !!apiKey; }

  async createIssue(input: { title: string; description?: string }): Promise<PMIssue> {
    const { teamId } = await getLinearConfig();
    const query = `mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url title } } }`;
    const variables = { input: { title: input.title, description: input.description || '', teamId } } as any;
    const data = await linearGraphQL(query, variables);
    const issue = data?.issueCreate?.issue;
    const key = issue?.identifier || issue?.id;
    return { key, url: issue?.url, title: issue?.title, description: input.description, provider: 'linear' };
  }
  async linkExisting(key: string): Promise<PMIssue | null> {
    const query = `query Issue($id: String!) { issue(id: $id) { id identifier url title state { name } } }`;
    const data = await linearGraphQL(query, { id: key });
    const issue = data?.issue;
    if (!issue) return null;
    return { key: issue.identifier || issue.id, url: issue.url, title: issue.title, status: issue.state?.name, provider: 'linear' };
  }
  async addComment(key: string, body: string): Promise<void> {
    const query = `mutation CommentCreate($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`;
    await linearGraphQL(query, { input: { issueId: key, body } });
  }
  async transitionIssue(key: string, transitionName: string) {
    // Map transitionName to a stateId and update
    try {
      const q = `query Issue($id: String!) { issue(id: $id) { id team { states { nodes { id name } } } } }`;
      const data = await linearGraphQL(q, { id: key });
      const nodes = data?.issue?.team?.states?.nodes || [];
      const target = nodes.find((n: any) => String(n?.name).toLowerCase() === String(transitionName).toLowerCase());
      const fallback = nodes.find((n: any) => /done|complete|closed/i.test(String(n?.name)));
      const stateId = target?.id || fallback?.id;
      if (!stateId) return { ok: false, error: 'state not found' };
      const mu = `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
      await linearGraphQL(mu, { id: key, input: { stateId } });
      return { ok: true, transitionUsed: transitionName };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }
  async getTransitions(key: string): Promise<PMTransition[]> {
    const query = `query Issue($id: String!) { issue(id: $id) { id state { name } team { states { nodes { id name } } } } }`;
    const data = await linearGraphQL(query, { id: key });
    const nodes = data?.issue?.team?.states?.nodes || [];
    return nodes.map((n: any) => ({ id: n.id, name: n.name }));
  }
  async assignIssueAccountId(key: string, accountId: string) {
    // accountId may be an id or email; if email, attempt lookup
    let assigneeId = accountId;
    if (/@/.test(accountId)) {
      const q = `query Users($q: String!) { users(filter: { query: $q }) { nodes { id email } } }`;
      try {
        const d = await linearGraphQL(q, { q: accountId });
        assigneeId = d?.users?.nodes?.[0]?.id || accountId;
      } catch {}
    }
    const mu = `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`;
    await linearGraphQL(mu, { id: key, input: { assigneeId } });
    return true;
  }
  async getIssue(key: string): Promise<PMIssue | null> { return this.linkExisting(key); }
  async deleteIssue(_key: string): Promise<boolean> { return true; }
}
