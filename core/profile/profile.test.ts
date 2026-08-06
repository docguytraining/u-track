import { describe, it, expect } from 'vitest';
import {
  eventObservations,
  meanObservation,
  applyOnboarding,
  type StoredRecord,
  type Profile,
} from './profile';

/**
 * Group F — Traits vs events (spec §5.1, §9.F).
 * A trait is a rarely-answered setting; an event is a timestamped observation.
 * They must never be averaged together.
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

  it('F(bonus): re-running onboarding edits the profile but never deletes logged events', () => {
    const before: Profile = {
      traits: { usualWarningTime: 100 },
      events: [
        { kind: 'event', at: 1, value: 3 },
        { kind: 'event', at: 2, value: 5 },
      ],
    };

    const after = applyOnboarding(before, { usualWarningTime: 30, awareness: 'delayed' });

    expect(after.traits.usualWarningTime).toBe(30); // edited
    expect(after.traits.awareness).toBe('delayed'); // added
    expect(after.events).toEqual(before.events); // events untouched
    expect(before.traits.usualWarningTime).toBe(100); // input not mutated
  });
});
