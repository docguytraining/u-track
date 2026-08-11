import { describe, it, expect } from 'vitest';
import { groupByDay, wettingsOf, leaksOf, incontinenceEpisodesOf, sometimesMissesToilet, awarenessReduced, productsForContext, productAdequacy, leakyProducts, isWetNight, isDryNight, tally, share, humanize, durationStr, hourlyRhythm, voidEffectiveMl, detectVolumeSurges, surgePatterns, detectVoidClusters, voidClusterPatterns, minuteOfDayStr } from './insights';
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

describe('hourlyRhythm', () => {
  // Local-time construction so getHours() is deterministic regardless of the test machine's TZ.
  const atHour = (dayOffset: number, hour: number) => new Date(2026, 7, 5 + dayOffset, hour, 0, 0).getTime();
  const leakAt = (at: number): VoidEntry =>
    ({ kind: 'void', id: `l${at}`, at, where: null, leaked: true, volumeMl: null, size: null, productId: null, answers: {} });

  it('buckets voids and leaks by hour of day across all days, and finds the peak', () => {
    const entries = [
      v(atHour(0, 8)), v(atHour(1, 8)), // two 8am voids, different days
      v(atHour(0, 14)), leakAt(atHour(0, 14)), leakAt(atHour(1, 14)), // 2pm: one void + two leaks (peak, 3 events)
    ];
    const { buckets, days, total, peak } = hourlyRhythm(entries);
    expect(buckets).toHaveLength(24);
    expect(buckets[8]).toEqual({ hour: 8, voids: 2, leaks: 0 });
    expect(buckets[14]).toEqual({ hour: 14, voids: 1, leaks: 2 });
    expect(days).toBe(2);
    expect(total).toBe(5);
    expect(peak!.hour).toBe(14); // 3 events at 2pm > 2 at 8am
  });

  it('is empty and peak-less with no voids', () => {
    const r = hourlyRhythm([drink(noon)]);
    expect(r.total).toBe(0);
    expect(r.peak).toBeNull();
    expect(r.buckets.every((b) => b.voids === 0 && b.leaks === 0)).toBe(true);
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

// High-volume episodes and their time-of-day patterns.
const mv = (at: number, volumeMl: number): VoidEntry =>
  ({ kind: 'void', id: `mv${at}`, at, where: 'toilet', leaked: false, volumeMl, size: null, productId: null, answers: {} });
const pv = (at: number, size: string): VoidEntry =>
  ({ kind: 'void', id: `pv${at}`, at, where: 'product', leaked: false, volumeMl: null, size, productId: null, answers: {} });

describe('voidEffectiveMl', () => {
  it('prefers a measured volume (not estimated)', () => {
    expect(voidEffectiveMl(mv(noon, 320))).toEqual({ ml: 320, estimated: false });
  });
  it('estimates from reported size when unmeasured', () => {
    expect(voidEffectiveMl(pv(noon, 'Large'))).toEqual({ ml: 350, estimated: true });
  });
  it('estimates a leak from its severity', () => {
    expect(voidEffectiveMl(leak({ leakSeverity: 'Soaked' }))).toEqual({ ml: 250, estimated: true });
  });
  it('is null when there is no volume signal at all', () => {
    expect(voidEffectiveMl(v(noon))).toBeNull();
  });
});

describe('detectVolumeSurges', () => {
  it('flags voids that clear the threshold within the window', () => {
    const s = detectVolumeSurges([mv(noon, 250), mv(noon + 30 * 60_000, 250)]);
    expect(s).toHaveLength(1);
    expect(s[0]!.totalMl).toBe(500);
    expect(s[0]!.voids).toBe(2);
    expect(s[0]!.estimated).toBe(false);
  });
  it('does not flag volume that stays under the threshold', () => {
    expect(detectVolumeSurges([mv(noon, 150), mv(noon + 30 * 60_000, 150)])).toHaveLength(0);
  });
  it('does not merge voids more than a window apart', () => {
    // 250 + 250 but 3h apart → never 400 within any 2h window.
    expect(detectVolumeSurges([mv(noon, 250), mv(noon + 3 * H, 250)])).toHaveLength(0);
  });
  it('uses size estimates and marks the episode estimated', () => {
    const s = detectVolumeSurges([pv(noon, 'Large'), pv(noon + 20 * 60_000, 'Large')]); // 350+350
    expect(s).toHaveLength(1);
    expect(s[0]!.estimated).toBe(true);
    expect(s[0]!.totalMl).toBe(700);
  });
});

describe('surgePatterns', () => {
  // Two 250 mL voids 30 min apart = one ~500 mL episode; repeat at the same clock time each day.
  const burstDay = (dayOffset: number, base: number): VoidEntry[] => {
    const t = base + dayOffset * DAY;
    return [mv(t, 250), mv(t + 30 * 60_000, 250)];
  };

  it('calls out an episode recurring at the same time of day', () => {
    const base = Date.UTC(2026, 7, 5, 5, 0); // ~early morning anchor
    const entries = [0, 1, 2, 3, 4].flatMap((d) => burstDay(d, base));
    const pats = surgePatterns(entries);
    expect(pats).toHaveLength(1);
    expect(pats[0]!.days).toBe(5);
    expect(pats[0]!.periodDays).toBe(5);
    expect(pats[0]!.surges).toHaveLength(5);
  });

  it('stays silent below the minimum logged days', () => {
    const base = Date.UTC(2026, 7, 5, 5, 0);
    const entries = [0, 1].flatMap((d) => burstDay(d, base)); // only 2 days
    expect(surgePatterns(entries)).toEqual([]);
  });

  it('does not call a pattern when episodes scatter across the clock', () => {
    // Three days, each with one episode, but at 5:00, 14:00, 20:00 — no shared time-of-day window.
    const d0 = Date.UTC(2026, 7, 5, 5, 0);
    const d1 = Date.UTC(2026, 7, 6, 14, 0);
    const d2 = Date.UTC(2026, 7, 7, 20, 0);
    const entries = [d0, d1, d2].flatMap((t) => [mv(t, 250), mv(t + 30 * 60_000, 250)]);
    expect(surgePatterns(entries)).toEqual([]);
  });
});

describe('minuteOfDayStr', () => {
  it('formats minutes since midnight as a clock time', () => {
    expect(minuteOfDayStr(0)).toMatch(/12:00/);      // midnight
    expect(minuteOfDayStr(5 * 60 + 5)).toMatch(/5:05/); // 5:05
  });
});

describe('incontinenceEpisodesOf (unified leak symptom)', () => {
  it('includes every involuntary loss — into product or escaped — but not clean toilet voids', () => {
    const entries = [
      v(noon),                              // clean toilet void → excluded
      mv(noon + H, 250),                    // measured toilet void → excluded
      wetting(noon + 2 * H, {}),            // into product (contained) → included
      leak({ leakSeverity: 'Damp' }),       // escaped onto clothing → included
    ];
    const eps = incontinenceEpisodesOf(entries);
    expect(eps).toHaveLength(2);
    expect(eps.every((e) => e.where === 'product' || e.leaked)).toBe(true);
  });

  it('estimates a "a few drops" leak volume', () => {
    expect(voidEffectiveMl(leak({ leakSeverity: 'A few drops' }))).toEqual({ ml: 15, estimated: true });
  });
});

describe('voidEffectiveMl — contained leak (severity, not escaped)', () => {
  it('estimates a leak the product caught (where=product, leaked=false) from its severity', () => {
    const contained: VoidEntry = { kind: 'void', id: 'c1', at: noon, where: 'product', leaked: false, volumeMl: null, size: null, productId: null, answers: { leakSeverity: 'Moderate' } };
    expect(voidEffectiveMl(contained)).toEqual({ ml: 100, estimated: true });
  });
});

describe('detectVoidClusters', () => {
  it('flags 3+ emptyings within the hour window, counting voids and leaks alike', () => {
    const t = noon;
    const c = detectVoidClusters([mv(t, 120), mv(t + 20 * 60_000, 100), leak({ leakSeverity: 'Damp' })]);
    // leak() is at `noon`, so all three fall inside the hour.
    expect(c).toHaveLength(1);
    expect(c[0]!.voids).toBe(3);
    expect(c[0]!.measured).toBe(true);
  });
  it('does not flag fewer than the minimum, or emptyings spread beyond the window', () => {
    expect(detectVoidClusters([mv(noon, 100), mv(noon + 20 * 60_000, 100)])).toHaveLength(0); // only 2
    expect(detectVoidClusters([mv(noon, 100), mv(noon + 30 * 60_000, 100), mv(noon + 90 * 60_000, 100)])).toHaveLength(0); // spread > 1h
  });
});

describe('voidClusterPatterns', () => {
  const clusterDay = (d: number, base: number) => {
    const t = base + d * DAY;
    return [mv(t, 120), mv(t + 15 * 60_000, 110), mv(t + 35 * 60_000, 130)]; // 3 voids within ~35 min
  };
  it('calls out clustered voiding recurring at the same time of day', () => {
    const base = Date.UTC(2026, 7, 5, 2, 0); // early-morning cluster
    const entries = [0, 1, 2, 3].flatMap((d) => clusterDay(d, base));
    const pats = voidClusterPatterns(entries);
    expect(pats).toHaveLength(1);
    expect(pats[0]!.days).toBe(4);
    expect(pats[0]!.typicalVoids).toBe(3);
    expect(pats[0]!.typicalMl).toBe(360);
  });
  it('stays silent below the minimum logged days', () => {
    const base = Date.UTC(2026, 7, 5, 2, 0);
    expect(voidClusterPatterns([0, 1].flatMap((d) => clusterDay(d, base)))).toEqual([]);
  });
});
