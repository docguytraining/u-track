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

/**
 * Every involuntary loss of urine — the leak *symptom* a clinician reads as leakage — however
 * it was contained. That is one coin with two sides: caught by protection (a void into a
 * product) and reaching clothing/bed (an escape) are the same event, differing only in
 * containment. Whether the user tapped "void" or "leak" is their perspective, not the verdict;
 * what makes it incontinence is that it didn't reach the toilet under control. A clean toilet
 * void is the only thing this excludes.
 */
export const incontinenceEpisodesOf = (e: readonly LogEntry[]) =>
  voidsOf(e).filter((v) => v.leaked || v.where === 'product' || v.where === 'both' || v.where == null);
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

/** Rough mL for an unmeasured event, from its reported size. Conservative and clearly an
 * estimate — a relative signal for spotting bursts, not a measured figure. 'Medium' is a legacy
 * value from the older size scale. */
const SIZE_ML: Record<string, number> = { Dribble: 15, Small: 60, Medium: 200, Moderate: 150, Large: 300, Full: 500 };
/** Rough mL for an involuntary loss, from its reported severity. */
const SEVERITY_ML: Record<string, number> = { 'A few drops': 15, Damp: 40, Moderate: 100, Soaked: 250 };

/** A void's effective volume for burst detection: the measured mL, else an estimate from its
 * reported size or leak severity. Null when there's no volume signal at all. */
