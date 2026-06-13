# Integration and End-to-End Test Suite

This directory contains comprehensive integration and end-to-end tests that validate complete user workflows across Discord, GitHub, and Jira platforms with 100% code coverage targets.

## Test Structure

### Test Files

1. **`complete-issue-workflows.integration.test.ts`**
   - Tests complete Discord → GitHub → Jira issue workflows
   - Issue status transitions and cross-platform synchronization
   - Error recovery and resilience scenarios
   - State consistency validation

2. **`forum-workflows.integration.test.ts`**
   - Bug report submission workflows through Discord forums
   - Feature request submission workflows with team assignment
   - Forum selection and routing logic
   - Auto-tagging and content analysis

3. **`command-integration.integration.test.ts`**
   - Discord slash commands integration (link, priority, status, label)
   - Cross-platform command synchronization
   - Command error handling and validation
   - API rate limiting scenarios

4. **`webhook-integration.integration.test.ts`**
   - GitHub webhook processing and Discord synchronization
   - Webhook security validation and error recovery
   - High-volume webhook processing
   - Cross-platform state consistency

5. **`end-to-end-workflows.integration.test.ts`**
   - Complete end-to-end user journeys from creation to resolution
   - Complex multi-platform scenarios
   - Performance and scalability testing
   - Concurrent operation handling

### Configuration Files

- **`test-runner.config.ts`** - Vitest configuration for integration tests
- **`integration-setup.ts`** - Test environment setup and mock configuration
- **`global-setup.ts`** - Global test suite initialization
- **`global-teardown.ts`** - Test cleanup and reporting

## Running Tests

### Prerequisites

```bash
npm install
```

Ensure all environment variables are properly configured (see main README).

### Test Execution Commands

#### Run All Integration Tests
```bash
npm run test:integration
```

#### Run with Coverage
```bash
npm run test:integration:coverage
```

#### Run in Watch Mode
```bash
npm run test:integration:watch
```

#### Run End-to-End Tests Only
```bash
npm run test:e2e
```

#### Run Specific Workflow Tests
```bash
npm run test:workflows
```

#### Run Individual Test Files
```bash
# Complete issue workflows
npx vitest run src/__tests__/integration/complete-issue-workflows.integration.test.ts

# Forum workflows  
npx vitest run src/__tests__/integration/forum-workflows.integration.test.ts

# Command integration
npx vitest run src/__tests__/integration/command-integration.integration.test.ts

# Webhook integration
npx vitest run src/__tests__/integration/webhook-integration.integration.test.ts

# End-to-end workflows
npx vitest run src/__tests__/integration/end-to-end-workflows.integration.test.ts
```

## Test Coverage

### Coverage Targets

- **Statements:** 100%
- **Branches:** 100%
- **Functions:** 100%
- **Lines:** 100%

### Critical Path Coverage

The following modules have strict 100% coverage requirements:
- `src/discord/discordHandlers.ts`
- `src/github/githubActions.ts`
- `src/store.ts`
- Core command handlers
- Webhook processors

### Coverage Reports

After running tests with coverage, reports are generated in:
- `./coverage/integration/` - Detailed coverage reports
- `./test-results/integration/` - Test execution reports

## Test Scenarios

### 1. Complete Issue Workflows

#### Bug Report Journey
1. User submits bug report via Discord forum
2. Auto-creation of GitHub issue for critical bugs
3. Manual linking to Jira issue
4. Priority updates across all platforms
5. Status transitions (in-progress → resolved)
6. Issue closure and archival

#### Error Recovery
- GitHub API failures during issue creation
- Jira authentication failures during linking
- Network timeouts and retry logic
- Partial failure scenarios with state consistency

### 2. Forum Workflows

#### Bug Report Submission
- Modal form validation and submission
- Auto-tagging based on content analysis
- Thread creation with proper formatting
- Integration with issue management systems

#### Feature Request Workflow
- Multi-step form with team assignment
- Team selection and routing
- Auto-escalation for high-priority requests
- Integration with project management tools

### 3. Command Integration

#### Link Command
- Link Discord threads to existing GitHub issues
- Create new GitHub and Jira issues
- Handle linking errors gracefully
- Validate cross-platform synchronization

#### Priority Command
- Update priority across GitHub and Jira
- Validate label synchronization
- Handle API rate limiting
- Error recovery and consistency

