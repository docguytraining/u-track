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
 * stub). The question→module inference lives in ../onboarding/onboarding.ts; this
 * file owns the profile shape and the `applyOnboarding` merge that re-running
 * onboarding uses to edit the profile without ever wiping events (spec §7.1).
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
  /** Ids of the enabled tracking modules (spec §5.4). */
  enabledModules: readonly string[];
  /** Rarely-answered settings. */
  traits: Record<string, unknown>;
  /** Append-only observations. */
  events: readonly StoredRecord[];
}

/** What onboarding writes back: the confirmed module set and/or trait answers. */
export interface OnboardingUpdate {
  /** The confirmed enabled-module set. Replaces the current set when present. */
  enabledModules?: readonly string[];
  /** Trait answers to merge into the profile. */
  traits?: Record<string, unknown>;
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
 * Apply an onboarding pass: set the confirmed modules (if given) and merge trait
 * answers, leaving logged events completely untouched (spec §7.1). Pure — returns
 * a new profile and never mutates the input. Re-running onboarding is just calling
 * this again, so events survive every re-run.
 */
export function applyOnboarding(profile: Profile, update: OnboardingUpdate): Profile {
  return {
    enabledModules: update.enabledModules ?? profile.enabledModules,
    traits: update.traits ? { ...profile.traits, ...update.traits } : profile.traits,
    events: profile.events,
  };
}
