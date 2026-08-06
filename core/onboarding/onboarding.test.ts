import { describe, it, expect } from 'vitest';
import { inferModules, quickOnboard, type QuickOnboardingAnswers } from './onboarding';
import { applyOnboarding, type Profile } from '../profile/profile';

const emptyProfile = (): Profile => ({ enabledModules: [], traits: {}, events: [] });

/**
 * Onboarding — tiered, infer-then-confirm (spec §7.1, test §9.18).
 * Quick onboarding infers modules from plain-language symptom answers; the user
 * confirms/edits that set; re-running never deletes logged events.
 */
describe('Onboarding inference (§9.18)', () => {
  it('quick-onboarding answers map to the expected enabled-module set', () => {
    expect(new Set(inferModules({ wakesToUrinateAtNight: true, hasEmptyingTrouble: true }))).toEqual(
      new Set(['nocturia', 'bph']),
    );

    // "Wake up wet" brings protection tracking with it.
    expect(new Set(inferModules({ wakesUpWet: true }))).toEqual(
      new Set(['nightWetting', 'protection']),
    );

    // Reduced awareness enables the bladder-awareness module.
    expect(inferModules({ reducedAwareness: true })).toEqual(['awareness']);

    // No symptoms → no modules (every surface is a pure tap until Settings override).
    expect(inferModules({})).toEqual([]);
  });

  it('infer, then confirm: inference is a suggestion the user can override before applying', () => {
    const answers: QuickOnboardingAnswers = { wakesToUrinateAtNight: true, hasUrgency: true };
    const suggested = inferModules(answers); // ['nocturia', 'urgency']
    expect(new Set(suggested)).toEqual(new Set(['nocturia', 'urgency']));

    // In the confirm step the user drops urgency and adds bph.
    const confirmed = ['nocturia', 'bph'];
    const profile = applyOnboarding(emptyProfile(), { enabledModules: confirmed });
    expect(new Set(profile.enabledModules)).toEqual(new Set(confirmed));

    // quickOnboard is the convenience path that applies the inferred set directly.
    const inferredProfile = quickOnboard(emptyProfile(), answers);
    expect(new Set(inferredProfile.enabledModules)).toEqual(new Set(suggested));
  });

  it('re-running onboarding edits the profile but never deletes logged events', () => {
    const before: Profile = {
      enabledModules: ['nocturia'],
      traits: { warningTime: 'less_than_5_minutes' },
      events: [
        { kind: 'event', at: 1, value: 3 },
        { kind: 'event', at: 2, value: 5 },
      ],
    };

    const after = applyOnboarding(before, {
      enabledModules: ['nocturia', 'leakage'],
      traits: { awareness: 'delayed' },
    });

    expect(new Set(after.enabledModules)).toEqual(new Set(['nocturia', 'leakage'])); // edited
    expect(after.traits).toEqual({ warningTime: 'less_than_5_minutes', awareness: 'delayed' }); // merged
    expect(after.events).toEqual(before.events); // events untouched
    expect(before.enabledModules).toEqual(['nocturia']); // input not mutated
  });
});
