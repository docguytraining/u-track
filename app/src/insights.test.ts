import { describe, it, expect } from 'vitest';
import { groupByDay, isWetNight, isDryNight, tally, share, humanize, durationStr } from './insights';
import type { VoidEntry, LeakEntry, NightEntry, DrinkEntry } from './store';

const H = 3_600_000;
const DAY = 86_400_000;
const noon = Date.UTC(2026, 7, 5, 12); // Aug 5 2026, noon UTC — safe from midnight TZ flips

const v = (at: number, answers: Record<string, string> = {}): VoidEntry =>
  ({ kind: 'void', id: `v${at}`, at, volumeMl: null, answers });
const leak = (answers: Record<string, string>): LeakEntry =>
  ({ kind: 'leak', id: `l${Math.random()}`, at: noon, answers });
const drink = (at: number): DrinkEntry => ({ kind: 'drink', id: `d${at}`, at, type: 'Water', volumeMl: 250 });
const night = (rising: number, answers: Record<string, string> = {}): NightEntry =>
  ({ kind: 'night', id: `n${rising}`, nightId: '', bedtime: rising - 8 * H, rising, firstVoidVolumeMl: null, answers });

describe('groupByDay', () => {
  it('groups by calendar day, keys nights to the day they end, newest first', () => {
    const entries = [
      v(noon), v(noon + 2 * H), drink(noon + H), // day A
      v(noon + DAY), night(noon + DAY, { wetDry: 'Wet' }), // day B (next day)
    ];
    const days = groupByDay(entries);
    expect(days).toHaveLength(2);
    expect(days[0]!.day > days[1]!.day).toBe(true); // newest first

    const [dayB, dayA] = days;
    expect(dayB!.voids).toHaveLength(1);
    expect(dayB!.night).toBeDefined();
    expect(dayA!.voids).toHaveLength(2);
    expect(dayA!.drinks).toHaveLength(1);
    expect(dayA!.night).toBeUndefined();
  });

  it('returns nothing for no entries', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('wet/dry night detection', () => {
  it('reads wetness from the wetDry answer', () => {
    expect(isWetNight(night(noon, { wetDry: 'Wet' }))).toBe(true);
    expect(isWetNight(night(noon, { wetDry: 'Damp' }))).toBe(true);
    expect(isWetNight(night(noon, { wetDry: 'Soaked' }))).toBe(true);
    expect(isWetNight(night(noon, { wetDry: 'Dry' }))).toBe(false);
    expect(isDryNight(night(noon, { wetDry: 'Dry' }))).toBe(true);
    expect(isDryNight(night(noon, { wetDry: 'Wet' }))).toBe(false);
  });

  it('a "woke wet" report counts as wet even without a wetDry answer', () => {
    expect(isWetNight(night(noon, { howWasNight: 'Woke wet' }))).toBe(true);
  });
});

describe('tally / share', () => {
  it('tally counts each answer value, ignoring entries without it', () => {
    const leaks = [leak({ leakTrigger: 'Urge' }), leak({ leakTrigger: 'Urge' }), leak({ leakTrigger: 'Stress' }), leak({})];
    expect(tally(leaks, 'leakTrigger')).toEqual({ Urge: 2, Stress: 1 });
  });

  it('share counts hits over voids that answered', () => {
    const voids = [v(1, { stream: 'Weak' }), v(2, { stream: 'Weak' }), v(3, { stream: 'Strong' }), v(4, {})];
    expect(share(voids, 'stream', ['Weak', 'Dribble'])).toEqual({ hit: 2, of: 3 });
  });
});

describe('formatters', () => {
  it('humanize turns a camelCase key into a sentence label', () => {
    expect(humanize('fillingAwareness')).toBe('Filling awareness');
    expect(humanize('warningTime')).toBe('Warning time');
  });

  it('durationStr renders hours and minutes', () => {
    expect(durationStr(8 * H + 30 * 60_000)).toBe('8h 30m');
    expect(durationStr(9 * H)).toBe('9h 0m');
  });
});
