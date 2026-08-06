import { describe, it, expect } from 'vitest';
import { buildMeasuredDayReport, buildTrendReport, type DayVoids } from './report';
import type { VoidEvent, SleepPeriod } from '../time/night';

const at = (iso: string): number => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`bad ISO: ${iso}`);
  return ms;
};

/**
 * Group E — Report degradation, the failure-state rule (spec §3.2, §9.E).
 * A report must render what it honestly can and flag what it can't — never fail.
 */
describe('E. Report degradation', () => {
  it('E19: 11 of 13 measured voids → report renders, flagged incomplete, NPi withheld', () => {
    const sleep: SleepPeriod = {
      bedtime: at('2026-08-05T23:00:00-06:00'),
      rising: at('2026-08-06T07:00:00-06:00'),
    };
    const daytimeTimes = ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30', '17:00', '18:30', '20:00'];
    const voids: VoidEvent[] = [
      { id: 'preBed', at: at('2026-08-05T22:45:00-06:00'), volumeMl: 300 },
      { id: 'n1', at: at('2026-08-06T01:30:00-06:00'), volumeMl: 220 },
      { id: 'n2', at: at('2026-08-06T04:15:00-06:00'), volumeMl: null }, // unmeasured nocturnal → NUV/NPi withheld
      { id: 'fm', at: at('2026-08-06T07:10:00-06:00'), volumeMl: 260 },
      ...daytimeTimes.map((t, i) => ({
        id: `d${i}`,
        at: at(`2026-08-06T${t}:00-06:00`),
        volumeMl: i === 0 ? null : 250, // one daytime void also unmeasured
      })),
    ];

    const r = buildMeasuredDayReport(voids, sleep);
    expect(r).toBeTruthy(); // it renders — no throw, no null
    expect(r.totalVoids).toBe(13);
    expect(r.measuredVoids).toBe(11);
    expect(r.complete).toBe(false);
    expect(r.incompleteNote).toContain('11');
    expect(r.incompleteNote).toContain('13');

    // Time-based facts survive missing volumes entirely.
    expect(r.nocturiaEpisodes).toBe(2); // n1, n2

    // Volume-derived numbers are withheld, not guessed (§9.8).
    expect(r.nuvMl).toBeNull();
    expect(r.npi.ratio).toBeNull();
    expect(r.npi.complete).toBe(false);
  });

  it('E20: everyday-only data (no measured day ever) still yields a valid trend report', () => {
    // Volume-free taps across three days; two nights tracked.
    const mkVoids = (date: string, times: string[]): VoidEvent[] =>
      times.map((t, i) => ({ id: `${date}-${i}`, at: at(`${date}T${t}:00-06:00`) })); // no volumeMl at all

    const days: DayVoids[] = [
      {
        nightId: '2026-08-01',
        voids: mkVoids('2026-08-01', ['02:00', '08:00', '13:00', '19:00']),
        sleep: { bedtime: at('2026-07-31T23:00:00-06:00'), rising: at('2026-08-01T07:00:00-06:00') },
      },
      {
        nightId: '2026-08-02',
        voids: mkVoids('2026-08-02', ['09:00', '14:00', '21:00']),
      },
      {
        nightId: '2026-08-03',
        voids: mkVoids('2026-08-03', ['01:30', '03:30', '08:15', '12:00', '18:00']),
        sleep: { bedtime: at('2026-08-02T23:00:00-06:00'), rising: at('2026-08-03T07:00:00-06:00') },
      },
    ];

    const t = buildTrendReport(days);
    expect(t).toBeTruthy();
    expect(t.days).toBe(3);
    expect(t.totalVoids).toBe(12);
    expect(t.voidsPerDay).toBeCloseTo(4, 10);
    expect(t.nightsTracked).toBe(2);
    // Day 1: 02:00 nocturnal (1). Day 3: 01:30 + 03:30 nocturnal (2). Total 3.
    expect(t.nocturiaEpisodesTotal).toBe(3);
    // No volumes were ever recorded, so NPi is honestly unavailable — not zero.
    expect(t.npiAvailable).toBe(false);
  });
});
