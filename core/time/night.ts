/**
 * Night-boundary model — spec §4.
 *
 * Pure functions over INSTANTS (epoch milliseconds, UTC). No UI, no Firestore,
 * and crucially no wall-clock arithmetic: durations and ordering are computed on
 * instants so they stay correct across DST transitions. Local time is used only
 * to derive the calendar-date night key, via the IANA time zone passed in.
 */

export interface VoidEvent {
  id: string;
  /** Instant of the void, epoch milliseconds (UTC). */
  at: number;
  /** Volume in mL if known; null/undefined when only a qualitative estimate or nothing was recorded. */
  volumeMl?: number | null;
}

export interface SleepPeriod {
  /** Bedtime with intent to sleep, epoch ms. The last void before this is excluded from NUV. */
  bedtime: number;
  /** Rising for the day, epoch ms. */
  rising: number;
}

export type VoidClass = 'pre-sleep' | 'nocturnal' | 'first-morning' | 'daytime';

/** Window after rising during which the first void still counts as nocturnal (spec §4). */
export const FIRST_MORNING_WINDOW_MS = 30 * 60 * 1000;

/**
 * Classify a void relative to a sleep period (spec §4):
 *  - 'pre-sleep'     — the last void before bedtime; EXCLUDED from NUV.
 *  - 'nocturnal'     — a void during the sleep period; included in NUV and counts as a nocturia episode.
 *  - 'first-morning' — the first void within FIRST_MORNING_WINDOW_MS of rising;
 *                      included in NUV but NOT counted as a nocturia episode.
 *  - 'daytime'       — everything else.
 */
export function classifyVoid(
  v: VoidEvent,
  sleep: SleepPeriod,
  allVoids: readonly VoidEvent[],
): VoidClass {
  throw new Error('not implemented');
}

/**
 * Nocturnal urine volume (spec §4): the sum of nocturnal + first-morning void volumes.
 * Returns null if any contributing void lacks a real measured/weighed volume — honest
 * degradation (spec §5.3), never a guessed number.
 */
export function nocturnalUrineVolume(
  voids: readonly VoidEvent[],
  sleep: SleepPeriod,
): number | null {
  throw new Error('not implemented');
}

/**
 * Nocturia episode count (spec §4): nocturnal voids that are followed by a return to sleep.
 * The first-morning void contributes its volume to NUV but is NOT counted here.
 */
export function nocturiaCount(voids: readonly VoidEvent[], sleep: SleepPeriod): number {
  throw new Error('not implemented');
}

/**
 * Real elapsed duration of the sleep period, in ms. MUST be instant-based
 * (rising − bedtime), never a wall-clock hour difference — that is the DST guard (spec §4).
 */
export function sleepDurationMs(sleep: SleepPeriod): number {
  throw new Error('not implemented');
}

/**
 * Stable night identifier (spec §4): the calendar date on which the sleep period began,
 * formatted 'YYYY-MM-DD' in the given IANA time zone. Night-spanning records key to this so a
 * 02:00 void lands on the night it belongs to, not the next calendar day.
 */
export function nightId(sleep: SleepPeriod, timeZone: string): string {
  throw new Error('not implemented');
}
