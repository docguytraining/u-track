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

/** One hour of the day, aggregated across every logged day. */
export interface HourBucket {
  /** 0–23, local hour. */
  hour: number;
  /** Bladder emptyings that hour (toilet or into a product), not counting leaks. */
  voids: number;
  /** Voids where urine escaped that hour. */
  leaks: number;
}

/**
 * The day's rhythm: every void folded onto a 24-hour clock so the *time of day* things
 * happen becomes visible across all logged days at once. "When does it happen — mornings,
 * after lunch, overnight?" is one of the first questions a clinician asks, and a single day's
 * chart can't answer it. Purely descriptive: it shows the pattern, it never judges it.
 */
export function hourlyRhythm(entries: readonly LogEntry[]): {
  buckets: HourBucket[];
  days: number;
  total: number;
  peak: HourBucket | null;
} {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, voids: 0, leaks: 0 }));
  const days = new Set<string>();
  for (const v of voidsOf(entries)) {
    const h = new Date(v.at).getHours();
    days.add(dayKeyOf(v.at));
    if (v.leaked) buckets[h]!.leaks++;
    else buckets[h]!.voids++;
  }
  const total = buckets.reduce((s, b) => s + b.voids + b.leaks, 0);
  const peak = total ? buckets.reduce((a, b) => (b.voids + b.leaks > a.voids + a.leaks ? b : a)) : null;
  return { buckets, days: days.size, total, peak };
}

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

/* ────────────────────────────────────────────────────────────────────────────
 * High-volume episodes and their time-of-day patterns.
 *
 * A lot of urine passed in a short span is a clinically significant event (an output
 * burst); when such events recur at the same time of day across days, that recurrence is
 * itself the finding — the fingerprint of things like nocturnal polyuria or a timed diuretic
 * effect. This detects both: the per-day episodes, and any consistent-clock-time pattern.
 *
 * Volumes are only measured on measured days, so where a real mL is missing we fall back to a
 * rough estimate from the self-reported size of a product void (or a leak's severity) — "use
 * the data we have." Estimates are flagged so the readout can say so. This is descriptive: it
 * surfaces the pattern for a provider conversation, it doesn't diagnose.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Rough mL for an unmeasured void, from its reported size. Conservative and clearly an
 * estimate — a relative signal for spotting bursts, not a measured figure. */
const SIZE_ML: Record<string, number> = { Small: 100, Medium: 200, Large: 350 };
/** Rough mL for an escape, from its severity. */
const SEVERITY_ML: Record<string, number> = { Damp: 40, Moderate: 100, Soaked: 250 };

/** A void's effective volume for burst detection: the measured mL, else an estimate from its
 * reported size or leak severity. Null when there's no volume signal at all. */
export function voidEffectiveMl(v: VoidEntry): { ml: number; estimated: boolean } | null {
  if (v.volumeMl != null) return { ml: v.volumeMl, estimated: false };
  if (v.size && SIZE_ML[v.size] != null) return { ml: SIZE_ML[v.size]!, estimated: true };
  const sev = v.answers.leakSeverity;
  if (v.leaked && sev && SEVERITY_ML[sev] != null) return { ml: SEVERITY_ML[sev]!, estimated: true };
  return null;
}

/** One high-volume episode: voids inside a short window whose volume clears the threshold. */
export interface VolumeSurge {
  /** First void in the episode, epoch ms. */
  at: number;
  /** Last void in the episode, epoch ms. */
  endAt: number;
  /** Summed (measured + estimated) volume, mL. */
  totalMl: number;
  /** How many voids made up the episode. */
  voids: number;
  /** True if any component volume was estimated from size/severity rather than measured. */
  estimated: boolean;
}

/** A recurring high-volume episode at a consistent time of day. */
export interface SurgePattern {
  /** Centre of the recurring window, minutes since local midnight. */
  minuteOfDay: number;
  /** Distinct days in the rolling period that had an episode in this window. */
  days: number;
  /** Distinct logged days in the rolling period (the denominator). */
  periodDays: number;
  /** True if any contributing episode leaned on estimated volumes. */
  estimated: boolean;
  /** The episodes that formed the pattern, newest first. */
  surges: VolumeSurge[];
}

export const SURGE_WINDOW_MS = 2 * 3_600_000; // "short time" = a 2-hour window
export const SURGE_THRESHOLD_ML = 400; // a normal void is ~200–300 mL; 400+ concentrated is a burst
export const SURGE_TOLERANCE_MIN = 60; // "same time of day" = within ±1 hour
export const SURGE_PERIOD_DAYS = 14; // rolling period: up to two weeks…
export const SURGE_MIN_DAYS = 3; // …but at least three logged days before we call anything

