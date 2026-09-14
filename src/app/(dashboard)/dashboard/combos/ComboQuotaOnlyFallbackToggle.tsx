import type { ComboStep } from "@/lib/combos/steps";

type Translate = (key: string, fallback: string) => string;

type Props = {
  strategy: string;
  entry: ComboStep;
  index: number;
  hasPricing: boolean;
  translate: Translate;
  onCheckedChange: (index: number, enabled: boolean) => void;
};

export function ComboTargetOptions({
  strategy,
  entry,
  index,
  hasPricing,
  translate,
  onCheckedChange,
}: Props) {
  return (
    <>
      {strategy === "cost-optimized" && (
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
            hasPricing
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}
          title={translate(
            hasPricing ? "pricingAvailable" : "pricingMissing",
            hasPricing ? "Pricing available" : "No pricing"
          )}
        >
          {translate(
            hasPricing ? "pricingAvailableShort" : "pricingMissingShort",
            hasPricing ? "priced" : "no-price"
          )}
        </span>
      )}
      {strategy === "priority" && (entry.kind === "model" || entry.kind === "combo-ref") && (
        <label className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
          <input
            type="checkbox"
            checked={entry.fallbackOnlyOnQuotaExhaustion === true}
            onChange={(event) => onCheckedChange(index, event.target.checked)}
            aria-label={translate(
              "fallbackOnlyOnQuotaExhaustion",
              "Only advance on quota exhaustion"
            )}
          />
          <span className="hidden lg:inline">
            {translate("fallbackOnlyOnQuotaExhaustionShort", "quota-only fallback")}
          </span>
        </label>
      )}
    </>
  );
}
