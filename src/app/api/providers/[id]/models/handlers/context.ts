import { NextResponse } from "next/server";

/**
 * Shared context passed to every provider-specific handler.
 * Built once in route.ts from the connection + query params, then
 * threaded through each handler so they don't need to repeat setup.
 */
export interface HandlerContext {
  provider: string;
  connectionId: string;
  apiKey: string;
  accessToken: string;
  autoFetchModels: boolean;
  refresh: boolean;
  excludeHidden: boolean;
  chatOnly: boolean;
  usesCuratedModelsOnly: boolean;
  proxy: Record<string, unknown> | null;
  connection: {
    id: string;
    provider: string;
    apiKey: string;
    accessToken: string;
    providerSpecificData: unknown;
    projectId?: string;
  };
  customModelsForProvider: Array<Record<string, unknown> & { id: string; name?: string }>;
  cachedDiscoveryModels: Array<{ id: string; name?: string }>;
  providerSyncedModels: Array<{
    id: string;
    name: string;
    apiFormat?: string;
    supportedEndpoints?: string[];
  }> | null;
  registryCatalogModels: unknown[];
  specialtyCatalogModels: unknown[];
}

/** Return type for provider-specific handlers. */
export type HandlerResult = NextResponse | null;

/**
 * Helper builders that handlers receive from route.ts so they can
 * produce consistent responses without duplicating logic.
 */
export interface HandlerHelpers {
  buildResponse: (payload: any, statusConfig?: ResponseInit) => NextResponse;
  buildApiDiscoveryResponse: (
    models: any[],
    warning?: string,
    extraPayload?: Record<string, unknown>
  ) => Promise<NextResponse>;
  buildCachedDiscoveryResponse: (warning?: string) => NextResponse;
  buildLocalCatalogResponse: (warning?: string, intentional?: boolean) => NextResponse | null;
  buildDiscoveryFallbackResponse: (opts?: {
    cacheWarning?: string;
    localWarning?: string;
    localIntentional?: boolean;
  }) => NextResponse | null;
  buildDiscoveryErrorFallbackResponse: (
    error: unknown,
    warnings?: { cacheWarning?: string; localWarning?: string }
  ) => NextResponse | null;
  maybeReturnCachedDiscovery: () => NextResponse | null;
  maybeReturnAutoFetchDisabled: () => NextResponse | null;
  toLocalCatalogModels: () => Array<{
    id: string;
    name: string;
    apiFormat?: string;
    supportedEndpoints?: string[];
    owned_by?: string;
  }>;
  mergeCustomModels: (models: any[]) => any[];
}
