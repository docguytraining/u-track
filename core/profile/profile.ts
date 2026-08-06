/**
 * Traits vs events — the separation that keeps reports honest (spec §5.1, §9.F).
 *
 * A TRAIT is answered rarely (onboarding/settings) and lives in the profile: "how
 * much warning do you usually get?", "do you catheterise?". An EVENT is a
 * timestamped fact about a single moment. Averaging a setting into an observed
 * series is exactly the old-draft bug this module prevents — the two kinds are
 * distinct types and only events flow into event-series statistics.
 *
 * NOTE (design, open to revision): this module and its shapes are new (no scaffold
 * stub). `applyOnboarding` covers the §7.1 rule that re-running onboarding edits
 * the profile without wiping events; the question→module inference of test §9.18
 * is intentionally left out — its wording is a clinical/product decision for you.
 */

/** A timestamped observation drawn from events. */
export interface Observation {
  at: number;
  value: number;
}

/** A record in the store is exactly one of two kinds — never both. */
export type StoredRecord =
  | { kind: 'trait'; key: string; value: number }
  | { kind: 'event'; at: number; value: number };

export interface Profile {
  /** Rarely-answered settings. */
  traits: Record<string, unknown>;
  /** Append-only observations. */
  events: readonly StoredRecord[];
}

/** Extract only the event observations — traits are structurally excluded. */
export function eventObservations(records: readonly StoredRecord[]): Observation[] {
  const out: Observation[] = [];
  for (const r of records) {
    if (r.kind === 'event') out.push({ at: r.at, value: r.value });
  }
  return out;
}

/** Mean of an event series; null (not zero) when there is nothing to average. */
export function meanObservation(observations: readonly Observation[]): number | null {
  if (observations.length === 0) return null;
  const sum = observations.reduce((s, o) => s + o.value, 0);
  return sum / observations.length;
}

/**
 * Re-running onboarding merges answered traits into the profile and leaves logged
 * events completely untouched (spec §7.1). Pure — returns a new profile.
 */
export function applyOnboarding(profile: Profile, answers: Record<string, unknown>): Profile {
  return {
    traits: { ...profile.traits, ...answers },
    events: profile.events,
  };
}
