import { describe, it, expect } from 'vitest';
import { mergeOnSignIn } from './mergeOnSignIn';

/**
 * Sign-in hydration policy (spec §2.3). The bug that shipped: signing in from guest
 * mode wiped local data because hydrate loaded an empty new-account doc. These tests
 * pin the correct behavior — migrate on first sign-in, isolate returning accounts.
 */
const defaults = { onboarded: false, entries: [] as number[], units: 'oz' };

describe('mergeOnSignIn — sign-in hydration', () => {
  it('REGRESSION: first sign-in (no cloud doc) migrates local/guest data in — never deletes it', () => {
    const local = { onboarded: true, entries: [1, 2, 3], units: 'ml' };
    expect(mergeOnSignIn(defaults, local, null)).toEqual(local);
  });

  it('returning account loads only its own cloud data, not the local session', () => {
    const local = { onboarded: true, entries: [1, 2, 3], units: 'ml' };
    const cloud = { onboarded: true, entries: [9], units: 'oz' };
    expect(mergeOnSignIn(defaults, local, cloud)).toEqual(cloud);
  });

  it('a field absent from the cloud doc falls back to DEFAULTS, never to local (isolation)', () => {
    const local = { onboarded: true, entries: [1, 2, 3], units: 'ml' };
    const cloud = { entries: [9] }; // no units, no onboarded
    const result = mergeOnSignIn(defaults, local, cloud);
    expect(result.entries).toEqual([9]);
    expect(result.units).toBe('oz'); // default — NOT local 'ml'
    expect(result.onboarded).toBe(false); // default — NOT local true
  });

  it('first sign-in with empty local yields the defaults', () => {
    expect(mergeOnSignIn(defaults, defaults, null)).toEqual(defaults);
  });
});
