import { syncOrchestrator } from '../Orchestrator';

export async function processLinearWebhook(payload: any) {
  try {
    const type = payload?.type || payload?.action;
    const issue = payload?.data || payload?.issue;
    if (type === 'Issue.created' && issue) {
      await syncOrchestrator.handleEvent({ source: 'linear', type: 'created', title: issue?.title, description: issue?.description });
    } else if (type === 'Comment.created' && issue && payload?.comment) {
      await syncOrchestrator.handleEvent({ source: 'linear', type: 'commented', key: issue?.identifier || issue?.id, comment: payload.comment?.body });
    }
  } catch {}
}

