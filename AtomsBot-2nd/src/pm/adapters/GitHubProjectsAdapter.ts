import { PMIssue, PMProviderAdapter, PMTransition } from '../interfaces';
import { secretsStore } from '../../settings/SecretsStore';

async function ghGraphQL(query: string, variables?: any) {
  const token = (await secretsStore.get('gh_projects_token')) || process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || '';
  if (!token) throw new Error('GitHub Projects token not set');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`GitHub GraphQL error ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'GitHub GraphQL error');
  return json.data;
}

export class GitHubProjectsAdapter implements PMProviderAdapter {
  getLabel() { return 'GitHub Projects'; }
  async isConfigured() { return !!((await secretsStore.get('gh_projects_project_id')) || process.env.GH_PROJECTS_PROJECT_ID); }
  async createIssue(input: { title: string; description?: string }): Promise<PMIssue> {
    const projectId = (await secretsStore.get('gh_projects_project_id')) || process.env.GH_PROJECTS_PROJECT_ID;
    const query = `mutation($input: AddProjectV2DraftIssueInput!) { addProjectV2DraftIssue(input: $input) { projectItem { id } } }`;
    const data = await ghGraphQL(query, { input: { projectId, title: input.title, body: input.description || '' } });
    const id = data?.addProjectV2DraftIssue?.projectItem?.id || `GHPJ-${Date.now()}`;
    return { key: id, title: input.title, description: input.description, provider: 'github_projects' };
  }
  async linkExisting(key: string): Promise<PMIssue | null> { return { key, provider: 'github_projects' }; }
  async addComment(itemId: string, body: string): Promise<void> {
    // Append to a configured Text field used for notes/comments
    const projectId = (await secretsStore.get('gh_projects_project_id')) || process.env.GH_PROJECTS_PROJECT_ID;
    const notesFieldId = (await secretsStore.get('gh_projects_notes_field_id')) || process.env.GH_PROJECTS_NOTES_FIELD_ID;
    if (!projectId || !notesFieldId) return; // silently ignore if not configured
    let existing = '';
    try {
      const q0 = `query($itemId:ID!){ node(id:$itemId){ ... on ProjectV2Item { fieldValues(first:50){ nodes { __typename ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { id name } } } } } } } }`;
      const d0 = await ghGraphQL(q0, { itemId });
      const nodes = d0?.node?.fieldValues?.nodes || [];
      const row = nodes.find((n: any) => n?.field?.id === notesFieldId);
      existing = String(row?.text || '');
    } catch {}
    const next = existing ? `${existing}\n${body}` : body;
    const q = `mutation($projectId:ID!, $itemId:ID!, $fieldId:ID!, $text:String!) { updateProjectV2ItemFieldValue(input:{ projectId:$projectId, itemId:$itemId, fieldId:$fieldId, value:{ text:$text } }) { projectV2Item { id } } }`;
    await ghGraphQL(q, { projectId, itemId, fieldId: notesFieldId, text: next });
  }
  async transitionIssue(itemId: string, transitionName: string) {
    const projectId = (await secretsStore.get('gh_projects_project_id')) || process.env.GH_PROJECTS_PROJECT_ID;
    const fieldId = (await secretsStore.get('gh_projects_status_field_id')) || process.env.GH_PROJECTS_STATUS_FIELD_ID;
    const optionsJson = (await secretsStore.get('gh_projects_status_options_json')) || process.env.GH_PROJECTS_STATUS_OPTIONS_JSON || '{}';
    let options: Record<string,string> = {};
    try { options = JSON.parse(optionsJson || '{}'); } catch {}
    const optionId = options[transitionName] || options[transitionName.toLowerCase()] || options[transitionName.toUpperCase()];
    if (!projectId || !fieldId || !optionId) return { ok: false, error: 'status field not configured' };
    const q = `mutation($projectId:ID!, $itemId:ID!, $fieldId:ID!, $optionId:String!) { updateProjectV2ItemFieldValue(input:{ projectId:$projectId, itemId:$itemId, fieldId:$fieldId, value:{ singleSelectOptionId:$optionId } }) { projectV2Item { id } } }`;
    await ghGraphQL(q, { projectId, itemId, fieldId, optionId });
    return { ok: true, transitionUsed: transitionName };
  }
  async getTransitions(_key: string): Promise<PMTransition[]> {
    const optionsJson = (await secretsStore.get('gh_projects_status_options_json')) || process.env.GH_PROJECTS_STATUS_OPTIONS_JSON || '{}';
    try {
      const obj = JSON.parse(optionsJson || '{}') as Record<string,string>;
      return Object.keys(obj).map(name => ({ id: obj[name], name }));
    } catch { return []; }
  }
  async assignIssueAccountId(_key: string, _accountId: string) { return true; }
  async getIssue(key: string): Promise<PMIssue | null> { return { key, provider: 'github_projects' }; }
  async deleteIssue(_key: string): Promise<boolean> { return true; }
}
