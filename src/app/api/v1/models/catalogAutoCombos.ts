/**
 * Auto-combo synthesis — builds `auto/*` virtual combo entries for the catalog.
 *
 * Extracted from catalog.ts to reduce file size.
 */
import {
  AUTO_TEMPLATE_VARIANTS,
  AUTO_SUFFIX_VARIANTS,
  AUTO_FAMILY_IDS,
  createBuiltinAutoCombo,
  prepareBuiltinAutoComboInputs,
  isPaidTierAutoId,
} from "@omniroute/open-sse/services/autoCombo/builtinCatalog";
import {
  type ComboCatalogTarget,
  type ComboTargetCatalogMetadata,
  intersectKnownStringArrays,
} from "./catalogHelpers";
import {
  getComboTargetCatalogMetadata,
  type ComboMetadataPick,
} from "./catalogComboMetadata";

/** Yield cadence for the auto-combo loop. */
export const BUILTIN_AUTO_YIELD_INTERVAL = 2;

type AutoSynthPick = Pick<
  ComboMetadataPick,
  "capabilityResolutionSnapshot" | "getComboTargetModelId" | "getConnectionsForProvider" | "getRegistryModel"
> & {
  models: Array<Record<string, unknown>>;
  hideAuto: boolean;
  hidePaid: boolean;
  blockedProviders: Set<string>;
  listedIds: Set<string>;
  comboSyncedModelsByProvider: ComboMetadataPick["comboSyncedModelsByProvider"];
  providerIdToAlias: Record<string, string>;
};

/**
 * Synthesize built-in `auto/*` combo entries and push them to `ctx.models`.
 *
 * @returns The number of materialized auto combos.
 */
export async function synthesizeAutoCombos(
  ctx: AutoSynthPick,
  yieldCatalogBuildTurn: () => Promise<void>
): Promise<number> {
  const {
    models,
    hideAuto,
    hidePaid,
    blockedProviders,
    listedIds,
    capabilityResolutionSnapshot,
    providerIdToAlias,
  } = ctx;

  const comboMetadataCtx: ComboMetadataPick = {
    capabilityResolutionSnapshot,
    providerIdToAlias: ctx.providerIdToAlias,
    getComboTargetModelId: ctx.getComboTargetModelId,
    getConnectionsForProvider: ctx.getConnectionsForProvider,
    getRegistryModel: ctx.getRegistryModel,
    comboSyncedModelsByProvider: ctx.comboSyncedModelsByProvider,
  };

  const timestamp = Math.floor(Date.now() / 1000);
  let preparedAutoInputs: Awaited<ReturnType<typeof prepareBuiltinAutoComboInputs>> | undefined;
  let materializedAutoCount = 0;

  for (const autoId of [
    ...Object.keys(AUTO_TEMPLATE_VARIANTS),
    ...AUTO_SUFFIX_VARIANTS,
    ...AUTO_FAMILY_IDS,
  ]) {
    // #9418: skip the entire loop when hideAutoCombos is on.
    if (hideAuto) break;
    if (blockedProviders.has("auto") || listedIds.has(autoId)) continue;
    // #6328: remove paid-tier auto/* ids when hidePaidModels is on.
    if (hidePaid && isPaidTierAutoId(autoId)) continue;
    listedIds.add(autoId);

    const baseAutoEntry = {
      id: autoId,
      object: "model",
      created: timestamp,
      owned_by: "combo",
      permission: [],
      root: autoId,
      parent: null,
    };

    try {
      const suffix = autoId.replace(/^auto\/?/, "");
      if (!preparedAutoInputs) {
        preparedAutoInputs = await prepareBuiltinAutoComboInputs(capabilityResolutionSnapshot);
        await yieldCatalogBuildTurn();
      }
      const virtualCombo = await createBuiltinAutoCombo(autoId, suffix, preparedAutoInputs);
      const contextLength = virtualCombo.advertisedContextLength || 128000;
      const maxOutputTokens = virtualCombo.advertisedMaxOutputTokens || 8192;

      // #11947: derive modalities and vision from the effective target pool.
      const autoTargets: ComboCatalogTarget[] = virtualCombo.models.map((m) => ({
        modelStr: m.model,
        providerId: m.providerId,
        connectionId: m.connectionId,
        ...(m.allowedConnectionIds ? { allowedConnectionIds: m.allowedConnectionIds } : {}),
      }));
      const autoTargetMetadata = autoTargets.map((t) =>
        getComboTargetCatalogMetadata(t, comboMetadataCtx)
      );
      const knownAutoMeta = autoTargetMetadata.filter(
        (m): m is ComboTargetCatalogMetadata => m !== null
      );
      const autoInputModalities = intersectKnownStringArrays(
        knownAutoMeta.map((m) => (Array.isArray(m.inputModalities) ? m.inputModalities : []))
      );
      const autoOutputModalities = intersectKnownStringArrays(
        knownAutoMeta.map((m) => (Array.isArray(m.outputModalities) ? m.outputModalities : []))
      );
      const autoCapabilities: Record<string, boolean | string[]> = {
        tool_calling: true,
        reasoning: true,
        thinking: true,
        temperature: true,
      };
      if (knownAutoMeta.length > 0) {
        const allVision = knownAutoMeta.every((m) => m.capabilities.vision === true);
        if (allVision) autoCapabilities.vision = true;
      }

      models.push({
        ...baseAutoEntry,
        context_length: contextLength,
        max_input_tokens: contextLength,
        max_output_tokens: maxOutputTokens,
        ...(autoInputModalities.length > 0 ? { input_modalities: autoInputModalities } : {}),
        ...(autoOutputModalities.length > 0 ? { output_modalities: autoOutputModalities } : {}),
        capabilities: autoCapabilities,
      });
    } catch (err) {
      console.log(`[catalog] Could not materialize built-in auto model ${autoId}:`, err);
      models.push(baseAutoEntry);
    }

    materializedAutoCount++;
    if (materializedAutoCount % BUILTIN_AUTO_YIELD_INTERVAL === 0) {
      await yieldCatalogBuildTurn();
    }
  }

  return materializedAutoCount;
}
