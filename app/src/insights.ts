import type { SleepPeriod } from '@core';
import type { LogEntry, VoidEntry, LeakEntry, NightEntry, ChangeEntry, DrinkEntry } from './store';

export const voidsOf = (e: readonly LogEntry[]) => e.filter((x): x is VoidEntry => x.kind === 'void');
export const leaksOf = (e: readonly LogEntry[]) => e.filter((x): x is LeakEntry => x.kind === 'leak');
export const nightsOf = (e: readonly LogEntry[]) => e.filter((x): x is NightEntry => x.kind === 'night');
export const changesOf = (e: readonly LogEntry[]) => e.filter((x): x is ChangeEntry => x.kind === 'change');
export const drinksOf = (e: readonly LogEntry[]) => e.filter((x): x is DrinkEntry => x.kind === 'drink');

/** A night reads as wet from the wetting answer or a "woke wet" report. */
export const isWetNight = (n: NightEntry) =>
  ['Damp', 'Wet', 'Soaked'].includes(n.answers.wetDry ?? '') || n.answers.howWasNight === 'Woke wet';
export const isDryNight = (n: NightEntry) => n.answers.wetDry === 'Dry';

export const latestSleep = (nights: NightEntry[]): SleepPeriod | null =>
  nights.length ? nights.reduce((a, b) => (b.rising > a.rising ? b : a)) : null;

/** Count each answer value for a question id across entries that carry answers. */
export function tally(entries: { answers: Record<string, string> }[], qid: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const v = e.answers[qid];
    if (v) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

/** How many entries answered `qid` with one of `values`, and how many answered at all. */
export function share(entries: { answers: Record<string, string> }[], qid: string, values: string[]): { hit: number; of: number } {
  let hit = 0;
  let of = 0;
  for (const e of entries) {
    const v = e.answers[qid];
    if (!v) continue;
    of++;
    if (values.includes(v)) hit++;
  }
  return { hit, of };
}

/** camelCase key → readable sentence-case label: "fillingAwareness" → "Filling awareness". */
export const humanize = (key: string) => {
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** One calendar day's entries, for the frequency-volume chart and multi-day trends. */
export interface DayGroup {
  day: string; // YYYY-MM-DD (local)
  voids: VoidEntry[];
  drinks: DrinkEntry[];
  changes: ChangeEntry[];
  night?: NightEntry;
}

/** Group all entries by calendar day (nights keyed to the day they end), newest first. */
export function groupByDay(entries: readonly LogEntry[]): DayGroup[] {
  const byDay = new Map<string, DayGroup>();
  const get = (day: string): DayGroup =>
    byDay.get(day) ?? byDay.set(day, { day, voids: [], drinks: [], changes: [] }).get(day)!;
  for (const e of entries) {
    if (e.kind === 'void') get(dayKeyOf(e.at)).voids.push(e);
    else if (e.kind === 'drink') get(dayKeyOf(e.at)).drinks.push(e);
    else if (e.kind === 'change') get(dayKeyOf(e.at)).changes.push(e);
    else if (e.kind === 'night') get(dayKeyOf(e.rising)).night = e;
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}
const dayKeyOf = (at: number) => new Date(at).toLocaleDateString('en-CA');

export const timeStr = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateStr = (at: number) => new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const dayKey = (at: number) => new Date(at).toLocaleDateString('en-CA'); // YYYY-MM-DD local
export const durationStr = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
};
