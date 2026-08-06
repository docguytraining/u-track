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
  const { bedtime, rising } = sleep;
  const morningWindowEnd = rising + FIRST_MORNING_WINDOW_MS;

  // The pre-sleep void is the last void at or before bedtime — the bladder is
  // emptied at the start of the sleep period, so it is excluded from NUV.
  const preSleep = allVoids
    .filter((x) => x.at <= bedtime)
    .reduce<VoidEvent | undefined>((latest, x) => (!latest || x.at > latest.at ? x : latest), undefined);
  if (preSleep && v.id === preSleep.id) return 'pre-sleep';

  // The first-morning void is the earliest void within the window after rising.
  // Only the first one qualifies; later ones in the window are ordinary daytime voids.
  const firstMorning = allVoids
    .filter((x) => x.at >= rising && x.at <= morningWindowEnd)
    .reduce<VoidEvent | undefined>((earliest, x) => (!earliest || x.at < earliest.at ? x : earliest), undefined);
  if (firstMorning && v.id === firstMorning.id) return 'first-morning';

  // Everything strictly inside the sleep period is nocturnal. Comparisons are on
  // instants, so DST transitions (a skipped or repeated wall-clock hour) don't matter.
  if (v.at > bedtime && v.at < rising) return 'nocturnal';

  return 'daytime';
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
  const contributing = voids.filter((v) => {
    const cls = classifyVoid(v, sleep, voids);
    return cls === 'nocturnal' || cls === 'first-morning';
  });

  let total = 0;
  for (const v of contributing) {
    // Honest degradation (spec §5.3): if any contributing void lacks a real
    // measured/weighed volume, withhold NUV rather than guess a number.
    if (v.volumeMl == null) return null;
    total += v.volumeMl;
  }
  return total;
}

/**
 * Nocturia episode count (spec §4): nocturnal voids that are followed by a return to sleep.
 * The first-morning void contributes its volume to NUV but is NOT counted here.
 */
export function nocturiaCount(voids: readonly VoidEvent[], sleep: SleepPeriod): number {
  // Nocturnal voids only — the first-morning void adds to NUV but is a rising,
  // not a return to sleep, so it is not a nocturia episode.
  return voids.filter((v) => classifyVoid(v, sleep, voids) === 'nocturnal').length;
}

/**
 * Real elapsed duration of the sleep period, in ms. MUST be instant-based
 * (rising − bedtime), never a wall-clock hour difference — that is the DST guard (spec §4).
 */
export function sleepDurationMs(sleep: SleepPeriod): number {
  // Instant subtraction — real elapsed time. On a DST night this differs from the
  // wall-clock hour difference by ±1h, which is exactly the bug this guards against.
  return sleep.rising - sleep.bedtime;
}

/**
 * Stable night identifier (spec §4): the calendar date on which the sleep period began,
 * formatted 'YYYY-MM-DD' in the given IANA time zone. Night-spanning records key to this so a
 * 02:00 void lands on the night it belongs to, not the next calendar day.
 */
export function nightId(sleep: SleepPeriod, timeZone: string): string {
  // The local calendar date at the instant sleep began, in the given IANA zone.
  // formatToParts avoids locale-ordering surprises; en-CA would also yield ISO order.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(sleep.bedtime));
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
