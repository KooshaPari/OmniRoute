"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

interface FreeProviderOption {
  id: string;
  name: string;
  website: string;
  caution: string;
  defaultModel?: string;
}

interface SetupResult {
  providerId: string;
  status: "created" | "skipped" | "failed";
  reason?: string;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export function FreeProviderOnboardingCard() {
  const t = useTranslations("onboarding.freeProviders");
  const [providers, setProviders] = useState<FreeProviderOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SetupResult[]>([]);

  useEffect(() => {
    let active = true;
    void fetch("/api/providers/free-onboarding")
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok) throw new Error("load-failed");
        const options = Array.isArray(data.providers)
          ? (data.providers as FreeProviderOption[])
          : [];
        if (!active) return;
        setProviders(options);
        setSelectedIds(options.map((provider) => provider.id).sort());
      })
      .catch(() => {
        if (active) setError(t("loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const failedIds = useMemo(
    () => results.filter((result) => result.status === "failed").map((result) => result.providerId),
    [results]
  );

  const toggleProvider = (providerId: string) => {
    setSelectedIds((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId].sort()
    );
    setConfirmed(false);
  };

  const submit = async (providerIds = selectedIds) => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/providers/free-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerIds, confirmed: true }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error("setup-failed");
      setResults(Array.isArray(data.results) ? (data.results as SetupResult[]) : []);
    } catch {
      setError(t("setupFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-xs text-text-muted">{t("loading")}</p>;
  if (providers.length === 0 && !error) {
    return <p className="text-xs text-text-muted">{t("alreadyConfigured")}</p>;
  }

  return (
    <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text-main">{t("title")}</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{t("description")}</p>
      </div>

      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {providers.map((provider) => (
          <label
            key={provider.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(provider.id)}
              onChange={() => toggleProvider(provider.id)}
              className="mt-1 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-text-main">{provider.name}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-amber-300/90">
                {provider.caution}
              </span>
              <a
                href={provider.website}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11px] text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {t("reviewProviderSite")}
              </a>
            </span>
          </label>
        ))}
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-xs text-text-muted">
        <input
          data-testid="free-provider-confirmation"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 accent-primary"
        />
        <span>{t("confirmation")}</span>
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {results.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted">
          {results.map((result) => (
            <li key={result.providerId}>
              {result.providerId}: {t(`result.${result.status}`)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          data-testid="setup-free-providers"
          type="button"
          disabled={!confirmed || selectedIds.length === 0 || submitting}
          onClick={() => void submit()}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t("settingUp") : t("setupSelected")}
        </button>
        {failedIds.length > 0 && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit(failedIds)}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-text-main disabled:opacity-50"
          >
            {t("retryFailed")}
          </button>
        )}
      </div>
    </section>
  );
}