#### Status Command
- Status transitions across all platforms
- Discord thread state management
- Jira workflow transitions
- GitHub issue state updates

### 4. Webhook Integration

#### GitHub Webhooks
- Issue opened/closed/reopened events
- Comment creation and updates
- Label and assignment changes
- Security validation and authentication

#### Cross-Platform Sync
- Real-time state synchronization
- Conflict resolution
- Concurrent update handling
- Data consistency validation

### 5. End-to-End Workflows

#### Complete Bug Resolution
1. Discord forum bug report
2. Auto-GitHub issue creation
3. Jira linking by team member
4. Priority and status updates
5. Development work tracking
6. Final resolution and closure

#### Feature Development Lifecycle
1. Feature request submission
2. Team assignment and planning
3. GitHub issue creation
4. Development tracking
5. Implementation completion
6. Release and closure

## Performance Testing

### Benchmarks

- **Single workflow completion:** < 2 seconds
- **Bulk operations (20 threads):** < 10 seconds
- **High-volume webhooks (50 events):** < 5 seconds
- **Memory usage:** < 512 MB during tests

### Load Testing

Tests include scenarios for:
- Concurrent webhook processing
- Bulk thread operations
- High-frequency command execution
- Memory leak detection

## Error Scenarios

### API Failures
- GitHub API rate limiting
- Jira authentication failures
- Discord API timeouts
- Network connectivity issues

### Data Consistency
- Partial synchronization failures
- Conflicting state updates
- Race condition handling
- Recovery from corruption

### User Errors
- Invalid input validation
- Permission errors
- Missing configuration
- Malformed requests

## Test Data and Mocks

### Mock Configuration

All external services are mocked for consistent testing:
- **GitHub API:** Realistic response times and error scenarios
- **Jira API:** Authentication and workflow transitions
- **Discord API:** Message handling and channel operations

### Test Fixtures

Pre-defined test data includes:
- GitHub webhook payloads
- Discord interaction data
- Jira issue templates
- User and guild configurations

### Mock Services

Mock implementations provide:
- Configurable response delays
- Error injection capabilities
- State tracking and validation
- Realistic API behavior

## Debugging and Troubleshooting

### Common Issues

#### Test Timeouts
```bash
# Increase timeout for complex tests
VITEST_TIMEOUT=60000 npm run test:integration
```

#### Memory Issues
```bash
# Run tests with memory monitoring
node --max-old-space-size=4096 node_modules/.bin/vitest run src/__tests__/integration/
```

#### Mock Debugging
Enable debug logging by setting:
```bash
DEBUG=test:* npm run test:integration
```

### Test Debugging

Add debug statements in tests:
```typescript
console.log("🔍 Debug checkpoint:", { threadId, githubIssue, jiraKey });
```

### Coverage Issues

Check uncovered lines:
```bash
npm run test:integration:coverage
open coverage/integration/index.html
```

## Continuous Integration

### CI Configuration

For CI environments, use:
```bash
# Fast execution with reduced timeouts
CI=true npm run test:integration

# Generate JUnit reports
npm run test:integration -- --reporter=junit
```

### Quality Gates

CI pipeline checks:
- All tests pass (100% pass rate)
- Coverage targets met (95%+ minimum)
- No memory leaks detected
- Performance benchmarks met

## Contributing

### Adding New Tests

1. Follow the existing test patterns
2. Include comprehensive error scenarios
3. Validate state consistency
4. Add performance benchmarks
5. Document test scenarios

### Test Guidelines

- Use descriptive test names
- Include setup and teardown
- Mock all external dependencies
- Validate complete workflows
- Test error recovery paths

### Code Coverage

Ensure new code includes:
- Unit tests for individual functions
- Integration tests for workflows
- Error scenario coverage
- Performance validation

## Reports and Analytics

### Test Reports

Generated after each run:
- `test-results/integration/summary.md` - Executive summary
- `test-results/integration/report.html` - Detailed results
- `coverage/integration/` - Coverage analysis

### Performance Analytics

Track over time:
- Test execution duration
- Memory usage patterns
- API response times
- Error rates and recovery

### Historical Data

Test results are archived in:
- `test-results/integration/archive/` - Historical test runs
- Performance trend analysis
- Coverage evolution tracking
- Error pattern analysis

---

For questions or issues with integration tests, check the main project documentation or create an issue with the `testing` label.