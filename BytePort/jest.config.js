/**
 * BytePort Jest configuration.
 *
 * The TS/JS side of the L3 #44 dual-stack coverage gate. The Rust
 * side lives in `BytePort/.cargo/config.toml` and is invoked by
 * `BytePort/scripts/coverage-rust.sh`; this file is the equivalent
 * for any TS/JS code under BytePort/ (Tauri IPC, SvelteKit,
 * shared tooling under `tools/`, etc.).
 *
 * The thresholds below are the L3 #44 spec verbatim. A future PR
 * may tighten them per file or per directory; until then the
 * "global" block is the contract: every covered TS/JS line must
 * clear the 80% / 70% bars, otherwise `scripts/coverage-ts.sh`
 * exits non-zero and `scripts/coverage.sh` fails the gate.
 *
 * `coverageThreshold` is enforced by `jest --coverage` itself, so
 * the script just needs to invoke `npx jest --coverage` (see
 * `scripts/coverage-ts.sh`).
 *
 * Reference: https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
module.exports = {
    // BytePort's TS/JS code is a mix of:
    //   * SvelteKit/TS under frontend/web/src/   (browser-like)
    //   * Tauri IPC bridges under frontend/web/src-tauri/src/  (node)
    //   * shared tooling under tools/             (node)
    //
    // Default to the node test environment; individual specs can
    // override with `/** @jest-environment jsdom */` at the top.
    testEnvironment: 'node',

    // Look for tests in the conventional *.test.{ts,js} / *.spec.{ts,js}
    // spots. Tauri-side tests live next to their source under
    // frontend/web/src-tauri/src/**/*.test.ts; SvelteKit/TS tests
    // live under frontend/web/src/**/*.test.ts; tooling tests
    // live under tools/cli/src/**/*.test.ts. `testPathIgnorePatterns`
    // skips the SvelteKit build cache and vendored deps so jest
    // doesn't try to compile them.
    testMatch: [
        '<rootDir>/frontend/web/src/**/*.test.{ts,js}',
        '<rootDir>/frontend/web/src-tauri/src/**/*.test.{ts,js}',
        '<rootDir>/tools/cli/src/**/*.test.{ts,js}',
        '<rootDir>/tests/**/*.test.{ts,js}',
    ],
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/frontend/web/.svelte-kit/',
        '<rootDir>/frontend/web/build/',
        '<rootDir>/target/',
        '<rootDir>/dist/',
    ],

    // TS support out of the box via ts-jest (assumed installed as a
    // devDep of whichever workspace root owns the test sources).
    // If ts-jest is not installed the test run will fail loudly
    // with a "Cannot find module 'ts-jest'" error, which is the
    // intended signal that the consumer needs to add the dep.
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                // Reuse BytePort's SvelteKit tsconfig when present,
                // otherwise fall back to the strict defaults Jest
                // ships with.
                tsconfig: '<rootDir>/frontend/web/tsconfig.json',
                isolatedModules: true,
            },
        ],
    },

    // Module-name mapper: the `@app/*` alias used in the SvelteKit
    // frontend, the `~/*` alias used by Tauri sources, and the
    // `$lib` Svelte convention are all resolved here so test
    // imports don't break. Add more as BytePort's TS surface grows.
    moduleNameMapper: {
        '^@app/(.*)$': '<rootDir>/frontend/web/src/$1',
        '^~/(.*)$': '<rootDir>/frontend/web/src-tauri/src/$1',
        '^\\$lib/(.*)$': '<rootDir>/frontend/web/src/lib/$1',
    },

    // Coverage settings. The L3 #44 spec calls for:
    //   lines/statements/functions >= 80%
    //   branches >= 70%
    // `coverageThreshold` is the gate; `coverageReporters` is the
    // human/machine output (the orchestrator script uploads the
    // lcov report to Codecov/Coveralls in CI).
    collectCoverage: false, // opt-in via --coverage flag
    coverageDirectory: 'coverage-ts',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageProvider: 'v8', // native V8 coverage, no babel
    collectCoverageFrom: [
        'frontend/web/src/**/*.{ts,js,svelte}',
        'frontend/web/src-tauri/src/**/*.{ts,js}',
        'tools/cli/src/**/*.{ts,js}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/*.config.{ts,js}',
        '!**/coverage/**',
    ],

    // The L3 #44 contract. Adjust `global` only with a spec bump;
    // per-file thresholds can be added without a spec change.
    coverageThreshold: {
        global: {
            lines: 80,
            statements: 80,
            functions: 80,
            branches: 70,
        },
    },
};
