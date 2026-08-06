import type { SleepPeriod } from '@core';
import type { LogEntry, VoidEntry, LeakEntry, NightEntry } from './store';

export const voidsOf = (e: readonly LogEntry[]) => e.filter((x): x is VoidEntry => x.kind === 'void');
export const leaksOf = (e: readonly LogEntry[]) => e.filter((x): x is LeakEntry => x.kind === 'leak');
export const nightsOf = (e: readonly LogEntry[]) => e.filter((x): x is NightEntry => x.kind === 'night');

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

export const timeStr = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateStr = (at: number) => new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const durationStr = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
};
