export type TimeSeriesOptions<T> = {
  count: number;
  stepMs: number;
  now: () => number;
  mapPoint: (index: number, timestampMs: number) => T;
  endOffsetSteps?: number;
};

/** Build ascending time-series points from a single captured clock reading. */
export function buildTimeSeries<T>({
  count,
  stepMs,
  now,
  mapPoint,
  endOffsetSteps = 0,
}: TimeSeriesOptions<T>): T[] {
  const nowMs = now();

  return Array.from({ length: count }, (_, index) => {
    const stepsFromNow = count - 1 - index + endOffsetSteps;
    return mapPoint(index, nowMs - stepsFromNow * stepMs);
  });
}

export type ObservabilityTimeseriesPoint = {
  ts: string;
  latency: number;
};

export type KeyUsagePoint = {
  date: string;
  requests: number;
};

function secureRandomUnit(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296;
}

/** 60 one-minute latency points; trailing offset matches legacy dashboard semantics. */
export function buildObservabilityLatencySeries(
  now: () => number = Date.now,
  random: () => number = secureRandomUnit,
): ObservabilityTimeseriesPoint[] {
  return buildTimeSeries({
    count: 60,
    stepMs: 60_000,
    now,
    endOffsetSteps: 1,
    mapPoint: (_, timestampMs) => ({
      ts: new Date(timestampMs).toISOString(),
      latency: 100 + random() * 800,
    }),
  });
}

/** 30 one-day usage points. */
export function buildKeyUsageSeries(
  now: () => number = Date.now,
  random: () => number = secureRandomUnit,
): KeyUsagePoint[] {
  return buildTimeSeries({
    count: 30,
    stepMs: 86_400_000,
    now,
    mapPoint: (_, timestampMs) => ({
      date: new Date(timestampMs).toISOString().slice(0, 10),
      requests: Math.floor(random() * 1000),
    }),
  });
}
