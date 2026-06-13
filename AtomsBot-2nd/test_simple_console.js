// Simple test to check if console spy works
import { vi, describe, it, expect } from 'vitest';

// Create console spy like in the main test
const consoleSpy = {
  error: vi.fn(),
};

vi.stubGlobal('console', {
  ...console,
  error: consoleSpy.error,
});

describe('Simple Console Test', () => {
  it('should capture console.error calls', () => {
    console.error('Test message', new Error('Test error'));
    expect(consoleSpy.error).toHaveBeenCalledWith('Test message', expect.any(Error));
  });
});