export function voidEffectiveMl(v: VoidEntry): { ml: number; estimated: boolean } | null {
  if (v.volumeMl != null) return { ml: v.volumeMl, estimated: false };
  if (v.size && SIZE_ML[v.size] != null) return { ml: SIZE_ML[v.size]!, estimated: true };
  // Any involuntary loss with a reported severity — escaped or caught by protection — estimates
  // from that severity (a contained leak carries no `size`, only `leakSeverity`).
  const sev = v.answers.leakSeverity;
  if (sev && SEVERITY_ML[sev] != null) return { ml: SEVERITY_ML[sev]!, estimated: true };
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

/** The rolling period the pattern detectors reason over: the window of up to `periodDays`
 * ending on the most recent logged void, and how many distinct days in it carried data. Null
 * when there isn't enough logged history (fewer than `minDays`) to claim a pattern. */
function rollingPeriod(
  entries: readonly LogEntry[],
  periodDays: number,
  minDays: number,
): { cutoff: number; periodDayCount: number } | null {
  const voids = voidsOf(entries);
  if (!voids.length) return null;
  const anchor = Math.max(...voids.map((v) => v.at));
  const cutoff = anchor - (periodDays - 1) * DAY_MS;
  const periodDayCount = new Set(voids.filter((v) => v.at >= cutoff).map((v) => dayKeyOf(v.at))).size;
  return periodDayCount < minDays ? null : { cutoff, periodDayCount };
}

/** Group timed events that recur at the same clock time (within ±toleranceMin, wrapping across
 * midnight), keeping only windows that appear on at least half the period's logged days.
 * Strongest (most days) first; non-overlapping. Shared by the surge and cluster detectors. */
function recurringByTimeOfDay<T extends { at: number }>(
  items: readonly T[],
  periodDayCount: number,
  toleranceMin: number,
): { minuteOfDay: number; days: number; members: T[] }[] {
  const pts = items.map((it) => ({ it, min: minuteOfDayOf(it.at), day: dayKeyOf(it.at) }));
  const required = Math.ceil(periodDayCount / 2);
  const candidates = pts.map((p) => {
    const members = pts.filter((o) => circadianGap(p.min, o.min) <= toleranceMin);
    return { centre: p.min, members, days: new Set(members.map((m) => m.day)).size };
  });
  candidates.sort((a, b) => b.days - a.days || b.members.length - a.members.length);
  const out: { minuteOfDay: number; days: number; members: T[] }[] = [];
  const claimed = new Set<T>();
  for (const c of candidates) {
    if (c.days < required) continue;
    if (c.members.some((m) => claimed.has(m.it))) continue;
    c.members.forEach((m) => claimed.add(m.it));
    out.push({ minuteOfDay: c.centre, days: c.days, members: c.members.map((m) => m.it) });
  }
  return out;
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
  const period = rollingPeriod(entries, periodDays, minDays);
  if (!period) return [];
  const inWindow = all.filter((s) => s.at >= period.cutoff);
  return recurringByTimeOfDay(inWindow, period.periodDayCount, toleranceMin).map((g) => ({
    minuteOfDay: g.minuteOfDay,
    days: g.days,
    periodDays: period.periodDayCount,
    estimated: g.members.some((m) => m.estimated),
    surges: [...g.members].sort((a, b) => b.at - a.at),
  }));
}

export const CLUSTER_WINDOW_MS = 60 * 60_000; // "close together" = within an hour
export const CLUSTER_MIN_VOIDS = 3; // three signals in that hour is the clustering threshold

/** A run of bladder emptyings packed close together — voids AND leaks alike, since the point
 * is the *repetition*: going (or leaking) again and again in a short span. Whether the volumes
 * are large or small is what tells the two clinical stories apart — large means you can't hold
 * the output, small means you may not be emptying fully or can't hold even a little. */
export interface VoidCluster {
  at: number;
  endAt: number;
  /** How many emptyings fell in the window. */
  voids: number;
  /** Summed volume across them (measured + estimated), mL. */
  totalMl: number;
  /** True if any component volume was estimated rather than measured. */
  estimated: boolean;
  /** True if at least one emptying carried a real measured volume. */
  measured: boolean;
}

/** Find runs of at least `minVoids` bladder emptyings within a short window (default 1 hour).
 * Non-overlapping — once a run is taken, scanning resumes after it. */
export function detectVoidClusters(
  entries: readonly LogEntry[],
  { windowMs = CLUSTER_WINDOW_MS, minVoids = CLUSTER_MIN_VOIDS }: { windowMs?: number; minVoids?: number } = {},
): VoidCluster[] {
  const evs = voidsOf(entries)
    .map((v) => { const e = voidEffectiveMl(v); return { at: v.at, ml: e?.ml ?? 0, estimated: e?.estimated ?? false, measured: !!e && !e.estimated }; })
    .sort((a, b) => a.at - b.at);
  const clusters: VoidCluster[] = [];
  let i = 0;
  while (i < evs.length) {
    let j = i;
    while (j < evs.length && evs[j]!.at - evs[i]!.at <= windowMs) j++;
    if (j - i >= minVoids) {
      const slice = evs.slice(i, j);
      clusters.push({
        at: evs[i]!.at, endAt: evs[j - 1]!.at, voids: j - i,
        totalMl: Math.round(slice.reduce((s, e) => s + e.ml, 0)),
        estimated: slice.some((e) => e.estimated),
        measured: slice.some((e) => e.measured),
      });
      i = j; // non-overlapping
    } else {
      i++;
    }
  }
  return clusters;
}

/** A recurring cluster of emptyings at a consistent time of day. */
export interface ClusterPattern {
  minuteOfDay: number;
  days: number;
  periodDays: number;
  /** Typical number of emptyings per cluster in this window. */
  typicalVoids: number;
  /** Typical summed volume per cluster when measured, else null. */
  typicalMl: number | null;
  estimated: boolean;
  clusters: VoidCluster[];
}

/** Clustered voiding that recurs at the same time of day — the "why am I getting the signal
 * three times and still not empty / still can't hold it" pattern. Same rolling-period and
 * half-the-days rule as the surge detector. */
export function voidClusterPatterns(
  entries: readonly LogEntry[],
  opts: { windowMs?: number; minVoids?: number; toleranceMin?: number; periodDays?: number; minDays?: number } = {},
): ClusterPattern[] {
  const { windowMs, minVoids, toleranceMin = SURGE_TOLERANCE_MIN, periodDays = SURGE_PERIOD_DAYS, minDays = SURGE_MIN_DAYS } = opts;
  const all = detectVoidClusters(entries, { windowMs, minVoids });
  if (!all.length) return [];
  const period = rollingPeriod(entries, periodDays, minDays);
  if (!period) return [];
  const inWindow = all.filter((c) => c.at >= period.cutoff);
  return recurringByTimeOfDay(inWindow, period.periodDayCount, toleranceMin).map((g) => {
    const measured = g.members.filter((c) => c.measured);
    return {
      minuteOfDay: g.minuteOfDay,
      days: g.days,
      periodDays: period.periodDayCount,
      typicalVoids: Math.round(g.members.reduce((s, c) => s + c.voids, 0) / g.members.length),
      typicalMl: measured.length ? Math.round(measured.reduce((s, c) => s + c.totalMl, 0) / measured.length) : null,
      estimated: g.members.some((c) => c.estimated),
      clusters: [...g.members].sort((a, b) => b.at - a.at),
    };
  });
}

/** Rough mL a change represents, from how full it felt (when it wasn't weighed). */
const FULLNESS_ML: Record<string, number> = { Light: 40, Moderate: 150, Heavy: 300, Saturated: 500 };

/** A change that came back far wetter than what was logged into it — the derived unnoticed-loss
 * signal. No question asks "did you feel it": if the product absorbed much more than you logged,
 * the difference is urine you didn't notice. */
export interface UnnoticedLoss {
  at: number;
  /** Volume the product held (weighed, else estimated from fullness). */
  absorbedMl: number;
  /** Volume actually logged into it during the wear window. */
  loggedMl: number;
  /** absorbedMl − loggedMl — the unaccounted volume. */
  shortfallMl: number;
  /** The wear window used, ms (recorded, or the capped gap since the last change). */
  wearMs: number | null;
  productName?: string;
}

/** Changes where the product held far more than was logged into it over the wear window — a
 * signal of losses the user didn't feel. Flags only a real shortfall (default ≥150 mL, and
 * under half the absorbed volume logged), newest first. */
export function unnoticedLosses(
  entries: readonly LogEntry[],
  products: readonly Product[],
  { minShortfallMl = 150, maxLoggedFraction = 0.5 }: { minShortfallMl?: number; maxLoggedFraction?: number } = {},
): UnnoticedLoss[] {
  const changes = changesOf(entries).slice().sort((a, b) => a.at - b.at);
  const wettings = wettingsOf(entries);
  const out: UnnoticedLoss[] = [];
  let prevAt: number | null = null;
  for (const c of changes) {
    const absorbedMl = c.volumeMl ?? FULLNESS_ML[c.answers.fullness ?? ''] ?? 0;
    const wearMs = c.wearMs ?? (prevAt != null ? Math.min(c.at - prevAt, 12 * 3_600_000) : null);
    prevAt = c.at;
    if (absorbedMl <= 0) continue;
    const from = wearMs != null ? c.at - wearMs : -Infinity;
    const loggedMl = wettings
      .filter((w) => w.at > from && w.at <= c.at)
      .reduce((s, w) => s + (voidEffectiveMl(w)?.ml ?? 0), 0);
    const shortfallMl = absorbedMl - loggedMl;
    if (shortfallMl >= minShortfallMl && loggedMl <= absorbedMl * maxLoggedFraction) {
      out.push({
        at: c.at, absorbedMl: Math.round(absorbedMl), loggedMl: Math.round(loggedMl),
        shortfallMl: Math.round(shortfallMl), wearMs: wearMs ?? null,
        productName: products.find((p) => p.id === c.productId)?.name,
      });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

/** A product that keeps coming back heavy after only a short wear — it's being overwhelmed
 * faster than it should, which is a "consider higher capacity, or ask why the output is this
 * high" conversation. Sits alongside the overnight-adequacy (leaky-products) signal. */
export interface RapidSaturation {
  productId: string | null;
  productName?: string;
  /** How many fast-saturation changes were seen for this product. */
  episodes: number;
  /** Typical wear hours before it came back heavy. */
  medianWearH: number;
}

/** Products repeatedly saturated within a short wear window (default heavy/soaked within 2h, on
 * at least 3 changes). Most-frequent first. */
export function rapidSaturation(
  entries: readonly LogEntry[],
  products: readonly Product[],
  { maxWearMs = 2 * 3_600_000, minEpisodes = 3 }: { maxWearMs?: number; minEpisodes?: number } = {},
): RapidSaturation[] {
  const heavy = (c: ChangeEntry) =>
    c.volumeMl != null ? c.volumeMl >= 300 : ['Heavy', 'Saturated'].includes(c.answers.fullness ?? '');
  const fast = changesOf(entries).filter((c) => heavy(c) && c.wearMs != null && c.wearMs <= maxWearMs);
  const byProduct = new Map<string, ChangeEntry[]>();
  for (const c of fast) {
    const k = c.productId ?? '';
    (byProduct.get(k) ?? byProduct.set(k, []).get(k)!).push(c);
  }
  const out: RapidSaturation[] = [];
  for (const [pid, cs] of byProduct) {
    if (cs.length < minEpisodes) continue;
    const wearsH = cs.map((c) => c.wearMs! / 3_600_000).sort((a, b) => a - b);
    out.push({
      productId: pid || null,
      productName: products.find((p) => p.id === pid)?.name,
      episodes: cs.length,
      medianWearH: Math.round(wearsH[Math.floor(wearsH.length / 2)]! * 10) / 10,
    });
  }
  return out.sort((a, b) => b.episodes - a.episodes);
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
