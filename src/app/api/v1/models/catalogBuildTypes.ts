/**
 * Shared context type for catalog build sub-modules.
 *
 * Each extracted module (comboMetadata, autoCombos, specialtyModels, syncedModels,
 * staticModels, customModels) accepts a subset of this context via destructuring.
 * catalog.ts creates the full context and passes it to each module.
 */
import type { ModelCapabilityResolutionSnapshot } from "@/lib/modelCapabilityResolutionSnapshot";
import type { SyncedAvailableModel } from "@/lib/db/models";
import type {
  ComboCatalogTarget,
  ConnectionScopedReasoningCatalog,
} from "./catalogHelpers";

export type CatalogBuildContext = {
  /** Mutable models array — all loops push entries here. */
  models: Array<Record<string, unknown>>;
  /** Unix epoch seconds — used as `created` for all entries. */
  timestamp: number;
  /** Database settings (may be empty on error). */
  settings: Record<string, unknown>;
  /** Active (non-disabled) provider connections. */
  connections: Array<{
    id: string;
    provider: string;
    isActive?: boolean;
    [key: string]: unknown;
  }>;
  /** Provider node list (compatible providers). */
  providerNodes: Array<{
    id: string;
    prefix?: string;
    name?: string;
    type?: string;
  }>;
  /** All user-defined combos. */
  combos: Array<{
    name: string;
    isActive?: boolean;
    isHidden?: boolean;
    context_length?: number;
    [key: string]: unknown;
  }>;

  // -- Maps --
  aliasToProviderId: Record<string, string>;
  providerIdToAlias: Record<string, string>;
  providerIdToPrefix: Record<string, string>;
  providerNodeIdByPrefix: Record<string, string>;
  nodeIdToProviderType: Record<string, string>;

  // -- Filter flags --
  blockedProviders: Set<string>;
  activeAliases: Set<string>;
  hidePaid: boolean;
  hideAuto: boolean;
  includeAlias: boolean;
  includeCanonical: boolean;
  prefixMode: string;
  hideNoThinkVariants: boolean;

  // -- Resolution snapshot --
  capabilityResolutionSnapshot: ModelCapabilityResolutionSnapshot;

  // -- Helper functions (closures from buildUnifiedModelsResponseCore) --
  resolveCanonicalProviderId: (aliasOrProviderId: string, fallbackProviderId?: string) => string;
  resolvePublicOwnerId: (providerId: string, canonicalProviderId: string) => string;
  providerSupportsModel: (providerKey: string, modelId: string) => boolean;
  isModelHiddenBulk: (
    providerKey: string | null | undefined,
    modelId: string,
    canonicalProviderId?: string | null,
    modality?: string
  ) => boolean;
  isExcludedByProviderConnections: (providerKey: string, modelId: string) => boolean;
  shouldHidePaid: (
    providerKey: string,
    modelId: string,
    pricing?: unknown,
    isFree?: boolean
  ) => boolean;
  shouldHideByExposure: (providerKey: string, modelId: string) => boolean;
  getConnectionsForProvider: (
    ...keys: Array<string | null | undefined>
  ) => Array<{ id: string; [key: string]: unknown }>;
  getRegistryModel: (providerId: string, modelId: string) => Record<string, unknown> | null;
  prefixRoutesToProvider: (canonicalProviderId: string, providerId: string) => boolean;

  // -- Combo-related --
  comboSyncedModelsByProvider: Map<string, ConnectionScopedReasoningCatalog | null>;
  getComboTargetModelId: (
    target: ComboCatalogTarget
  ) => { providerId: string; modelId: string } | null;
  syncedModelIdsByCanonicalProvider: Map<string, Set<string>>;
  syncedModelsByProvider: Record<string, SyncedAvailableModel[]>;
  providersWithSyncedModels: Set<string>;

  // -- Yield --
  maybeYieldCatalogBuild: () => Promise<void>;
};
