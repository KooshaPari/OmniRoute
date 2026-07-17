export type Availability = { status?: "unavailable"; source?: string };

export function unavailableMessage(
  value: Availability | null | undefined,
  subject: string
): string | null {
  if (value?.status !== "unavailable") return null;
  return `${subject} is unavailable (${value.source ?? "unknown source"}).`;
}
