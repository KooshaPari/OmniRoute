import { test, expect } from 'vitest';
import { tokens } from '../src/index';

test('primary is coral', () => {
  expect(tokens.colors.primary).toBe('#e54d5e');
});

test('accent is indigo', () => {
  expect(tokens.colors.accent).toBe('#6366f1');
});
