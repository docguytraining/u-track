import { describe, it, expect } from 'vitest';
import { nocturnalPolyuriaIndex } from './npi';
import type { VoidEvent, SleepPeriod } from '../time/night';

/** Build an epoch-ms instant from an ISO string that includes an explicit UTC offset. */
const at = (iso: string): number => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`bad ISO: ${iso}`);
  return ms;
};

/**
 * Group B — Nocturnal polyuria index (spec §4.1, §9.B).
 * A single fully-measured 24-hour window in Denver (MDT, non-DST):
 *   pre-sleep 300 | nocturnal 220 + 180 | first-morning 260 | daytime 300 + 240
 *   NUV = 220 + 180 + 260 = 660   total 24h = 1500   NPi = 0.44
 */
const sleep: SleepPeriod = {
  bedtime: at('2026-08-05T23:00:00-06:00'),
  rising: at('2026-08-06T07:00:00-06:00'),
};
const measuredWindow: VoidEvent[] = [
  { id: 'preBed', at: at('2026-08-05T22:45:00-06:00'), volumeMl: 300 },
  { id: 'n1', at: at('2026-08-06T01:30:00-06:00'), volumeMl: 220 },
  { id: 'n2', at: at('2026-08-06T04:15:00-06:00'), volumeMl: 180 },
  { id: 'fm', at: at('2026-08-06T07:10:00-06:00'), volumeMl: 260 },
  { id: 'day1', at: at('2026-08-06T12:00:00-06:00'), volumeMl: 300 },
  { id: 'day2', at: at('2026-08-06T18:00:00-06:00'), volumeMl: 240 },
];

describe('B. Nocturnal polyuria index', () => {
  it('B7: NPi = NUV / 24h volume for a fully measured window', () => {
    const r = nocturnalPolyuriaIndex(measuredWindow, sleep);
    expect(r.complete).toBe(true);
    expect(r.ratio).toBeCloseTo(660 / 1500, 10); // 0.44
  });

  it('B8: NPi is withheld (null) when a contributing NUV void lacks a real volume', () => {
    const missingNocturnal = measuredWindow.map((v) =>
      v.id === 'n1' ? { ...v, volumeMl: null } : v,
    );
    const r = nocturnalPolyuriaIndex(missingNocturnal, sleep);
    expect(r.ratio).toBeNull();
    expect(r.complete).toBe(false);
    expect(r.overThreshold).toBeNull();
  });

  it('B8b: NPi is withheld when a denominator (daytime) void lacks a real volume', () => {
    const missingDaytime = measuredWindow.map((v) =>
      v.id === 'day1' ? { ...v, volumeMl: undefined } : v,
    );
    const r = nocturnalPolyuriaIndex(missingDaytime, sleep);
    expect(r.ratio).toBeNull();
    expect(r.complete).toBe(false);
  });

  it('B9: ratio is flagged against the threshold, which is a parameter (age-dependent), not a diagnosis', () => {
    // 0.44 is over the older-adult 0.33 line but under a hypothetical 0.50 cutoff.
    expect(nocturnalPolyuriaIndex(measuredWindow, sleep, 0.33).overThreshold).toBe(true);
    expect(nocturnalPolyuriaIndex(measuredWindow, sleep, 0.5).overThreshold).toBe(false);
    // Younger-person threshold nearer 0.20 flips a lower ratio; proves it isn't hard-coded.
    expect(nocturnalPolyuriaIndex(measuredWindow, sleep, 0.2).overThreshold).toBe(true);

    // The result carries a flag only — no rendered diagnosis text anywhere in the shape.
    const r = nocturnalPolyuriaIndex(measuredWindow, sleep);
    expect(Object.keys(r).sort()).toEqual(['complete', 'overThreshold', 'ratio']);
  });
});
