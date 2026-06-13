import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import os from "os";

// Detect Bun runtime reliably
const isBun = Boolean((process as any).versions?.bun) || process.env.BUN_RUNTIME === "true";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    
    // Test file patterns - optimized for better discovery
    include: [
      "src/**/*.test.{ts,js}",
      "src/**/*.spec.{ts,js}",
      "tests/**/*.test.{ts,js}",
      "tests/**/*.spec.{ts,js}"
    ],
    exclude: [
      "node_modules/**",
      "dist/**", 
      "build/**",
      "logs/**",
      "coverage/**",
      ".history/**",
      "**/*.d.ts",
      "**/node_modules/**"
    ],

    // Setup files - optimized order
    setupFiles: [
      "./tests/bun-performance-setup.ts", // Bun performance setup first
      "./tests/performance-setup.ts", // General performance setup
      "./tests/setup.ts"
    ],

    // Integration test specific configuration
    globalSetup: "./src/__tests__/integration/global-setup.ts",
    globalTeardown: "./src/__tests__/integration/global-teardown.ts",

    // Coverage configuration - optimized for complete tracking
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.{ts,js}",
        "!src/**/*.d.ts",
        "!src/**/*.test.{ts,js}",
        "!src/**/*.spec.{ts,js}"
      ],
      exclude: [
        "src/**/*.test.{ts,js}",
        "src/**/*.spec.{ts,js}",
        "src/**/*.integration.test.{ts,js}",
        "src/**/*.e2e.test.{ts,js}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/**/tests/**",
        "src/__tests__/**",
        "tests/**",
        "node_modules/**",
        "dist/**",
        "build/**",
        "coverage/**",
        "**/*.config.{js,ts}",
        "**/index.d.ts"
      ],
      // Adjusted coverage thresholds for practical implementation
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      // Enable all coverage types
      all: true,
      clean: true,
      allowExternal: false,
      skipFull: false
    },

    // Optimized for Bun runtime with high-performance test execution
    // Threads can cause instability under Bun in some environments. Prefer forks there.
    pool: isBun ? "forks" : "threads",
    poolOptions: {
      threads: isBun
        ? undefined
        : {
            singleThread: false,
            isolate: true,
            useAtomics: true,
            env: {
              NODE_OPTIONS: "--unhandled-rejections=strict",
            },
          },
      forks: isBun
        ? {
            singleFork: true,
            isolate: true,
            // Keep workers minimal to avoid Bun segfaults
            execArgv: ["--unhandled-rejections=strict"],
          }
        : { singleFork: false },
    },
    // Bun-optimized worker configuration for maximum performance
    maxWorkers: isBun
      ? 1
      : process.env.CI
        ? 4
        : Math.max(2, Math.min(6, Math.ceil(os.cpus().length * 0.6))),
    minWorkers: 1,

    // Ensure clean state between tests
    cleanOnRerun: true,
    sequence: {
      shuffle: false, // Keep deterministic order for debugging
      concurrent: false // Run tests sequentially within a file to avoid cross-test interference
    },
    // Limit number of concurrently running tests within a file
    maxConcurrency: process.env.CI ? 4 : Math.max(2, Math.min(8, Math.ceil(os.cpus().length * 0.5))),

    // Optimized timeout configuration - higher for integration tests
    testTimeout: process.env.VITEST_TEST_TYPE === 'integration' ? 30000 : 5000, // 30s for integration, 5s for unit
    hookTimeout: process.env.VITEST_TEST_TYPE === 'integration' ? 15000 : 3000, // 15s for integration, 3s for unit  
    teardownTimeout: process.env.VITEST_TEST_TYPE === 'integration' ? 10000 : 2000, // 10s for integration, 2s for unit
    
    // Performance optimizations
    fileParallelism: true,
    forks: {
      singleFork: false
    },

    // Reporter configuration - simplified for better performance
    reporter: process.env.CI ? [["default", { summary: false }], "json"] : ["verbose"],
    outputFile: {
      json: "./test-results/results.json"
    },

    // Mock configuration - optimized for performance and consistency
    mockReset: true, // Enable for consistency across tests
    clearMocks: true, // Enable to prevent test interference
    restoreMocks: true, // Enable to prevent mock restore conflicts
    unstubEnvs: true, // Enable for proper test isolation
    unstubGlobals: true, // Enable for proper test isolation

    // TypeScript configuration
    typecheck: {
      enabled: false, // Disabled for performance - use separate tsc check
      tsconfig: "./tsconfig.json"
    },

    // Watch configuration - optimized for performance
    watch: {
      ignore: [
        "**/node_modules/**",
        "**/dist/**", 
        "**/coverage/**",
        "**/test-results/**",
        "**/logs/**",
        "**/.history/**",
        "**/db/**",
        "**/*.log",
        "**/.vitest/**"
      ],
      // Use native file watching for better performance
      usePolling: false
    },

    // Environment variables for tests
    env: {
      NODE_ENV: "test"
    },

    // Retry configuration for flaky tests
    retry: process.env.CI ? 2 : 0,

    // Bail early in CI to save time
    bail: process.env.CI ? 1 : 0
  },

  // Bun-optimized build configuration for tests
  esbuild: {
    target: "node18",
    sourcemap: process.env.CI ? false : "inline",
    minify: false,
    keepNames: true,
    // Bun-specific optimizations
    tsconfigRaw: {
      compilerOptions: {
        useDefineForClassFields: false,
        target: "ES2022", // Higher target for Bun
        moduleResolution: "bundler",
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }
  },

  // Resolve configuration - improved module resolution
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "@tests": new URL("./tests", import.meta.url).pathname,
      "~": new URL(".", import.meta.url).pathname
    },
    extensions: [".ts", ".js", ".json"]
  },

  // Bun-specific define configuration for better module handling
  define: {
    "process.env.NODE_ENV": JSON.stringify("test"),
    // Only hint Bun runtime when actually running under Bun
    ...(isBun ? { "process.env.BUN_RUNTIME": JSON.stringify("true") } : {}),
    global: "globalThis",
    // Map test-only global shims so bare identifiers in tests resolve correctly
    mockInitDiscord: "globalThis.mockInitDiscord",
    mockInitGithub: "globalThis.mockInitGithub",
  },

  // Optimizations for maximum performance
  optimizeDeps: {
    exclude: ["@vitest/coverage-v8", "better-sqlite3", "discord.js"],
    include: ["winston", "@octokit/rest", "@octokit/graphql", "jira.js"],
    esbuildOptions: {
      target: "node18"
    }
  },

  // Server configuration for test environment - performance optimized
  server: {
    deps: {
      inline: [
        // Inline dependencies that need to be processed by Vite
        "discord.js",
        "@octokit/rest",
        "@octokit/graphql",
        "jira.js",
        /^@discord/,
        /^@types\//
      ],
      external: [
        "better-sqlite3",
        "bufferutil",
        "utf-8-validate"
      ]
    },
    fs: {
      cachedChecks: false // Disable for performance in tests
    }
  },

  // Cache configuration for better performance
  cache: {
    dir: "node_modules/.vitest"
  }
});
