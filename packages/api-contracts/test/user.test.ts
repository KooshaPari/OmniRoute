import { test, expect } from 'vitest';
import { UserSchema } from '../src/user';

test('valid user with required fields', () => {
  const result = UserSchema.parse({
    id: 'u1',
    email: 'user@example.com',
    createdAt: '2026-06-15T00:00:00Z',
  });
  expect(result.id).toBe('u1');
  expect(result.email).toBe('user@example.com');
  expect(result.role).toBe('user'); // default
});

test('admin role is honored', () => {
  const result = UserSchema.parse({
    id: 'u1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
    createdAt: '2026-06-15T00:00:00Z',
  });
  expect(result.role).toBe('admin');
  expect(result.name).toBe('Admin');
});

test('rejects invalid email', () => {
  expect(() => UserSchema.parse({
    id: 'u1', email: 'not-an-email', createdAt: '2026-06-15T00:00:00Z'
  })).toThrow();
});

test('rejects unknown role', () => {
  expect(() => UserSchema.parse({
    id: 'u1', email: 'a@b.com', role: 'guest', createdAt: '2026-06-15T00:00:00Z'
  })).toThrow();
});

test('rejects missing required createdAt', () => {
  expect(() => UserSchema.parse({ id: 'u1', email: 'a@b.com' })).toThrow();
});
