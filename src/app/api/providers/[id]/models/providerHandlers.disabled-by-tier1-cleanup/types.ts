import { NextResponse } from "next/server";

/**
 * Shared context passed to all provider-specific model discovery handlers.
 * Contains parsed request parameters, connection data, pre-fetched catalog
 * models, and helper closures for building responses.
 */
export interface ProviderHandlerContext {
  // Request parameters
  provider: string;
  connectionId: string;
  apiKey: string;
  accessToken: string;
  excludeHidden: boolean;
  excludeCustom: boolean;
  refresh: boolean;
  chatOnly: boolean;

  // Connection data
  connection: Record<string, unknown> & {
    id?: string;
    provider?: string;
    apiKey?: string;
    accessToken?: string;
    providerSpecificData?: unknown;
    projectId?: string;
  };
  proxy: unknown;
  usesCuratedModelsOnly: boolean;
  autoFetchModels: boolean;

  // Pre-fetched catalog data
  cachedDiscoveryModels: Array<Record<string, unknown> & { id: string }>;
  providerSyncedModels: Array<{
    id: string;
    name: string;
    apiFormat?: string;
    supportedEndpoints?: string[];
  }> | null;
  registryCatalogModels: unknown[];
  specialtyCatalogModels: unknown[];
  customModelsForProvider: Array<Record<string, unknown> & { id: string; name?: string }>;

  // Helper functions (closures)
  buildResponse: (payload: Record<string, unknown>, statusConfig?: ResponseInit) => NextResponse;
  buildCachedDiscoveryResponse: (warning?: string) => NextResponse | null;
  buildLocalCatalogResponse: (warning?: string, intentional?: boolean) => NextResponse | null;
  buildDiscoveryFallbackResponse: (warnings?: {
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
  buildApiDiscoveryResponse: (
    models: Array<Record<string, unknown>>,
    warning?: string,
    extraPayload?: Record<string, unknown>
  ) => Promise<NextResponse>;
  toLocalCatalogModels: () => Array<{
    id: string;
    name: string;
    apiFormat?: string;
    supportedEndpoints?: string[];
    owned_by?: string;
  }>;
}

/**
 * A provider handler function that receives the shared context and returns
 * a NextResponse if it handles this provider, or null to delegate to the
 * next handler in the chain.
 */
export type ProviderHandler = (ctx: ProviderHandlerContext) => Promise<NextResponse | null>;
