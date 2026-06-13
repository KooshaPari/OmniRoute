import { logger } from "../logger";
import { integrations, env } from "../env";
import { getGraphqlWithAuth, octokit } from "./githubActions";

export interface GHProjectItem {
  id: string;
  title: string;
  url?: string;
  number?: number; // not always applicable to project items
}

export interface CreateProjectItemData {
  summary: string;
  description?: string;
  priority?: string;
  assignee?: string; // GitHub login
  labels?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateProjectItemData extends Partial<CreateProjectItemData> {}

async function getProjectNodeId(): Promise<string | null> {
  const cfg = integrations.githubProjects.getConfig();
  if (cfg.projectId) return cfg.projectId;
  if (!cfg.org || !cfg.projectNumber) return null;
  const graphql = getGraphqlWithAuth();
  const data: any = await graphql(
    `query($org: String!, $number: Int!) {
      organization(login: $org) { projectV2(number: $number) { id title } }
    }`,
    { org: cfg.org, number: parseInt(String(cfg.projectNumber), 10) },
  );
  return data?.organization?.projectV2?.id || null;
}

export class GitHubProjectsService {
  private token?: string;
  constructor() {
    const cfg = integrations.githubProjects.getConfig();
    this.token = cfg.token;
  }

  async listProjects(limit: number = 50): Promise<Array<{ id: string; title: string; number?: number }>> {
    try {
      if (!this.isConfigured()) return [];
      const cfg = integrations.githubProjects.getConfig();
      const org = cfg.org;
      if (!org) return [];
      const graphql = getGraphqlWithAuth();
      const data: any = await graphql(`query($org:String!,$n:Int!){ organization(login:$org){ projectsV2(first:$n){ nodes{ id title number } } } }`, { org, n: Math.max(1, Math.min(100, limit)) });
      const nodes = data?.organization?.projectsV2?.nodes || [];
      return nodes.map((p: any) => ({ id: p.id, title: p.title, number: p.number }));
    } catch { return []; }
  }

  async getLinkedIssue(itemId: string): Promise<{ owner: string; repo: string; number: number } | null> {
    try {
      const graphql = getGraphqlWithAuth();
      const data: any = await graphql(`query($id: ID!) { node(id:$id){ ... on ProjectV2Item { content { __typename ... on Issue { number repository { owner { login } name } } } } } }`, { id: itemId });
      const issue = data?.node?.content;
      const owner = issue?.repository?.owner?.login;
      const repo = issue?.repository?.name;
      const number = issue?.number;
      if (!owner || !repo || !number) return null;
      return { owner, repo, number };
    } catch { return null; }
  }

  async listIssueComments(itemId: string, limit: number = 10): Promise<Array<{ id: number; body: string; user?: string; createdAt?: string }>> {
    try {
      const linked = await this.getLinkedIssue(itemId);
      if (!linked) return [];
      const res = await (octokit as any).rest.issues.listComments({ owner: linked.owner, repo: linked.repo, issue_number: linked.number, per_page: Math.max(1, Math.min(100, limit)) });
      const arr: any[] = res?.data || [];
      return arr.map(c => ({ id: c.id, body: c.body || '', user: c.user?.login, createdAt: c.created_at }));
    } catch { return []; }
  }

  async listRecentItems(limit: number = 25): Promise<Array<{ id: string; title: string; url?: string; updatedAt?: string }>> {
    try {
      if (!this.isConfigured()) return [];
      const projectId = await getProjectNodeId();
      if (!projectId) return [];
      const graphql = getGraphqlWithAuth();
      // Fetch recent items; GraphQL for Projects v2 returns items but not always ordered; request first 50 and slice
      const data: any = await graphql(
        `query($id: ID!, $n: Int!) {
          node(id: $id) {
            ... on ProjectV2 {
              items(first: $n) {
                nodes {
                  id
                  updatedAt
                  content { __typename ... on Issue { title url updatedAt } ... on DraftIssue { title } }
                }
              }
            }
          }
        }`,
        { id: projectId, n: Math.max(5, Math.min(100, limit * 2)) },
      );
      const nodes: any[] = data?.node?.items?.nodes || [];
      const out = nodes.map((n: any) => ({
        id: n?.id,
        title: n?.content?.title || '(untitled)',
        url: n?.content?.url,
        updatedAt: n?.content?.updatedAt || n?.updatedAt,
      }));
      // Order by updatedAt desc if present
      out.sort((a, b) => (Date.parse(b.updatedAt || '0') - Date.parse(a.updatedAt || '0')));
      return out.slice(0, Math.max(1, Math.min(100, limit)));
    } catch {
      return [];
    }
  }

