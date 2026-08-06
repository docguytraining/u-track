import { describe, it, expect } from 'vitest';
import {
  classifyVoid,
  nocturnalUrineVolume,
  nocturiaCount,
  sleepDurationMs,
  nightId,
  type VoidEvent,
  type SleepPeriod,
} from './night';

/** Build an epoch-ms instant from an ISO string that includes an explicit UTC offset. */
const at = (iso: string): number => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`bad ISO: ${iso}`);
  return ms;
};

const H = 3_600_000;
const TZ = 'America/Denver';

/**
 * Group A — Night boundary (spec §9.A).
 * A standard, non-DST summer night in Denver (MDT = UTC-6) for A1–A4.
 */
describe('A. Night boundary — standard night', () => {
  const sleep: SleepPeriod = {
    bedtime: at('2026-08-05T23:00:00-06:00'),
    rising: at('2026-08-06T07:00:00-06:00'),
  };

  const preBed: VoidEvent = { id: 'preBed', at: at('2026-08-05T22:45:00-06:00'), volumeMl: 300 };
  const n1: VoidEvent = { id: 'n1', at: at('2026-08-06T01:30:00-06:00'), volumeMl: 220 };
  const n2: VoidEvent = { id: 'n2', at: at('2026-08-06T04:15:00-06:00'), volumeMl: 180 };
  const firstMorning: VoidEvent = { id: 'fm', at: at('2026-08-06T07:10:00-06:00'), volumeMl: 260 };
  const day: VoidEvent = { id: 'day', at: at('2026-08-06T09:30:00-06:00'), volumeMl: 250 };
  const voids = [preBed, n1, n2, firstMorning, day];

  it('A1: the last void before bedtime is excluded from NUV', () => {
    expect(classifyVoid(preBed, sleep, voids)).toBe('pre-sleep');
    // NUV = n1 + n2 + firstMorning = 660; preBed's 300 must NOT be included.
    expect(nocturnalUrineVolume(voids, sleep)).toBe(660);
  });

  it('A2: the first void within 30 min of rising is included in NUV', () => {
    expect(classifyVoid(firstMorning, sleep, voids)).toBe('first-morning');
    // Without the first-morning void, NUV would be 400; with it, 660.
    const withoutFm = voids.filter((v) => v.id !== 'fm');
    expect(nocturnalUrineVolume(withoutFm, sleep)).toBe(400);
    expect(nocturnalUrineVolume(voids, sleep)).toBe(660);
  });

  it('A3: first-morning void adds to NUV volume but is NOT a nocturia episode', () => {
    expect(nocturiaCount(voids, sleep)).toBe(2); // n1, n2 only
    expect(nocturnalUrineVolume(voids, sleep)).toBe(660); // fm's 260 still counted in volume
  });

  it('A4: a post-midnight void is keyed to the night the sleep period began', () => {
    // The 01:30 void has calendar date 2026-08-06, but the night began 2026-08-05.
    expect(nightId(sleep, TZ)).toBe('2026-08-05');
  });
});

describe('A5. DST spring-forward night (clocks skip 02:00 → 03:00)', () => {
  // Denver: MST (UTC-7) before, MDT (UTC-6) after the 2026-03-08 02:00 transition.
  const sleep: SleepPeriod = {
    bedtime: at('2026-03-07T23:00:00-07:00'), // 06:00 UTC
    rising: at('2026-03-08T07:00:00-06:00'), // 13:00 UTC
  };
  const n1: VoidEvent = { id: 'n1', at: at('2026-03-08T01:30:00-07:00'), volumeMl: 210 }; // before skip
  const n2: VoidEvent = { id: 'n2', at: at('2026-03-08T03:30:00-06:00'), volumeMl: 190 }; // after skip
  const voids = [n1, n2];

  it('nocturnal duration is real elapsed time (7h), not the 8h wall-clock difference', () => {
    expect(sleepDurationMs(sleep)).toBe(7 * H);
  });

  it('voids on both sides of the skipped hour are nocturnal and on the same night', () => {
    expect(classifyVoid(n1, sleep, voids)).toBe('nocturnal');
    expect(classifyVoid(n2, sleep, voids)).toBe('nocturnal');
    expect(nightId(sleep, TZ)).toBe('2026-03-07');
  });
});

describe('A6. DST fall-back night (clocks repeat 01:00 → 02:00)', () => {
  // Denver: MDT (UTC-6) before, MST (UTC-7) after the 2026-11-01 02:00 transition.
  const sleep: SleepPeriod = {
    bedtime: at('2026-10-31T23:00:00-06:00'), // 05:00 UTC
    rising: at('2026-11-01T07:00:00-07:00'), // 14:00 UTC
  };
  // "01:30" happens twice — these are distinct instants an hour apart.
  const firstPass: VoidEvent = { id: 'a', at: at('2026-11-01T01:30:00-06:00'), volumeMl: 200 };
  const secondPass: VoidEvent = { id: 'b', at: at('2026-11-01T01:30:00-07:00'), volumeMl: 180 };
  const voids = [firstPass, secondPass];

  it('nocturnal duration is real elapsed time (9h), not the 8h wall-clock difference', () => {
    expect(sleepDurationMs(sleep)).toBe(9 * H);
  });

  it('the repeated hour is not collapsed — two distinct nocturia episodes', () => {
    expect(firstPass.at).not.toBe(secondPass.at);
    expect(nocturiaCount(voids, sleep)).toBe(2);
    expect(nightId(sleep, TZ)).toBe('2026-10-31');
  });
});
