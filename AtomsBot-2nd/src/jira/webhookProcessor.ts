import { logger } from '../logger';

export interface JiraWebhookPayload {
  webhookEvent: string;
  issue?: any;
  user?: any;
  comment?: any;
  changelog?: any;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a Jira webhook payload
 */
export function validateWebhookPayload(payload: any): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'Invalid payload format' };
  }

  if (!payload.webhookEvent || typeof payload.webhookEvent !== 'string') {
    return { isValid: false, error: 'Missing or invalid webhookEvent' };
  }

  // For issue-related events, require issue object
  if (payload.webhookEvent.startsWith('jira:issue_') && !payload.issue) {
    return { isValid: false, error: 'Missing issue object for issue event' };
  }

  // For comment events, require comment object
  if (payload.webhookEvent.startsWith('comment_') && !payload.comment) {
    return { isValid: false, error: 'Missing comment object for comment event' };
  }

  return { isValid: true };
}

/**
 * Validates webhook event types
 */
export function validateWebhookEventType(eventType: any): boolean {
  if (typeof eventType !== 'string' || eventType.length === 0) {
    return false;
  }

  const validEventTypes = [
    'jira:issue_created',
    'jira:issue_updated',
    'jira:issue_deleted',
    'comment_created',
    'comment_updated',
    'comment_deleted',
    'issue_property_set',
    'issue_property_deleted',
    'worklog_created',
    'worklog_updated',
    'worklog_deleted',
  ];

  return validEventTypes.includes(eventType);
}

/**
 * Validates user information in webhooks
 */
export function validateUserInfo(user: any): boolean {
  if (!user || typeof user !== 'object') {
    return false;
  }

  return !!(user.accountId && user.displayName);
}

/**
 * Validates webhook signatures
 */
export function validateWebhookSignature(signature: any): boolean {
  if (typeof signature !== 'string' || signature.length === 0) {
    return false;
  }

  return /^(sha1|sha256)=.+$/.test(signature);
}

/**
 * Processes a Jira webhook with basic validation
 */
export async function processJiraWebhook(payload: any, options: any = {}): Promise<boolean> {
  try {
    const validation = validateWebhookPayload(payload);
    if (!validation.isValid) {
      logger.error(`Invalid webhook payload: ${validation.error}`);
      return false;
    }

    // Basic processing logic
    logger.info(`Processing webhook event: ${payload.webhookEvent}`);
    
    // If a callback is provided, call it
    if (options && typeof options === 'function') {
      await options(payload);
    }
    
    return true;
  } catch (error) {
    logger.error(`Webhook processing error: ${error}`);
    // Re-throw the error so retry logic can handle it
    throw error;
  }
}

/**
 * Processes a Jira webhook with retry logic
 */
export async function processJiraWebhookWithRetry(
  payload: any, 
  optionsOrCallback: { maxRetries?: number; retryDelay?: number; callback?: Function } | Function = {}
): Promise<boolean> {
  // Handle both function and options object signatures
  let options: { maxRetries?: number; retryDelay?: number; callback?: Function };
  if (typeof optionsOrCallback === 'function') {
    options = { callback: optionsOrCallback };
  } else {
    options = optionsOrCallback;
  }

  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;
  const callback = options.callback;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await processJiraWebhook(payload, callback);
      if (result) {
        if (attempt > 1) {
          logger.info(`Webhook processing succeeded after retry (attempt ${attempt})`);
        }
        return true;
      }
      
      if (attempt < maxRetries) {
        logger.info(`Webhook processing attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    } catch (error) {
      if (attempt < maxRetries) {
        logger.info(`Webhook processing attempt ${attempt} failed with error, retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        logger.error(`Webhook processing failed after ${maxRetries} attempts: ${error}`);
        return false;
      }
    }
  }

  return false;
}

/**
 * Formats Jira message for Discord with length limits
 */
export function formatJiraMessageForDiscord(payload: any, options: any = {}): any {
  const maxLength = options.maxLength || 2000;
  let description = payload.description || payload.issue?.fields?.description || '';

  if (description.length > maxLength) {
    description = description.substring(0, maxLength - 10) + '...[truncated]';
  }

  const result = {
    content: payload.content || '',
    description,
    iconUrl: payload.iconUrl || payload.issue?.fields?.issuetype?.iconUrl,
    issueType: payload.issueType || payload.issue?.fields?.issuetype?.name,
  };

  // If a callback is provided, call it with the result
  if (options && typeof options === 'function') {
    options(result);
  } else if (options && options.callback && typeof options.callback === 'function') {
    options.callback(result);
  }

  return result;
}

/**
 * Formats user mentions for Discord
 */
export function formatUserMentionsForDiscord(content: string, userMappings: Record<string, string>): string {
  let formattedContent = content;

  // Replace Jira user mentions with Discord mentions
  Object.entries(userMappings).forEach(([jiraUser, discordUser]) => {
    const mentionPattern = new RegExp(`\\[~${jiraUser}\\]`, 'g');
    formattedContent = formattedContent.replace(mentionPattern, `<@${discordUser}>`);
  });

  return formattedContent;
}

/**
 * Formats Jira message for Discord with user mentions
 */
export function formatJiraMessageWithMentions(payload: any, userMappings: Record<string, string>, options: any = {}): any {
  const maxLength = options.maxLength || 2000;
  let content = payload.content || payload.comment?.body || '';
  let description = payload.description || payload.issue?.fields?.description || '';

  // Format user mentions in content
  content = formatUserMentionsForDiscord(content, userMappings);

  if (description.length > maxLength) {
    description = description.substring(0, maxLength - 10) + '...[truncated]';
  }

  const result = {
    content,
    description,
    iconUrl: payload.iconUrl || payload.issue?.fields?.issuetype?.iconUrl,
    issueType: payload.issueType || payload.issue?.fields?.issuetype?.name,
  };

  // If a callback is provided, call it with the result
  if (options && typeof options === 'function') {
    options(result);
  }

  return result;
}