/**
 * Auth — Arctic OAuth + session cookies.
 */
import { z } from 'zod';
import { UserId, SessionId, ISODateString } from './primitives.ts';

export const AuthProviderKind = z.enum([
  'google', 'github', 'gitlab', 'microsoft', 'apple', 'discord', 'okta', 'auth0', 'password',
]);
export type AuthProviderKind = z.infer<typeof AuthProviderKind>;

export const SessionUser = z.object({
  id: UserId,
  email: z.email().max(320),
  displayName: z.string().min(1).max(120),
  avatarUrl: z.url().optional(),
  role: z.enum(['owner', 'admin', 'operator', 'viewer']),
  createdAt: ISODateString,
}).readonly();
export type SessionUser = z.infer<typeof SessionUser>;

export const Session = z.object({
  id: SessionId,
  user: SessionUser,
  issuedAt: ISODateString,
  expiresAt: ISODateString,
  csrfToken: z.string().min(32).max(128),
  ip: z.string().max(64).optional(),
  userAgent: z.string().max(512).optional(),
}).readonly();
export type Session = z.infer<typeof Session>;

export const LoginRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('password'), email: z.email(), password: z.string().min(1).max(512) }).readonly(),
  z.object({ kind: z.literal('oauth'), provider: AuthProviderKind, redirectTo: z.url().optional() }).readonly(),
]);
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LogoutRequest = z.object({
  everywhere: z.boolean().default(false),
}).readonly();
export type LogoutRequest = z.infer<typeof LogoutRequest>;
