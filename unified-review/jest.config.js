module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/src/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@octokit/webhooks-methods$": "<rootDir>/src/__mocks__/webhooks-methods.js",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true }],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@octokit|universal-user-agent|before-after-hook|once|fast-content-type-parse|is-plain-object|nock|@nock|uuid|@ioredis|ioredis|js-yaml|argparse|pino)/)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
