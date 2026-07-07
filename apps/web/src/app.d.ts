import type { SessionUser } from '@omniroute/shared-types';

declare global {
  namespace App {
    interface Error {
      code?: string;
    }
    interface Locals {
      user: SessionUser | null;
      requestId: string;
    }
    interface PageData {
      user: SessionUser | null;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
