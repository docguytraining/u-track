/**
 * Report assembly — the failure-state rule made load-bearing (spec §3.2, §9.E).
 *
 * Reports render what the data honestly supports and flag what it can't. Counts
 * (time-based) always work; volume-derived numbers are withheld, never guessed,
 * whenever a contributing void lacks a real measurement.
 *
 * NOTE (design, open to revision): these aggregate shapes were not in the original
 * scaffold — they compose the proven core functions into the two report surfaces
 * the spec calls for (measured-day summary §7.7, everyday trend §3.1).
 */
import {
  nocturiaCount,
  nocturnalUrineVolume,
  type VoidEvent,
  type SleepPeriod,
} from '../time/night';
import { nocturnalPolyuriaIndex, type NpiResult } from './npi';

export interface MeasuredDayReport {
  /** Nocturnal episodes — always computable; independent of volume. */
  nocturiaEpisodes: number;
  /** Nocturnal urine volume, or null when a contributing void is unmeasured. */
  nuvMl: number | null;
  /** NPi result; withheld (ratio null) unless the window is fully measured. */
  npi: NpiResult;
  totalVoids: number;
  measuredVoids: number;
  /** True only when every void in the window carries a real volume. */
  complete: boolean;
  /** Honest, human-readable flag when the window is incomplete; null when complete. */
  incompleteNote: string | null;
}

export function buildMeasuredDayReport(
  voids: readonly VoidEvent[],
  sleep: SleepPeriod,
): MeasuredDayReport {
  const totalVoids = voids.length;
  const measuredVoids = voids.filter((v) => v.volumeMl != null).length;
  const complete = totalVoids > 0 && measuredVoids === totalVoids;

  return {
    nocturiaEpisodes: nocturiaCount(voids, sleep),
    nuvMl: nocturnalUrineVolume(voids, sleep),
    npi: nocturnalPolyuriaIndex(voids, sleep),
    totalVoids,
    measuredVoids,
    complete,
    incompleteNote: complete ? null : `${measuredVoids} of ${totalVoids} voids measured`,
  };
}

/** One tracked day for the everyday trend. `sleep` is present only when the night was logged. */
export interface DayVoids {
  nightId: string;
  voids: readonly VoidEvent[];
  sleep?: SleepPeriod;
}

export interface TrendReport {
  days: number;
  totalVoids: number;
  voidsPerDay: number;
  /** Days for which a sleep period was recorded (so nocturia is meaningful). */
  nightsTracked: number;
  nocturiaEpisodesTotal: number;
  /** Whether any day is a complete, measured window — false is honest, not a failure. */
  npiAvailable: boolean;
}

export function buildTrendReport(days: readonly DayVoids[]): TrendReport {
  const totalVoids = days.reduce((sum, d) => sum + d.voids.length, 0);
  const withSleep = days.filter((d) => d.sleep);

  const nocturiaEpisodesTotal = withSleep.reduce(
    (sum, d) => sum + nocturiaCount(d.voids, d.sleep!),
    0,
  );

  // A day supports NPi only if the night was logged and every void was measured.
  const npiAvailable = days.some(
    (d) => d.sleep != null && d.voids.length > 0 && d.voids.every((v) => v.volumeMl != null),
  );

  return {
    days: days.length,
    totalVoids,
    voidsPerDay: days.length === 0 ? 0 : totalVoids / days.length,
    nightsTracked: withSleep.length,
    nocturiaEpisodesTotal,
    npiAvailable,
  };
}
