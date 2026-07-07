/**
 * Health status and reports.
 */
import { z } from 'zod';
import { ISODateString, UnixSocketPath } from './primitives.ts';

export const HealthStatus = z.enum(['healthy', 'degraded', 'unhealthy']);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const ComponentHealth = z.object({
  name: z.string().min(1).max(64),
  status: HealthStatus,
  message: z.string().max(2048).optional(),
  latencyMs: z.number().int().min(0).max(600_000).optional(),
  checkedAt: ISODateString,
}).readonly();
export type ComponentHealth = z.infer<typeof ComponentHealth>;

export const HealthReport = z.object({
  status: HealthStatus,
  version: z.string().min(1).max(64),
  uptimeSeconds: z.number().int().min(0),
  components: z.array(ComponentHealth).default([]),
  kbridgeSocket: UnixSocketPath.optional(),
  timestamp: ISODateString,
}).readonly();
export type HealthReport = z.infer<typeof HealthReport>;

export const PingResponse = z.object({
  pong: z.literal(true),
  latencyMs: z.number().int().min(0).max(60_000),
  ts: z.number().int().min(0),
}).readonly();
export type PingResponse = z.infer<typeof PingResponse>;
