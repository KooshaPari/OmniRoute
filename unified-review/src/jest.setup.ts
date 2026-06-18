// Jest setup — mock heavy external modules
jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      pulls: {
        get: jest.fn().mockResolvedValue({ data: { number: 1, head: { sha: "abc" }, base: { sha: "def" } } }),
        createReview: jest.fn().mockResolvedValue({ data: { id: 1001 } }),
        listReviews: jest.fn().mockResolvedValue({ data: [] }),
      },
      checks: {
        create: jest.fn().mockResolvedValue({ data: { id: 2001 } }),
        update: jest.fn().mockResolvedValue({ data: { id: 2001 } }),
      },
      repos: {
        compareCommits: jest.fn().mockResolvedValue({ data: { files: [] } }),
        getContent: jest.fn().mockResolvedValue({ data: { content: "" } }),
      },
      issues: {
        addLabels: jest.fn().mockResolvedValue({ data: [] }),
        removeLabel: jest.fn().mockResolvedValue({ data: {} }),
        listLabelsOnIssue: jest.fn().mockResolvedValue({ data: [] }),
      },
    },
  })),
}));

jest.mock("@octokit/auth-app", () => ({
  createAppAuth: jest.fn().mockReturnValue(() => Promise.resolve("mock-token")),
}));

jest.mock("@octokit/webhooks", () => ({
  Webhooks: jest.fn().mockImplementation(() => ({
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock("@octokit/webhooks-methods", () => ({
  verify: jest.fn().mockResolvedValue(true),
}));

jest.mock("pino", () => {
  const stub = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
  const factory = () => stub;
  factory.default = factory;
  factory.stdSerializers = { err: (e: unknown) => e };
  return factory;
});
