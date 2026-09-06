export type CapacityState = "open" | "nearly-full" | "full";

/**
 * How close a division is to its seat limit, so admissions sees a division
 * filling up before it hard-blocks at the capacity check on admission.
 * Divisions with no declared capacity have no state to report.
 */
export function capacityState(filled: number, capacity: number | null | undefined): CapacityState | null {
  if (capacity == null) return null;
  if (filled >= capacity) return "full";
  if (capacity > 0 && filled / capacity > 0.85) return "nearly-full";
  return "open";
}