const DAY_MS = 86_400_000;
const minuteOfDayOf = (at: number) => { const d = new Date(at); return d.getHours() * 60 + d.getMinutes(); };
/** Shortest distance between two clock minutes, wrapping across midnight (so 23:30 and 00:30
 * are 60 min apart, not 1380). */
const circadianGap = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 1440 - d); };

/** Find every high-volume episode: a rolling window (default 2h) whose voids sum to at least
 * the threshold. Episodes are non-overlapping — once a window clears, scanning resumes after it. */
export function detectVolumeSurges(
  entries: readonly LogEntry[],
  { windowMs = SURGE_WINDOW_MS, thresholdMl = SURGE_THRESHOLD_ML }: { windowMs?: number; thresholdMl?: number } = {},
): VolumeSurge[] {
  const pts = voidsOf(entries)
    .map((v) => { const e = voidEffectiveMl(v); return e ? { at: v.at, ml: e.ml, estimated: e.estimated } : null; })
    .filter((p): p is { at: number; ml: number; estimated: boolean } => p != null)
    .sort((a, b) => a.at - b.at);
  const surges: VolumeSurge[] = [];
  let i = 0;
  while (i < pts.length) {
    let sum = 0;
    let estimated = false;
    let j = i;
    while (j < pts.length && pts[j]!.at - pts[i]!.at <= windowMs) { sum += pts[j]!.ml; estimated = estimated || pts[j]!.estimated; j++; }
    if (sum >= thresholdMl) {
      surges.push({ at: pts[i]!.at, endAt: pts[j - 1]!.at, totalMl: Math.round(sum), voids: j - i, estimated });
      i = j; // non-overlapping
    } else {
      i++;
    }
  }
  return surges;
}

/** Recurring high-volume episodes at a consistent time of day, over a rolling period (default
 * up to 14 days, at least 3 logged days). A window is a "pattern" when it holds an episode on
 * at least half the logged days in the period. Strongest (most days) first; non-overlapping. */
export function surgePatterns(
  entries: readonly LogEntry[],
  opts: { windowMs?: number; thresholdMl?: number; toleranceMin?: number; periodDays?: number; minDays?: number } = {},
): SurgePattern[] {
  const { windowMs, thresholdMl, toleranceMin = SURGE_TOLERANCE_MIN, periodDays = SURGE_PERIOD_DAYS, minDays = SURGE_MIN_DAYS } = opts;
  const all = detectVolumeSurges(entries, { windowMs, thresholdMl });
  if (!all.length) return [];

  // Rolling period: the window ending on the most recent logged void, spanning up to periodDays.
  const voids = voidsOf(entries);
  const anchor = Math.max(...voids.map((v) => v.at));
  const cutoff = anchor - (periodDays - 1) * DAY_MS;
  const periodDayCount = new Set(voids.filter((v) => v.at >= cutoff).map((v) => dayKeyOf(v.at))).size;
  if (periodDayCount < minDays) return [];
  const required = Math.ceil(periodDayCount / 2);

  const inWindow = all.filter((s) => s.at >= cutoff).map((s) => ({ s, min: minuteOfDayOf(s.at), day: dayKeyOf(s.at) }));

  // Centre a candidate window on each episode's clock time; keep those recurring on ≥ required
  // distinct days, then greedily take the strongest non-overlapping clusters.
  const candidates = inWindow.map((c) => {
    const members = inWindow.filter((o) => circadianGap(c.min, o.min) <= toleranceMin);
    return { centre: c.min, members, days: new Set(members.map((m) => m.day)).size };
  });
  candidates.sort((a, b) => b.days - a.days || b.members.length - a.members.length);

  const patterns: SurgePattern[] = [];
  const claimed = new Set<VolumeSurge>();
  for (const c of candidates) {
    if (c.days < required) continue;
    if (c.members.some((m) => claimed.has(m.s))) continue;
    c.members.forEach((m) => claimed.add(m.s));
    patterns.push({
      minuteOfDay: c.centre,
      days: c.days,
      periodDays: periodDayCount,
      estimated: c.members.some((m) => m.s.estimated),
      surges: c.members.map((m) => m.s).sort((a, b) => b.at - a.at),
    });
  }
  return patterns;
}

/** A clock minute-of-day as a readable time, e.g. 305 → "5:05 AM". */
export const minuteOfDayStr = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const timeStr = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateStr = (at: number) => new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const dayKey = (at: number) => new Date(at).toLocaleDateString('en-CA'); // YYYY-MM-DD local
export const durationStr = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
};
