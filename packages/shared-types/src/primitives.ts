/**
 * Canonical primitive types for argismonitor.
 * Branded types prevent mixing IDs (e.g. ProviderId vs ApiKeyId).
 */
import { z } from 'zod';

export const branded = <Brand extends string>(name: Brand) =>
  z.string().min(20).max(30).regex(/^[0-9A-HJKMNP-TV-Z]{26}$/u, `invalid ${name} ULID`).brand<Brand>();

export const ProviderId = branded('ProviderId');
export const ApiKeyId = branded('ApiKeyId');
export const ComboId = branded('ComboId');
export const ModelId = branded('ModelId');
export const RequestId = branded('RequestId');
export const SessionId = branded('SessionId');
export const UserId = branded('UserId');

export const ISODateString = z.iso.datetime({ offset: true }).brand<'ISODateString'>();
export const NonEmptyString = z.string().min(1).max(8192);
export const HttpUrl = z.url().startsWith('http').max(2048);
export const UnixSocketPath = z.string().regex(/^\/[a-zA-Z0-9._/-]+$/u, 'must be an absolute Unix socket path');

export type ProviderId = z.infer<typeof ProviderId>;
export type ApiKeyId = z.infer<typeof ApiKeyId>;
export type ComboId = z.infer<typeof ComboId>;
export type ModelId = z.infer<typeof ModelId>;
export type RequestId = z.infer<typeof RequestId>;
export type SessionId = z.infer<typeof SessionId>;
export type UserId = z.infer<typeof UserId>;
export type ISODateString = z.infer<typeof ISODateString>;
