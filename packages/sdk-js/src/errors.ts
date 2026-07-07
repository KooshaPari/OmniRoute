/**
 * AppError decoder — turns a JSON AppErrorEnvelope into a typed Error.
 */
import { AppError, AppErrorEnvelope } from '@omniroute/shared-types';

export class SdkError extends Error {
  constructor(public readonly error: AppError) {
    super(error.message);
    this.name = 'SdkError';
  }
}

export function decodeAppError(json: unknown): SdkError {
  const env = AppErrorEnvelope.parse(json);
  return new SdkError(env.error);
}

export function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value;
}
