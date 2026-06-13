# Discord Bot Testing Infrastructure

This directory contains a comprehensive testing infrastructure built with Vitest, designed to achieve 100% code coverage for the Discord bot project.

## 🗂️ Directory Structure

```
tests/
├── README.md                    # This documentation
├── setup.ts                     # Global test setup and configuration
├── matchers.ts                  # Custom Vitest matchers for Discord.js
├── fixtures/
│   └── index.ts                # Test data, fixtures, and sample objects
├── mocks/
│   ├── discord.ts              # Complete Discord.js mock implementation
│   ├── github.ts               # GitHub (Octokit) API mocks
│   └── jira.ts                 # Jira API mocks
├── utils/
│   └── testUtils.ts            # Testing utilities and helpers
├── __mocks__/                  # Vitest auto-mocks directory
│   ├── discord.js.ts           # Auto-mock for discord.js
│   ├── @octokit/
│   │   ├── rest.ts             # Auto-mock for Octokit REST
│   │   └── graphql.ts          # Auto-mock for Octokit GraphQL
│   └── jira.js.ts              # Auto-mock for jira.js
└── examples/
    └── modalFormManager.test.ts # Example comprehensive test suite
```

## 🚀 Quick Start

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run specific test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # End-to-end tests only
```

### Test File Naming Convention

- `*.test.ts` - Unit tests
- `*.integration.test.ts` - Integration tests  
- `*.e2e.test.ts` - End-to-end tests
- `*.spec.ts` - Alternative test file format

## 🔧 Configuration

### Vitest Configuration

The main configuration is in `vitest.config.ts` with the following key features:

- **100% Coverage Targets**: Line, branch, function, and statement coverage
- **TypeScript Support**: Full TypeScript support with path mapping
- **Mock Configuration**: Automatic mocking of external dependencies
- **Test Environment**: Node.js environment with Discord.js, GitHub, and Jira mocks
- **Reporters**: Verbose, JSON, and HTML reporting

### Coverage Settings

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html", "lcov"],
  thresholds: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
}
```

## 🛠️ Testing Utilities

### InteractionBuilder

Build Discord interactions for testing:

```typescript
import { InteractionBuilder } from "../utils/testUtils";

const interaction = new InteractionBuilder()
  .chatInput()
  .withUser("user123", "testuser")
  .withGuild("guild123", "Test Guild")
  .withCommandData("test-command", [
    { name: "option1", value: "value1" }
  ])
  .build();
```

### GitHubRequestBuilder

Build GitHub webhook requests:

```typescript
import { GitHubRequestBuilder } from "../utils/testUtils";

const request = new GitHubRequestBuilder()
  .action("opened")
  .issue({ title: "Test Issue", number: 1 })
  .repository({ name: "test-repo", owner: { login: "testuser" } })
  .build();
```

### Error Testing

Test error scenarios comprehensively:

```typescript
import { ErrorTester } from "../utils/testUtils";

// Test async functions that should throw
await ErrorTester.expectThrows(
  async () => await functionThatShouldThrow(),
  "Expected error message"
);

// Test synchronous functions
ErrorTester.expectThrowsSync(
  () => syncFunctionThatShouldThrow(),
  /Error pattern/
);
```

### Async Testing

Handle async operations in tests:

```typescript
import { AsyncTestUtils } from "../utils/testUtils";

// Wait for condition
await AsyncTestUtils.waitFor(() => mockFunction.mock.calls.length > 0);

// Wait for expectation
await AsyncTestUtils.waitForExpect(() => {
  expect(mockFunction).toHaveBeenCalled();
});

// Flush all promises
await AsyncTestUtils.flushPromises();
```

### Coverage Helpers

Ensure comprehensive test coverage:

```typescript
import { CoverageHelpers } from "../utils/testUtils";

// Test all code branches
await CoverageHelpers.testAllBranches([
  {
    name: "happy path",
    execute: () => functionToTest(validInput),
    verify: (result) => expect(result).toBeDefined()
  },
  {
    name: "error path", 
    execute: () => functionToTest(invalidInput),
    verify: (result) => expect(result).toBeNull()
  }
]);

// Test error paths specifically
await CoverageHelpers.testErrorPaths([
  {
    name: "missing parameter",
    execute: () => functionToTest(),
    expectedError: "Missing required parameter"
  }
]);
```

## 🎭 Mocks and Fixtures

### Discord.js Mocks

Complete mock implementation including:

- `Client` with event handling
- `EmbedBuilder`, `ButtonBuilder`, `ActionRowBuilder`
- `SlashCommandBuilder`
- Interaction types (Command, Button, Modal, etc.)
- Constants (ComponentType, ButtonStyle, etc.)

```typescript
import { Client, EmbedBuilder } from "discord.js";

// All Discord.js imports are automatically mocked
const client = new Client({ intents: [] });
const embed = new EmbedBuilder().setTitle("Test");
```

### GitHub API Mocks

Mocks for Octokit REST and GraphQL:

- Repository operations
- Issue management
- Pull requests
- Search functionality
- Webhook payloads

```typescript
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: "token" });
// All methods are mocked with realistic responses
```

### Jira API Mocks

Complete Jira.js client mock:

- Issue operations
- Project management
- User management
- Search functionality
- Webhook payloads

```typescript
import { Version3Client } from "jira.js";

const jira = new Version3Client({
  host: "https://test.atlassian.net",
  authentication: { basic: { email: "test", apiToken: "token" } }
});
```

### Test Fixtures

Pre-built test data for common scenarios:

```typescript
import fixtures from "../fixtures";

// Discord fixtures
const testUser = fixtures.discord.users.testUser;
const testGuild = fixtures.discord.guilds.testGuild;
const testEmbed = fixtures.discord.embeds.withFields;

// GitHub fixtures  
const testRepo = fixtures.github.repositories.testRepo;
const openIssue = fixtures.github.issues.openIssue;

// Jira fixtures
const testProject = fixtures.jira.projects.testProject;
const bugIssue = fixtures.jira.issues.bugIssue;
```

## ✅ Custom Matchers

Discord-specific test matchers:

```typescript
// Interaction testing
expect(mockHandler).toHaveBeenCalledWithInteraction(interaction);
expect(interaction).toHaveRepliedWith("Expected message");
expect(interaction).toHaveFollowedUpWith({ embeds: [embed] });
expect(interaction).toHaveDeferred();

// Discord object validation
expect(embed).toBeValidDiscordEmbed();
expect(component).toBeValidDiscordComponent();
expect(timestamp).toHaveValidDiscordTimestamp();

// API structure validation
expect(issue).toMatchJiraIssueStructure();
expect(issue).toMatchGitHubIssueStructure();

// Logging verification
expect(logger).toHaveLoggedWithLevel("error", "Expected message");
```

## 📊 Coverage Requirements

### 100% Coverage Targets

All code must achieve:
- **100% Line Coverage**: Every line executed
- **100% Branch Coverage**: Every conditional path tested
- **100% Function Coverage**: Every function called
- **100% Statement Coverage**: Every statement executed

### Coverage Exclusions

The following are excluded from coverage requirements:
- Type definition files (`*.d.ts`)
- Test files themselves
- Node modules
- Build output (`dist/`)

### Coverage Reports

Coverage reports are generated in multiple formats:
- **Terminal**: Real-time coverage summary
- **HTML**: Detailed interactive report (`coverage/index.html`)
- **JSON**: Machine-readable format (`coverage/coverage.json`)
- **LCOV**: For CI/CD integration (`coverage/lcov.info`)

## 🏗️ Writing Tests

### Test Structure

Follow the AAA pattern (Arrange, Act, Assert):

```typescript
describe("Component Name", () => {
  describe("method name", () => {
    it("should do something when condition is met", async () => {
      // Arrange
      const mockData = createMockData();
      const component = new Component(mockData);
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
    });
  });
});
```

### Error Testing Requirements

Every function must test:
1. **Happy Path**: Normal successful execution
2. **Error Paths**: All possible error conditions
3. **Edge Cases**: Boundary conditions, null/undefined inputs
4. **Validation**: Input validation and error messages

### Async Testing

For async operations:
1. Always use `async/await` in test functions
2. Test both resolved and rejected promises
3. Use timeouts for long-running operations
4. Test cleanup and resource management

### Mock Verification

Always verify:
1. Functions were called with correct parameters
2. Functions were called the expected number of times
3. Side effects occurred as expected
4. Error handling was triggered appropriately

## 🔍 Debugging Tests

### Debug Mode

Run tests with debug information:

```bash
# Enable debug logging
DEBUG=* npm test

# Run specific test file
npm test -- modalFormManager.test.ts

# Run tests matching pattern
npm test -- --grep "validation"
```

### Test Isolation

Each test should be isolated:
- Use `beforeEach` and `afterEach` for setup/cleanup
- Reset all mocks between tests
- Clear any global state
- Use fresh instances of objects

### Common Issues

1. **Async timing issues**: Use `waitFor` utilities
2. **Mock not working**: Check mock is imported before actual module
3. **Coverage gaps**: Use coverage reports to identify untested code
4. **Memory leaks**: Ensure proper cleanup in tests

## 📈 Best Practices

### 1. Test Naming

Use descriptive test names:
```typescript
// Good
it("should throw ValidationError when required field is empty")

// Bad  
it("should handle error")
```

### 2. Test Organization

Group related tests:
```typescript
describe("UserManager", () => {
  describe("createUser", () => {
    describe("validation", () => {
      it("should validate email format");
      it("should validate password strength");
    });
    
    describe("database operations", () => {
      it("should save user to database");
      it("should handle database errors");
    });
  });
});
```

### 3. Mock Management

Keep mocks focused and realistic:
```typescript
// Good - specific mock
const mockUserService = {
  createUser: vi.fn().mockResolvedValue(mockUser),
  findUser: vi.fn().mockResolvedValue(null)
};

// Bad - overly broad mock
const mockUserService = vi.fn().mockImplementation(() => ({}));
```

### 4. Assertion Quality

Make assertions specific and meaningful:
```typescript
// Good
expect(result).toEqual({
  id: expect.any(String),
  name: "Test User",
  email: "test@example.com",
  createdAt: expect.any(Date)
});

// Bad
expect(result).toBeDefined();
```

### 5. Error Testing

Test error scenarios comprehensively:
```typescript
describe("error handling", () => {
  it("should handle network timeouts", async () => {
    mockApi.get.mockRejectedValue(new Error("TIMEOUT"));
    
    await expect(service.fetchData()).rejects.toThrow("TIMEOUT");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Network timeout")
    );
  });
});
```

## 🚀 Integration with CI/CD

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Quality Gates

Enforce coverage requirements:
- Pull requests must maintain 100% coverage
- New code must include comprehensive tests
- All tests must pass before merging

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Discord.js Guide](https://discordjs.guide/)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)

## 🤝 Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure 100% coverage for new code
3. Update mocks if adding new dependencies
4. Document any new testing patterns
5. Run full test suite before submitting PR

For questions or issues with the testing infrastructure, please create an issue in the project repository.