  isConfigured(): boolean {
    return !!(this.token && integrations.githubProjects.isConfigured());
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const graphql = getGraphqlWithAuth();
      await graphql(`query { viewer { login } }`);
      logger.info("GitHub Projects connection test successful");
      return true;
    } catch (e) {
      logger.error(`GitHub Projects connection test failed: ${e}`);
      return false;
    }
  }

  async createIssue(data: CreateProjectItemData): Promise<GHProjectItem | null> { // parity with Jira "createIssue"
    if (!this.isConfigured()) return null;
    const projectId = await getProjectNodeId();
    if (!projectId) return null;
    const graphql = getGraphqlWithAuth();
    const mutation = `mutation($projectId: ID!, $title: String!) {
      createProjectV2Item(input: { projectId: $projectId, content: null }) {
        item { id }
      }
    }`;
    // Create an empty item first, then set fields via field mutations
    const res: any = await graphql(mutation, { projectId, title: data.summary });
    const itemId = res?.createProjectV2Item?.item?.id;
    if (!itemId) return null;

    // Set Title field (Projects v2 supports a Title field as a text field)
    await this.setTextField(projectId, itemId, 'Title', data.summary).catch(() => undefined);
    if (data.description) await this.setTextField(projectId, itemId, 'Description', data.description).catch(() => undefined);
    if (data.priority) await this.setSingleSelectField(projectId, itemId, 'Priority', data.priority).catch(() => undefined);
    if (data.assignee) await this.setAssignee(projectId, itemId, data.assignee).catch(() => undefined);

    return { id: itemId, title: data.summary };
  }

  async getIssue(itemId: string): Promise<GHProjectItem | null> {
    if (!this.isConfigured()) return null;
    const graphql = getGraphqlWithAuth();
    const data: any = await graphql(`query($id: ID!) { node(id: $id) { ... on ProjectV2Item { id fieldValueByName(name: "Title") { ... on ProjectV2ItemFieldTextValue { text } } } } }`, { id: itemId });
    const node = data?.node;
    if (!node) return null;
    const title = node?.fieldValueByName?.text || '';
    return { id: itemId, title };
  }

  async updateIssue(itemId: string, data: UpdateProjectItemData): Promise<GHProjectItem | null> {
    if (!this.isConfigured()) return null;
    const projectId = await getProjectNodeId();
    if (!projectId) return null;
    if (data.summary) await this.setTextField(projectId, itemId, 'Title', data.summary).catch(() => undefined);
    if (data.description !== undefined) await this.setTextField(projectId, itemId, 'Description', data.description || '').catch(() => undefined);
    if (data.priority !== undefined) await this.setSingleSelectField(projectId, itemId, 'Priority', String(data.priority)).catch(() => undefined);
    if (data.assignee !== undefined) await this.setAssignee(projectId, itemId, data.assignee || '').catch(() => undefined);
    const updated = await this.getIssue(itemId);
    return updated;
  }

  async deleteIssue(itemId: string): Promise<boolean> {
    const projectId = await getProjectNodeId();
    if (!projectId) return false;
    const graphql = getGraphqlWithAuth();
    const mutation = `mutation($projectId: ID!, $itemId: ID!) { deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) { deletedItemId } }`;
    const res: any = await graphql(mutation, { projectId, itemId });
    return !!res?.deleteProjectV2Item?.deletedItemId;
  }

  async assignIssueAccountId(itemId: string, login: string): Promise<boolean> {
    const projectId = await getProjectNodeId();
    if (!projectId) return false;
    return this.setAssignee(projectId, itemId, login).then(() => true).catch(() => false);
  }

  async unassignIssue(itemId: string): Promise<boolean> {
    const projectId = await getProjectNodeId();
    if (!projectId) return false;
    // Clear assignees
    return this.setAssignee(projectId, itemId, '').then(() => true).catch(() => false);
  }

  async getTransitions(_itemId: string): Promise<Array<{ id: string; name: string }>> {
    // Map Status single-select options as pseudo transitions
    try {
      const projectId = await getProjectNodeId();
      if (!projectId) return [];
      const graphql = getGraphqlWithAuth();
      const data: any = await graphql(`query($id: ID!) { node(id: $id) { ... on ProjectV2 { fields(first: 50) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } } } } }`, { id: projectId });
      const fields = data?.node?.fields?.nodes || [];
      const status = fields.find((f: any) => f?.name?.toLowerCase() === 'status');
      const opts = status?.options || [];
      return opts.map((o: any) => ({ id: o.id, name: o.name }));
    } catch {
      return [];
    }
  }

