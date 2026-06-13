import { syncOrchestrator } from '../Orchestrator';

export async function processJiraWebhook(payload: any) {
  try {
    const issue = payload?.issue;
    const changelog = payload?.changelog;
    if (payload?.webhookEvent === 'jira:issue_created' && issue) {
      await syncOrchestrator.handleEvent({ source: 'jira', type: 'created', title: issue?.fields?.summary, description: issue?.fields?.description });
    } else if (payload?.webhookEvent === 'comment_created' && issue && payload?.comment) {
      await syncOrchestrator.handleEvent({ source: 'jira', type: 'commented', key: issue.key, comment: payload.comment?.body });
    } else if (changelog) {
      const transition = changelog?.items?.find((i: any) => i.field === 'status')?.toString;
      if (transition && issue?.key) await syncOrchestrator.handleEvent({ source: 'jira', type: 'transitioned', key: issue.key, transition });
    }
  } catch {}
}

