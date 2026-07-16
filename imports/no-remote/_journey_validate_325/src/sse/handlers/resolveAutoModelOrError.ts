/**
 * Resolve built-in / persisted `auto` and `auto/*` model addresses.
 * getModelInfo() intentionally returns provider:null for these (combo router owns them).
 */
import { getComboForModel } from "../services/model";
import { createBuiltinAutoCombo } from "@omniroute/open-sse/services/autoCombo/builtinCatalog.ts";
import * as log from "../utils/logger";
import { errorResponse } from "@omniroute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";

export async function resolveAutoModelOrError(
  modelStr: string,
  modelInfo: { provider?: string | null; model?: string | null }
) {
  const isAutoAddress = modelStr === "auto" || modelStr.startsWith("auto/");
  if (!isAutoAddress && modelInfo.provider !== "auto") return null;

  const suffix =
    modelInfo.provider === "auto"
      ? modelInfo.model || ""
      : modelStr === "auto"
        ? ""
        : modelStr.slice("auto/".length);

  const exactCombo = await getComboForModel(modelStr);
  if (exactCombo) {
    log.info("ROUTING", `"auto" provider → combo "${modelStr}"`);
    return { combo: exactCombo, provider: "auto", model: suffix };
  }

  const fuzzyCandidates = [`auto/best-${suffix}`, `auto/${suffix}`];
  for (const candidate of fuzzyCandidates) {
    const fuzzyCombo = await getComboForModel(candidate);
    if (fuzzyCombo) {
      log.info("ROUTING", `"auto/${suffix}" → combo "${candidate}" (fuzzy)`);
      return { combo: fuzzyCombo, provider: "auto", model: suffix };
    }
  }

  try {
    const virtualCombo = await createBuiltinAutoCombo(modelStr, suffix);
    log.info(
      "AUTO",
      `"auto" provider → built-in virtual combo "${modelStr}" (${virtualCombo.candidatePool?.length || 0} candidates)`
    );
    return { combo: virtualCombo, provider: "auto", model: suffix };
  } catch (err) {
    log.warn("CHAT", `Failed to create built-in auto combo "${modelStr}"`, { err });
  }

  for (const candidate of fuzzyCandidates) {
    try {
      const virtualCombo = await createBuiltinAutoCombo(
        candidate,
        candidate.replace(/^auto\/?/, "")
      );
      log.info(
        "AUTO",
        `"auto/${suffix}" → built-in virtual combo "${candidate}" (fuzzy, ${virtualCombo.candidatePool?.length || 0} candidates)`
      );
      return { combo: virtualCombo, provider: "auto", model: suffix };
    } catch {
      /* Try next fuzzy candidate */
    }
  }

  const message = `Model '${modelStr}' is not a valid combo or provider. Unknown built-in auto combo.`;
  log.warn("CHAT", message, { model: modelStr });
  return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, message) };
}
