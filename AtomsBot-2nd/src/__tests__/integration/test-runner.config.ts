/**
 * Integration Test Runner Configuration
 * 
 * Comprehensive test execution configuration for all integration and E2E tests
 * with coverage reporting, performance monitoring, and result analysis.
 */

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import os from "os";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Exclude patterns are handled via test.exclude; watchExclude removed in Vitest v3
    // Test environment
    globals: true,
    environment: "node",
    
    // Integration test specific patterns
    include: [
      "src/**/*.integration.test.{ts,js}",
      "src/**/*.e2e.test.{ts,js}",
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "logs/**",
      "coverage/**",
      ".history/**",
      "src/**/*.unit.test.{ts,js}",
      "src/**/*.spec.{ts,js}",
    ],

    // Setup files for integration tests
    setupFiles: [
      "./tests/setup.ts",
      "./src/__tests__/integration/integration-setup.ts",
    ],

    // Integration test specific configuration
    testTimeout: 30000, // 30 seconds for complex E2E workflows
    hookTimeout: 10000, // 10 seconds for setup/teardown
    
    // Coverage configuration for integration tests
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov", "clover"],
      reportsDirectory: "./coverage/integration",
      include: [
        "src/**/*.{ts,js}",
        "api/**/*.{ts,js}",
      ],
      exclude: [
        "src/**/*.test.{ts,js}",
        "src/**/*.spec.{ts,js}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/**/tests/**",
        "src/__tests__/**",
        "node_modules/**",
        "dist/**",
      ],
      // Integration test coverage thresholds
      thresholds: {
        global: {
          branches: 95,    // Slightly lower for integration tests
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // Specific thresholds for critical integration paths
        "src/discord/discordHandlers.ts": {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        "src/github/githubActions.ts": {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        "src/store.ts": {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        "api/webhooks/github.ts": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
      all: true,
      clean: true,
      skipFull: false,
    },

    // Execution configuration for integration tests
    fileParallelism: true,
    sequence: {
      concurrent: true,
      shuffle: false,
    },
    // Limit concurrently running tests within a single file to reduce flakiness
    maxConcurrency: process.env.CI ? 2 : Math.max(2, Math.min(4, Math.ceil(os.cpus().length * 0.25))),

    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false, // Allow parallel execution
        maxForks: 4,       // Limit concurrent processes
      }
    },

    // Reporting configuration
    reporters: [
      "verbose",
      "json",
      "html",
      "junit",
    ],
    outputFile: {
      json: "./test-results/integration/results.json",
      html: "./test-results/integration/report.html",
      junit: "./test-results/integration/junit.xml",
    },

    // Retry configuration for flaky integration tests
    retry: 2,

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Performance monitoring
    benchmark: {
      include: [
        "src/**/*.integration.test.{ts,js}",
      ],
      exclude: [
        "src/**/*.unit.test.{ts,js}",
      ],
    },

    // Watch configuration handled via test.watchExclude

    // Custom matchers and utilities
    // Note: use setupFiles instead of globalSetup/globalTeardown for compatibility
  },

  // Build configuration for integration tests
  esbuild: {
    target: "node18",
    sourcemap: true,
  },

  // Resolve configuration
  resolve: {
    alias: {
      "@": "/src",
      "@tests": "/tests",
      "@integration": "/src/__tests__/integration",
    }
  },

  // Define constants for integration tests
  define: {
    __INTEGRATION_TEST__: true,
    __E2E_TEST__: true,
    __TEST_TIMEOUT__: 30000,
  },
});

/**
 * Integration Test Execution Strategies
 */
export const testStrategies = {
  // Sequential execution for state-dependent tests
  sequential: [
    "complete-issue-workflows.integration.test.ts",
    "end-to-end-workflows.integration.test.ts",
  ],
  
  // Parallel execution for independent tests
  parallel: [
    "forum-workflows.integration.test.ts",
    "command-integration.integration.test.ts",
    "webhook-integration.integration.test.ts",
  ],
  
  // Performance tests (run separately)
  performance: [
    "end-to-end-workflows.integration.test.ts", // Performance scenarios
  ],
  
  // Critical path tests (must pass)
  critical: [
    "complete-issue-workflows.integration.test.ts",
    "webhook-integration.integration.test.ts",
  ],
};

/**
 * Test Environment Configuration
 */
export const environments = {
  development: {
    timeout: 60000,
    retries: 3,
    coverage: false,
  },
  
  ci: {
    timeout: 30000,
    retries: 1,
    coverage: true,
    reporter: ["json", "junit"],
  },
  
  production: {
    timeout: 15000,
    retries: 0,
    coverage: true,
    reporter: ["json"],
  },
};

/**
 * Integration Test Metrics and Monitoring
 */
export const metrics = {
  // Performance benchmarks
  maxExecutionTime: 30000, // ms
  maxMemoryUsage: 512,     // MB
  maxConcurrentThreads: 10,
  
  // Coverage targets
  minCoverage: {
    statements: 95,
    branches: 95,
    functions: 95,
    lines: 95,
  },
  
  // Quality gates
  maxFailureRate: 0.05, // 5% max failure rate
  minPassRate: 0.95,    // 95% min pass rate
};

/**
 * Test Data Management
 */
export const testData = {
  // Mock data configuration
  mockDataPath: "./src/__tests__/integration/fixtures",
  
  // Test database configuration
  testDb: {
    reset: true,
    seed: true,
    cleanup: true,
  },
  
  // External service mocks
  services: {
    github: { mock: true, timeout: 5000 },
    jira: { mock: true, timeout: 5000 },
    discord: { mock: true, timeout: 5000 },
  },
};
