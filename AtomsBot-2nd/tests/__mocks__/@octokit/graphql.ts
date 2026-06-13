/**
 * Vitest Mock for @octokit/graphql
 * 
 * This file is automatically loaded by Vitest when @octokit/graphql is imported
 * in any test file.
 */

import { vi } from "vitest";
import githubMocks from "../../mocks/github";

// Create the mock graphql function with defaults method that has mockReturnValue
const mockGraphqlFunction = Object.assign(
  vi.fn().mockImplementation((query: string, variables?: any) => {
    return Promise.resolve({
      repository: {
        issues: { nodes: [], totalCount: 0 },
        pullRequests: { nodes: [], totalCount: 0 }
      }
    });
  }),
  {
    defaults: Object.assign(
      vi.fn().mockImplementation((options: any) => {
        return vi.fn().mockImplementation((query: string, variables?: any) => {
          return Promise.resolve({
            repository: {
              issues: { nodes: [], totalCount: 0 },
              pullRequests: { nodes: [], totalCount: 0 }
            }
          });
        });
      }),
      {
        // This is what the test needs - mockReturnValue method on defaults
        mockReturnValue: vi.fn().mockReturnThis(),
        mockImplementation: vi.fn().mockReturnThis(),
        mockResolvedValue: vi.fn().mockReturnThis(),
        mockRejectedValue: vi.fn().mockReturnThis(),
        mockClear: vi.fn().mockReturnThis(),
        mockReset: vi.fn().mockReturnThis(),
        mockRestore: vi.fn().mockReturnThis(),
      }
    )
  }
);

// Export the graphql mock function as named export (this is what require() destructuring expects)
export const graphql = mockGraphqlFunction;

// For CommonJS compatibility, export as an object with graphql property
module.exports = {
  graphql: mockGraphqlFunction,
  default: mockGraphqlFunction,
};

// Set as default export for ES6 imports
export default mockGraphqlFunction;