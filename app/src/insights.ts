import type { SleepPeriod } from '@core';
import type { LogEntry, VoidEntry, NightEntry, ChangeEntry, DrinkEntry, Product } from './store';

/** Products that fit a context — daytime or overnight. 'both' and untagged always fit,
 * so scoping a picker never hides a product the user hasn't classified. */
export const productsForContext = (products: readonly Product[], context: 'day' | 'night') =>
  products.filter((p) => p.usage == null || p.usage === 'both' || p.usage === context);

/** How each overnight product held up — nights worn vs. nights it leaked through. The raw
 * material for the adequacy readout. Sorted worst-performing first. */
export interface ProductNights {
  productId: string;
  name: string;
  nights: number;
  leaks: number;
}
export function productAdequacy(nights: readonly NightEntry[], products: readonly Product[]): ProductNights[] {
  const byId = new Map<string, { nights: number; leaks: number }>();
  for (const n of nights) {
    const pid = n.answers.protectionProductId;
    if (!pid || pid === 'none') continue;
    const rec = byId.get(pid) ?? { nights: 0, leaks: 0 };
    rec.nights++;
    if (n.answers.leakedThrough === 'Yes') rec.leaks++;
    byId.set(pid, rec);
  }
  return [...byId.entries()]
    .map(([productId, r]) => ({ productId, name: products.find((p) => p.id === productId)?.name ?? 'a product', nights: r.nights, leaks: r.leaks }))
    .sort((a, b) => b.leaks / b.nights - a.leaks / a.nights);
}

/** Products that leaked on at least `rate` of at least `minNights` nights — the ones worth
 * a provider conversation. The min sample keeps a single bad night from nagging. */
export const leakyProducts = (stats: ProductNights[], minNights = 3, rate = 0.5): ProductNights[] =>
  stats.filter((s) => s.nights >= minNights && s.leaks / s.nights >= rate);

/** Every bladder emptying, whatever its destination — the base for frequency. */
export const voidsOf = (e: readonly LogEntry[]) => e.filter((x): x is VoidEntry => x.kind === 'void');
/** Voids that reached the toilet — the bathroom trips that feed capacity/nocturia/NUV. */
export const toiletVoidsOf = (e: readonly LogEntry[]) => voidsOf(e).filter((v) => v.where === 'toilet' || v.where === 'both');
/** Voids where some urine escaped containment — the leaks (product breach, or none worn). */
export const leaksOf = (e: readonly LogEntry[]) => voidsOf(e).filter((v) => v.leaked);
/** Voids that went into protection — the "wettings" (into a product). */
export const wettingsOf = (e: readonly LogEntry[]) => voidsOf(e).filter((v) => v.where === 'product' || v.where === 'both');
export const nightsOf = (e: readonly LogEntry[]) => e.filter((x): x is NightEntry => x.kind === 'night');
export const changesOf = (e: readonly LogEntry[]) => e.filter((x): x is ChangeEntry => x.kind === 'change');
export const drinksOf = (e: readonly LogEntry[]) => e.filter((x): x is DrinkEntry => x.kind === 'drink');

/**
 * Profile signal that a void sometimes doesn't reach the toilet in time — urge,
 * functional, or reduced-awareness incontinence. Only meaningful for someone who wears
 * protection (otherwise a miss is a leak/accident, not a wetting into a product), so it
 * gates on that. When true, the void flow asks "did you make it?" and forks its questions.
 */
export function sometimesMissesToilet(
  enabledModules: readonly string[],
  traits: Record<string, string>,
): boolean {
  const has = (m: string) => enabledModules.includes(m);
  if (!has('protection')) return false;
  const lowWarning =
    ['<5 min', 'Almost none'].includes(traits.warningTime ?? '') ||
    ['Delayed', 'Minimal', 'Absent'].includes(traits.fillingAwareness ?? '');
  return has('urgency') || has('leakage') || has('awareness') || lowWarning;
}

/**
 * Whether the profile says bladder sensation is reduced — the only population for whom the
 * per-episode "did you feel it?" question is worth asking. For someone with normal
 * sensation the answer is always "yes, obviously," so we hide it; for an insensate person
 * the run of "found out after" is the clinical fingerprint, so we keep it.
 */
export function awarenessReduced(traits: Record<string, string>): boolean {
  return (
    ['Delayed', 'Minimal', 'Absent'].includes(traits.fillingAwareness ?? '') ||
    ['<5 min', 'Almost none'].includes(traits.warningTime ?? '') ||
    ['Sometimes', 'Usually find out after', 'Wake and find it'].includes(traits.leakNoticing ?? '')
  );
}

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
  /** Toilet-reaching voids only — the bathroom trips the frequency-volume chart plots. */
  voids: VoidEntry[];
  drinks: DrinkEntry[];
  changes: ChangeEntry[];
  /** Voids that went into a product (the "wettings"). */
  wettings: VoidEntry[];
  night?: NightEntry;
}

/** Group all entries by calendar day (nights keyed to the day they end), newest first. */
export function groupByDay(entries: readonly LogEntry[]): DayGroup[] {
  const byDay = new Map<string, DayGroup>();
  const get = (day: string): DayGroup =>
    byDay.get(day) ?? byDay.set(day, { day, voids: [], drinks: [], changes: [], wettings: [] }).get(day)!;
  for (const e of entries) {
    if (e.kind === 'void') {
      // A "both" void is a bathroom trip AND a product wetting — it lands in each bucket.
      if (e.where === 'toilet' || e.where === 'both') get(dayKeyOf(e.at)).voids.push(e);
      if (e.where === 'product' || e.where === 'both') get(dayKeyOf(e.at)).wettings.push(e);
    } else if (e.kind === 'drink') get(dayKeyOf(e.at)).drinks.push(e);
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
