/**
 * Global Setup for Integration Tests
 * 
 * Runs once before all integration tests to prepare the global test environment,
 * initialize databases, and configure external service mocks.
 */

import { promises as fs } from "fs";
import path from "path";

export default async function globalSetup() {
  console.log("🚀 Global Integration Test Setup Starting...");
  
  try {
    // Create necessary directories
    await ensureDirectories();
    
    // Setup test data directories
    await setupTestData();
    
    // Initialize mock databases
    await initializeMockDatabases();
    
    // Setup logging for integration tests
    await setupIntegrationLogging();
    
    // Pre-warm mock services
    await prewarmMockServices();
    
    console.log("✅ Global Integration Test Setup Completed Successfully");
    
    return async () => {
      console.log("🧹 Global Integration Test Teardown Starting...");
      await globalTeardown();
      console.log("✅ Global Integration Test Teardown Completed");
    };
  } catch (error) {
    console.error("❌ Global Integration Test Setup Failed:", error);
    throw error;
  }
}

/**
 * Ensure all necessary directories exist
 */
async function ensureDirectories(): Promise<void> {
  const directories = [
    "./test-results/integration",
    "./coverage/integration", 
    "./logs/integration",
    "./tmp/integration",
    "./.data/test",
  ];
  
  await Promise.all(
    directories.map(dir => 
      fs.mkdir(dir, { recursive: true }).catch(() => {
        // Directory might already exist, ignore error
      })
    )
  );
  
  console.log("📁 Test directories created");
}

/**
 * Setup test data fixtures and mock data
 */
async function setupTestData(): Promise<void> {
  const testDataDir = "./src/__tests__/integration/fixtures";
  
  await fs.mkdir(testDataDir, { recursive: true }).catch(() => {});
  
  // Create mock GitHub webhook payloads
  const githubWebhookFixtures = {
    issueOpened: {
      action: "opened",
      issue: {
        id: 123456,
        number: 1,
        title: "Test Issue",
        body: "Test issue body",
        state: "open",
        html_url: "https://github.com/test/repo/issues/1",
        user: { login: "test_user", id: 12345 },
      },
      repository: {
        name: "test_repo",
        full_name: "test_user/test_repo",
        owner: { login: "test_user", id: 12345 },
      },
    },
    issueClosed: {
      action: "closed",
      issue: {
        id: 123456,
        number: 1,
        title: "Test Issue",
        body: "Test issue body",
        state: "closed",
        html_url: "https://github.com/test/repo/issues/1",
        closed_at: new Date().toISOString(),
      },
    },
  };
  
  await fs.writeFile(
    path.join(testDataDir, "github-webhooks.json"),
    JSON.stringify(githubWebhookFixtures, null, 2)
  );
  
  // Create mock Discord interaction data
  const discordInteractionFixtures = {
    bugReportModal: {
      customId: "smart_bug_test_user_123",
      fields: {
        title: "Test Bug Report",
        stepsToReproduce: "1. Do something\n2. See error",
        expectedBehavior: "Should work correctly",
        actualBehavior: "Error occurs",
        environment: "Test environment",
      },
    },
    featureRequestModal: {
      customId: "smart_feature_test_user_456", 
      fields: {
        title: "Test Feature Request",
        description: "Add new functionality",
        benefits: "Improved user experience",
        implementation: "Use modern tech stack",
        priority: "Medium",
      },
    },
  };
  
  await fs.writeFile(
    path.join(testDataDir, "discord-interactions.json"),
    JSON.stringify(discordInteractionFixtures, null, 2)
  );
  
  // Create mock Jira issue data
  const jiraIssueFixtures = {
    bug: {
      id: "10001",
      key: "TEST-1",
      fields: {
        summary: "Test Bug Issue",
        description: "Test bug description",
        status: { name: "To Do", id: "1" },
        priority: { name: "Medium", id: "3" },
        issuetype: { name: "Bug", id: "10004" },
      },
    },
    story: {
      id: "10002",
      key: "TEST-2",
      fields: {
        summary: "Test Feature Story",
        description: "Test feature description",
        status: { name: "To Do", id: "1" },
        priority: { name: "Medium", id: "3" },
        issuetype: { name: "Story", id: "10001" },
      },
    },
  };
  
  await fs.writeFile(
    path.join(testDataDir, "jira-issues.json"),
    JSON.stringify(jiraIssueFixtures, null, 2)
  );
  
  console.log("🗂️ Test data fixtures created");
}

/**
 * Initialize mock databases for testing
 */
async function initializeMockDatabases(): Promise<void> {
  // Create mock link mappings file
  const mockLinkMappings = {
    jiraLinks: [],
    githubLinks: [],
    version: 1,
    updatedAt: Date.now(),
  };
  
  await fs.writeFile(
    "./.data/test/link-mappings.json",
    JSON.stringify(mockLinkMappings, null, 2)
  );
  
  // Create mock configuration
  const mockConfig = {
    testMode: true,
    apiDelays: {
      github: 0,
      jira: 0,
      discord: 0,
    },
    rateLimits: {
      github: 1000,
      jira: 1000,
      discord: 1000,
    },
  };
  
  await fs.writeFile(
    "./.data/test/config.json",
    JSON.stringify(mockConfig, null, 2)
  );
  
  console.log("🗄️ Mock databases initialized");
}

/**
 * Setup specialized logging for integration tests
 */
async function setupIntegrationLogging(): Promise<void> {
  const integrationLogConfig = {
    level: "error", // Reduce noise during tests
    format: "json",
    timestamp: true,
    file: "./logs/integration/test.log",
    console: false, // Disable console logging during tests
  };
  
  await fs.writeFile(
    "./logs/integration/config.json",
    JSON.stringify(integrationLogConfig, null, 2)
  );
  
  console.log("📋 Integration logging configured");
}

/**
 * Pre-warm mock services to ensure consistent response times
 */
async function prewarmMockServices(): Promise<void> {
  // Pre-create common mock responses to reduce first-call delays
  const commonMockResponses = {
    github: {
      rateLimitRemaining: 1000,
      rateLimitReset: Date.now() + 3600000,
    },
    jira: {
      sessionValid: true,
      permissions: ["READ", "WRITE", "DELETE"],
    },
    discord: {
      botReady: true,
      guildCount: 1,
      channelCache: 100,
    },
  };
  
  await fs.writeFile(
    "./tmp/integration/mock-responses.json",
    JSON.stringify(commonMockResponses, null, 2)
  );
  
  console.log("🔥 Mock services prewarmed");
}

/**
 * Global teardown function
 */
async function globalTeardown(): Promise<void> {
  try {
    // Clean up test databases
    await fs.rm("./.data/test", { recursive: true, force: true }).catch(() => {});
    
    // Clean up temporary files
    await fs.rm("./tmp/integration", { recursive: true, force: true }).catch(() => {});
    
    // Archive test logs
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logArchive = `./logs/integration/archived/test-${timestamp}.log`;
    
    await fs.mkdir("./logs/integration/archived", { recursive: true }).catch(() => {});
    await fs.rename("./logs/integration/test.log", logArchive).catch(() => {});
    
    console.log("🧹 Test cleanup completed");
  } catch (error) {
    console.error("⚠️ Cleanup error (non-fatal):", error);
  }
}