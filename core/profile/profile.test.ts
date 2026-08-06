import { describe, it, expect } from 'vitest';
import { eventObservations, meanObservation, type StoredRecord } from './profile';

/**
 * Group F — Traits vs events (spec §5.1, §9.F).
 * A trait is a rarely-answered setting; an event is a timestamped observation.
 * They must never be averaged together. (Re-run-preserves-events is covered in
 * ../onboarding/onboarding.test.ts, alongside the §9.18 inference tests.)
 */
describe('F. Traits vs events', () => {
  it('F21: a trait value is never averaged into an event-series statistic', () => {
    // Warning-time OBSERVATIONS (events): 3, 5, 4 → mean 4.
    // A self-reported "usual warning time" TRAIT of 100 sits in the same store and
    // must not contaminate the observed mean.
    const records: StoredRecord[] = [
      { kind: 'trait', key: 'usualWarningTime', value: 100 },
      { kind: 'event', at: 1, value: 3 },
      { kind: 'event', at: 2, value: 5 },
      { kind: 'event', at: 3, value: 4 },
    ];

    const observations = eventObservations(records);
    expect(observations).toHaveLength(3); // the trait is excluded structurally
    expect(meanObservation(observations)).toBe(4); // NOT (3+5+4+100)/4 = 28

    // Empty series is honestly null, not zero.
    expect(meanObservation([])).toBeNull();
  });
});