  async transitionIssue(itemId: string, optionId: string): Promise<boolean> {
    const projectId = await getProjectNodeId();
    if (!projectId) return false;
    const graphql = getGraphqlWithAuth();
    const mutation = `mutation($projectId: ID!, $itemId: ID!, $field: String!, $optionId: String!) {
      set_status: updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldName: $field, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } }
    }`;
    await graphql(mutation, { projectId, itemId, field: 'Status', optionId });
    return true;
  }

  /**
   * Add a comment to a Projects item when the content is a linked Issue.
   * Falls back to no-op (true) for draft items.
   */
  async addComment(itemId: string, body: string): Promise<boolean> {
    try {
      const graphql = getGraphqlWithAuth();
      const data: any = await graphql(`query($id: ID!) { node(id:$id){ ... on ProjectV2Item { content { __typename ... on Issue { url number repository { owner { login } name } } } } } }`, { id: itemId });
      const issue = data?.node?.content;
      if (!issue || issue.__typename !== 'Issue') return true; // draft or other content; ignore
      const owner = issue?.repository?.owner?.login;
      const repo = issue?.repository?.name;
      const number = issue?.number;
      if (!owner || !repo || !number) return true;
      await octokit.rest.issues.createComment({ owner, repo, issue_number: number, body });
      return true;
    } catch {
      return false;
    }
  }

  async resolveIssue(itemId: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    const transitions = await this.getTransitions(itemId);
    const target = transitions.find(t => /done|complete|closed/i.test(t.name)) || transitions[0];
    if (!target) return { success: false, error: 'No statuses available' };
    const success = await this.transitionIssue(itemId, target.id);
    return { success, transitionUsed: target.name, error: success ? undefined : 'Transition failed' };
  }

  async closeIssue(itemId: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    return this.resolveIssue(itemId);
  }

  async reopenIssue(itemId: string): Promise<{ success: boolean; transitionUsed?: string; error?: string }> {
    const transitions = await this.getTransitions(itemId);
    const target = transitions.find(t => /todo|backlog|in progress|triage|open/i.test(t.name)) || transitions[0];
    if (!target) return { success: false, error: 'No statuses available' };
    const success = await this.transitionIssue(itemId, target.id);
    return { success, transitionUsed: target.name, error: success ? undefined : 'Transition failed' };
  }

  async setSprintField(_itemId: string, _sprintId: string): Promise<boolean> {
    // Map to Iteration field if present – not implemented here
    return true;
  }

  private async setTextField(projectId: string, itemId: string, fieldName: string, value: string) {
    const graphql = getGraphqlWithAuth();
    const mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldName: String!, $text: String!) {
      updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldName: $fieldName, value: { text: $text } }) { projectV2Item { id } }
    }`;
    await graphql(mutation, { projectId, itemId, fieldName, text: value });
  }

  private async setSingleSelectField(projectId: string, itemId: string, fieldName: string, optionName: string) {
    const graphql = getGraphqlWithAuth();
    const fields: any = await graphql(`query($id: ID!) { node(id: $id) { ... on ProjectV2 { fields(first: 50) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } } } } } }`, { id: projectId });
    const nodes = fields?.node?.fields?.nodes || [];
    const field = nodes.find((f: any) => f?.name?.toLowerCase() === fieldName.toLowerCase());
    if (!field) return;
    const opt = (field.options || []).find((o: any) => o.name.toLowerCase() === optionName.toLowerCase()) || field.options?.[0];
    if (!opt) return;
    const mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldName: String!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldName: $fieldName, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } }
    }`;
    await graphql(mutation, { projectId, itemId, fieldName, optionId: opt.id });
  }

  private async setAssignee(projectId: string, itemId: string, login: string) {
    const graphql = getGraphqlWithAuth();
    // Set Assignees field. If login empty, clear assignments by passing empty array
    const users = login ? await graphql(`query($login: String!) { user(login: $login) { id } }`, { login }).catch(() => ({ user: null })) : { user: null };
    const userId = users?.user?.id;
    const mutation = `mutation($projectId: ID!, $itemId: ID!, $userIds: [ID!]) {
      updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldName: "Assignees", value: { userIds: $userIds } }) { projectV2Item { id } }
    }`;
    await graphql(mutation, { projectId, itemId, userIds: userId ? [userId] : [] });
  }
}

export const githubProjectsService = new GitHubProjectsService();
