export type TimeSeriesOptions<T> = {
  count: number;
  stepMs: number;
  now: () => number;
  mapPoint: (index: number, timestampMs: number) => T;
  endOffsetSteps?: number;
};

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
