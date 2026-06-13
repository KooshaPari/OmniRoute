# Forum to Issue Commands

This document describes the new Discord commands that allow you to create GitHub issues and Jira tickets directly from forum posts.

## Commands Overview

### `/create-issue-from-forum` - Create GitHub Issue from Forum Post

Creates a GitHub issue from the current forum thread, extracting the content and discussion.

**Usage:**
- Must be used within a Discord forum thread
- Automatically extracts the forum post title and content
- Includes thread discussion by default
- Generates appropriate labels based on forum context

**Options:**
- `title` (optional): Override the issue title (uses forum post title by default)
- `labels` (optional): Comma-separated labels to add (e.g., 'bug,frontend,high-priority')
- `include-thread` (optional): Include all thread messages in the issue body (default: true)

**Example:**
```
/create-issue-from-forum title:"Login page not loading" labels:"bug,frontend,urgent"
```

### `/create-jira-from-forum` - Create Jira Issue from Forum Post

Creates a Jira issue from the current forum thread with full Jira integration.

**Usage:**
- Must be used within a Discord forum thread
- Requires Jira integration to be configured
- Automatically formats content for Jira markup
- Links back to the original Discord thread

**Options:**
- `title` (optional): Override the issue title (uses forum post title by default)
- `issue-type` (optional): Jira issue type (Bug, Story, Task, Sub-task, Epic)
- `priority` (optional): Issue priority (Highest, High, Medium, Low, Lowest)
- `include-thread` (optional): Include all thread messages in the issue description (default: true)

**Example:**
```
/create-jira-from-forum title:"API endpoint returning 500 error" issue-type:"Bug" priority:"High"
```

## Features

### Automatic Content Extraction
- **Forum Post Title**: Automatically cleaned up (removes emojis, tags, common prefixes)
- **Original Content**: Extracts the starter message content
- **Attachments**: Includes links to any attached files
- **Thread Discussion**: Optionally includes all follow-up messages and replies

### Smart Label Generation (GitHub)
The GitHub command automatically generates relevant labels based on:
- **Forum Name**: Detects 'bug', 'feature', 'support', 'frontend', 'backend', 'api', 'ui/ux'
- **Thread Tags**: Maps Discord forum tags to appropriate GitHub labels
- **Priority Detection**: Identifies 'high-priority', 'low-priority', 'critical' from tags
- **Category Labels**: Adds 'documentation', 'performance', 'security' based on context

### Jira Integration Features
- **Issue Types**: Supports Bug, Story, Task, Sub-task, and Epic
- **Priority Levels**: Full priority scale from Lowest to Highest
- **Markup Formatting**: Converts content to Jira markup format
- **Discord Linking**: Includes direct links back to the original Discord thread
- **Auto Labels**: Adds 'discord-integration' and 'forum-import' labels

### Cross-Platform Linking
Both commands create bidirectional links:
- **In Discord**: Posts a message in the thread with a link to the created issue/ticket
- **In GitHub/Jira**: Includes metadata about the original Discord thread
- **Traceability**: Full audit trail from forum post to issue resolution

## Error Handling

### Common Error Scenarios
1. **Not in Forum Thread**: Commands only work in Discord forum threads
2. **Missing Permissions**: Requires appropriate GitHub/Jira access
3. **Configuration Issues**: Jira integration must be properly configured
4. **Network Issues**: Handles API failures gracefully with user feedback

### Fallback Behavior
- If automatic label generation fails, uses default labels
- If thread messages can't be fetched, continues with just the original post
- Provides detailed error messages for troubleshooting

## Use Cases

### Bug Reports
1. User reports a bug in a forum thread
2. Discussion happens in the thread
3. Moderator uses `/create-issue-from-forum` to create a GitHub issue
4. Development team can track the bug with full context

### Feature Requests
1. Community discusses a feature in a forum
2. Product manager uses `/create-jira-from-forum` to create a story
3. Feature gets proper prioritization and assignment
4. Original requesters can follow progress

### Support Escalation
1. Support issue discussed in forum
2. If it requires development work, escalate with `/create-issue-from-forum`
3. Engineering team has full context from the support discussion
4. Resolution can be communicated back to the original thread

## Best Practices

### When to Use Each Command
- **GitHub Issues**: For technical bugs, feature requests, and development tasks
- **Jira Tickets**: For formal project management, epics, and business requirements

### Title Optimization
- Use the `title` parameter to create clear, actionable titles
- Remove Discord-specific formatting that doesn't translate well
- Focus on the core issue or request

### Label Strategy
- Use consistent labeling conventions across your organization
- Leverage automatic label generation but override when needed
- Consider using labels for team assignment and prioritization

### Thread Management
- Use `include-thread: false` for sensitive discussions
- Include thread content for full context and transparency
- Consider thread length when creating issues (very long threads may need summarization)

## Configuration Requirements

### GitHub Integration
- Bot must have GitHub API access
- Repository credentials must be configured
- Appropriate permissions for issue creation

### Jira Integration
- Jira client must be configured with valid credentials
- Project permissions for issue creation
- Issue types and priorities must exist in the target project

## Troubleshooting

### Command Not Available
- Ensure commands have been deployed: `node deploy-commands.js`
- Check bot permissions in the Discord server
- Verify the bot is online and responsive

### GitHub Issues Not Creating
- Check GitHub API credentials and permissions
- Verify repository access
- Check for rate limiting or API errors in logs

### Jira Issues Not Creating
- Verify Jira integration configuration
- Check project permissions and issue type availability
- Ensure required fields are properly configured in Jira project

## Future Enhancements

### Planned Features
- **Automatic Assignment**: Based on forum tags or team mentions
- **Template Support**: Pre-defined issue templates for different forum types
- **Bulk Operations**: Create multiple issues from forum discussions
- **Status Sync**: Bidirectional status updates between Discord and issues
- **Notification Integration**: Automatic updates when issues are resolved

### Integration Opportunities
- **Linear Integration**: Similar command for Linear issue creation
- **Notion Integration**: Create Notion pages from forum discussions
- **Slack Integration**: Cross-post to Slack channels for visibility
