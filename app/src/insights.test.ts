import { describe, it, expect } from 'vitest';
import { groupByDay, wettingsOf, leaksOf, sometimesMissesToilet, awarenessReduced, productsForContext, productAdequacy, leakyProducts, isWetNight, isDryNight, tally, share, humanize, durationStr } from './insights';
import type { VoidEntry, NightEntry, DrinkEntry, Product } from './store';

const H = 3_600_000;
const DAY = 86_400_000;
const noon = Date.UTC(2026, 7, 5, 12); // Aug 5 2026, noon UTC — safe from midnight TZ flips

const v = (at: number, answers: Record<string, string> = {}): VoidEntry =>
  ({ kind: 'void', id: `v${at}`, at, where: 'toilet', leaked: false, volumeMl: null, size: null, productId: null, answers });
const leak = (answers: Record<string, string>): VoidEntry =>
  ({ kind: 'void', id: `l${Math.random()}`, at: noon, where: null, leaked: true, volumeMl: null, size: null, productId: null, answers });
const drink = (at: number): DrinkEntry => ({ kind: 'drink', id: `d${at}`, at, type: 'Water', volumeMl: 250 });
const wetting = (at: number, answers: Record<string, string> = {}): VoidEntry =>
  ({ kind: 'void', id: `w${at}`, at, where: 'product', leaked: false, volumeMl: null, size: null, productId: null, answers });
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

  it('collects wettings into the day they occurred', () => {
    const [day] = groupByDay([v(noon), wetting(noon + H), wetting(noon + 2 * H)]);
    expect(day!.wettings).toHaveLength(2);
    expect(day!.voids).toHaveLength(1);
  });
});

describe('wettingsOf / leaksOf (attribute-based)', () => {
  it('wettingsOf selects voids that went into a product', () => {
    const entries = [v(noon), wetting(noon + H), drink(noon), wetting(noon + 2 * H)];
    expect(wettingsOf(entries)).toHaveLength(2);
    expect(wettingsOf(entries).every((w) => w.where === 'product' || w.where === 'both')).toBe(true);
  });

  it('leaksOf selects voids that escaped, not clean toilet voids', () => {
    const entries = [v(noon), leak({ leakSeverity: 'Damp' }), wetting(noon + H)];
    expect(leaksOf(entries)).toHaveLength(1);
    expect(leaksOf(entries)[0]!.leaked).toBe(true);
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

describe('sometimesMissesToilet (the void-fork gate)', () => {
  it('is off without protection, whatever else is true', () => {
    expect(sometimesMissesToilet(['urgency', 'leakage'], {})).toBe(false);
    expect(sometimesMissesToilet([], { warningTime: 'Almost none' })).toBe(false);
  });

  it('is on when a protection user has urgency, leakage, or awareness tracking', () => {
    expect(sometimesMissesToilet(['protection', 'urgency'], {})).toBe(true);
    expect(sometimesMissesToilet(['protection', 'leakage'], {})).toBe(true);
    expect(sometimesMissesToilet(['protection', 'awareness'], {})).toBe(true);
  });

  it('is on when a protection user has low warning or reduced filling awareness', () => {
    expect(sometimesMissesToilet(['protection'], { warningTime: '<5 min' })).toBe(true);
    expect(sometimesMissesToilet(['protection'], { fillingAwareness: 'Absent' })).toBe(true);
  });

  it('is off for a protection user with no relevant symptom or trait', () => {
    expect(sometimesMissesToilet(['protection', 'nocturia'], { warningTime: '15+ min' })).toBe(false);
  });
});

describe('awarenessReduced (the awareness-question gate)', () => {
  it('is false for normal sensation / no relevant traits', () => {
    expect(awarenessReduced({})).toBe(false);
    expect(awarenessReduced({ fillingAwareness: 'Normal', warningTime: '15+ min' })).toBe(false);
  });

  it('is true when filling awareness, warning time, or leak noticing is reduced', () => {
    expect(awarenessReduced({ fillingAwareness: 'Absent' })).toBe(true);
    expect(awarenessReduced({ fillingAwareness: 'Delayed' })).toBe(true);
    expect(awarenessReduced({ warningTime: 'Almost none' })).toBe(true);
    expect(awarenessReduced({ leakNoticing: 'Usually find out after' })).toBe(true);
  });
});

describe('productsForContext', () => {
  const P = (id: string, usage?: 'day' | 'night' | 'both'): Product => ({ id, name: id, dryGrams: 50, usage });
  it('includes the matching context, plus both/untagged; excludes the other', () => {
    const products = [P('d', 'day'), P('n', 'night'), P('b', 'both'), P('u')];
    expect(productsForContext(products, 'night').map((p) => p.id)).toEqual(['n', 'b', 'u']);
    expect(productsForContext(products, 'day').map((p) => p.id)).toEqual(['d', 'b', 'u']);
  });
});

describe('productAdequacy / leakyProducts', () => {
  const prod = (id: string): Product => ({ id, name: id, dryGrams: 50 });
  const N = (pid: string, leaked: boolean) =>
    night(noon, { protectionProductId: pid, ...(leaked ? { leakedThrough: 'Yes' } : {}) });

  it('tallies nights and leaks per product, ignoring unset and "none"', () => {
    const nights = [N('a', true), N('a', true), N('a', false), N('b', false), night(noon, {}), night(noon, { protectionProductId: 'none', leakedThrough: 'Yes' })];
    const stats = productAdequacy(nights, [prod('a'), prod('b')]);
    const a = stats.find((s) => s.productId === 'a')!;
    expect(a.nights).toBe(3);
    expect(a.leaks).toBe(2);
    expect(stats.find((s) => s.productId === 'b')!.leaks).toBe(0);
    expect(stats.some((s) => s.productId === 'none')).toBe(false);
  });

  it('flags a product leaking over the rate with enough nights, but not on a thin sample', () => {
    const stats = productAdequacy([N('a', true), N('a', true), N('a', false)], [prod('a')]); // 2 of 3
    expect(leakyProducts(stats).map((s) => s.productId)).toEqual(['a']);
    expect(leakyProducts(stats, 5)).toHaveLength(0);
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
