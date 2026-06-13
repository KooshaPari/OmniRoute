# Jira Workflow Configuration Guide

This document explains how to configure Jira workflows to work optimally with the Discord bot's 4 main actions: **resolve**, **close**, **reopen**, and **delete**.

## Overview

The Discord bot provides 4 actions for managing issues across GitHub and Jira:

1. **resolve** → Mark issue as completed (maps to "Done" transitions)
2. **close** → Mark issue as not planned/rejected/declined (maps to Close/Won't Do transitions)  
3. **reopen** → Reopen closed issues (maps to "Open/To Do" transitions)
4. **delete** → Permanently delete the issue from Jira

## Quick Setup

### 1. Environment Variables

Configure these environment variables:

```bash
JIRA_HOST=your-company.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=YOUR_PROJECT
```

### 2. API Token Setup

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a descriptive name (e.g., "Discord Bot")
4. Copy the generated token
5. Use your email and token for authentication

### 3. Permissions

Ensure your Jira user has:
- **Browse Projects** permission
- **Transition Issues** permission
- **Add Comments** permission  
- **Delete Issues** permission (for delete action)

## Workflow Transition Mapping

The bot uses intelligent pattern matching to find the best transitions for each action.

### Resolve Action Patterns

The bot looks for transitions matching these patterns (in priority order):

**Exact Matches (Priority 100-80):**
- `Done` 
- `Complete`
- `Completed`
- `Resolve`
- `Resolved`
- `Finish`
- `Finished`
- `Close`
- `Closed`

**Partial Matches (Priority 70-45):**
- Contains "done"
- Contains "complete" 
- Contains "resolve"
- Contains "finish"
- Contains "close"

### Close Action Patterns

**Exact Matches (Priority 100-70):**
- `Close` / `Closed` / `Won't Do` / `Wont Do`
- `Decline` / `Declined`
- `Reject` / `Rejected`
- `Cancel` / `Cancelled`
- `Abandon` / `Abandoned`
- `Invalid`
- `Duplicate`
- `Not Planned`

**Partial Matches (Priority 65-30):**
- Contains "close" or "won't do" or "wont do"
- Contains "decline"
- Contains "reject"
- Contains "cancel"
- Contains "abandon"
- Contains "invalid"
- Contains "duplicate"

### Reopen Action Patterns

**Exact Matches (Priority 100-70):**
- `To Do`
- `Open`
- `Reopen` / `Reopened`
- `Start` / `Started`
- `Begin`
- `Backlog`
- `New`
- `Created`

**Partial Matches (Priority 65-40):**
- Contains "to do"
- Contains "open"
- Contains "reopen"
- Contains "start"
- Contains "begin"
- Contains "backlog"

## Standard Jira Workflows

### Default Workflow (Classic)
```
To Do → In Progress → Done
```
**Compatibility:** ✅ Full support
- resolve: "Done"
- reopen: "To Do"
- close: ❌ No built-in transition (needs custom workflow)

### Simplified Workflow (Team-managed)
```
To Do → In Progress → Done
     ↘️ Won't Do
```
**Compatibility:** ✅ Full support
- resolve: "Done"
- close: "Won't Do"
- reopen: "To Do"

### Bug Workflow
```
Open → In Progress → Resolved → Closed
    ↘️ Invalid/Duplicate
```
**Compatibility:** ✅ Full support
- resolve: "Resolved"
- close: "Invalid" or "Duplicate"
- reopen: "Open"

## Custom Workflow Setup

### Adding Missing Transitions

1. Go to **Project Settings** → **Workflows**
2. Edit your active workflow
3. Add missing transitions based on the patterns above
4. Ensure transitions are available from the appropriate statuses

### Recommended Transition Names

For maximum compatibility, use these exact names:

- **Completion**: `Done`, `Complete`, or `Resolved`
- **Close/Not Planned**: `Close`, `Won't Do`, `Declined`, or `Rejected`
- **Reopening**: `To Do`, `Open`, or `Reopen`

### Example Custom Workflow

```
[To Do] → [In Progress] → [Done]
    ↓           ↓            ↓
[Closed / Won't Do] ← [Closed / Won't Do] ← [Reopen]
```

**Transition Configuration:**
- From "To Do": → "In Progress", → "Close/Won't Do"
- From "In Progress": → "Done", → "Close/Won't Do"  
- From "Done": → "Reopen"
- From "Close/Won't Do": → "Reopen"

## Troubleshooting

### Common Issues

#### "No suitable transition found"
**Problem**: The bot can't find a transition matching the action patterns.

**Solutions:**
1. Check available transitions: The bot logs available transitions when none match
2. Add missing transitions to your workflow
3. Use exact pattern matches from the lists above
4. Ensure transitions are available from the current issue status

#### "Permission denied"
**Problem**: Bot user lacks permission to perform the transition.

**Solutions:**
1. Check the user has "Transition Issues" permission
2. Verify the user can access the specific project
3. Ensure the transition is available to the user's role

#### "Transition failed" 
**Problem**: Transition is available but execution failed.

**Solutions:**
1. Check if the issue is in a status that allows the transition
2. Verify no required fields are blocking the transition
3. Check workflow conditions and validators

### Testing Workflow Compatibility

Use the built-in validation tools:

```typescript
import { jiraService, JiraConfigValidator } from './jira/jiraClient';

// Validate environment configuration
const envValidation = JiraConfigValidator.validateEnvironment();
console.log('Environment valid:', envValidation.isValid);

// Test workflow compatibility (requires sample issue)
const analysis = await jiraService.analyzeProjectWorkflow('PROJECT-123');
console.log('Workflow coverage:', analysis.coverage + '%');
```

### Workflow Analysis Output

```json
{
  "resolve": {
    "available": true,
    "bestMatch": "Done",
    "suggestions": []
  },
  "close": {
    "available": false,
    "suggestions": ["Add a 'Won't Do' transition"]
  },
  "reopen": {
    "available": true,
    "bestMatch": "To Do"
  },
  "coverage": 67,
  "recommendations": [
    "Consider adding close/rejection transitions like 'Close' or 'Won't Do'"
  ]
}
```

## Best Practices

### Workflow Design
1. **Keep it Simple**: Avoid overly complex workflows with many statuses
2. **Consistent Naming**: Use standard terms that match the bot's patterns
3. **Bidirectional Transitions**: Allow reopening from completed states
4. **Clear Status Categories**: Use Jira's built-in status categories properly

### Project Configuration
1. **Standard Workflows**: Use Jira's built-in workflows when possible
2. **Role-Based Access**: Ensure bot user has appropriate permissions
3. **Field Configuration**: Avoid required fields that block transitions
4. **Validation Rules**: Keep workflow rules simple for bot compatibility

### Monitoring
1. **Log Analysis**: Monitor bot logs for transition failures
2. **Workflow Coverage**: Regularly check workflow compatibility
3. **User Feedback**: Track issues reported by Discord users
4. **Performance**: Monitor transition response times

## Advanced Configuration

### Custom Transition Mapping

For complex workflows, you can extend the transition mapping patterns:

```typescript
// Add custom patterns to JiraTransitionMapper
const customPatterns = {
  resolve: [
    { pattern: /^completed$/i, priority: 100, description: "Custom Complete" }
  ]
};
```

### Workflow Templates

**Software Development:**
```
Backlog → Selected → In Progress → Code Review → Testing → Done
                  ↘️ Won't Do ↗️
```

**Support Tickets:**
```
Open → In Progress → Waiting → Resolved → Closed
    ↘️ Invalid/Spam ↗️
```

**Bug Tracking:**
```
New → Open → In Progress → Resolved → Verified → Closed
   ↘️ Invalid/Duplicate ↗️
```

## API Reference

### JiraTransitionMapper

```typescript
// Find best transition for an action
const result = JiraTransitionMapper.findBestTransition(transitions, 'resolve');

// Get all matching transitions with confidence scores  
const matches = JiraTransitionMapper.getAllMatchingTransitions(transitions, 'close');

// Analyze complete workflow compatibility
const analysis = JiraTransitionMapper.analyzeWorkflow(transitions);

// Generate workflow documentation
const docs = JiraTransitionMapper.generateWorkflowDocs(projectKey, transitions);
```

### JiraConfigValidator

```typescript
// Validate environment variables
const envCheck = JiraConfigValidator.validateEnvironment();

// Generate configuration template
const template = JiraConfigValidator.generateConfigTemplate();

// Test connection with credentials
const test = await JiraConfigValidator.testConnection({
  host: 'company.atlassian.net',
  email: 'bot@company.com', 
  apiToken: 'token',
  projectKey: 'PROJ'
});
```

## Support

If you encounter issues with workflow configuration:

1. Check the bot logs for specific error messages
2. Use the validation tools to diagnose configuration problems
3. Refer to Atlassian's workflow documentation
4. Test transitions manually in Jira to verify they work
5. Consider simplifying complex workflows for better compatibility

For additional support, review the transition patterns and ensure your workflow includes the standard transition names listed in this guide.
