export function HeroStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-text-muted font-semibold truncate">
        {label}
      </div>
      <div
        className={`text-2xl font-bold tabular-nums leading-tight ${accent || "text-text-main"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function SyncMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/30 bg-bg-base/40 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-text-muted font-semibold truncate">
        {label}
      </p>
      <p className="text-[11px] font-medium text-text-main mt-0.5 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-muted">
      <span className="font-semibold uppercase tracking-wide">{label}:</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-bg-base border border-border rounded-md px-2 py-1.5 text-xs text-text-main cursor-pointer focus:outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
