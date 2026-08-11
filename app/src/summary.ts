import {
  voidedVolumeStats,
  nocturiaCount,
  nocturnalPolyuriaIndex,
  type VoidEvent,
} from '@core';
import {
  voidsOf,
  toiletVoidsOf,
  leaksOf,
  wettingsOf,
  incontinenceEpisodesOf,
  nightsOf,
  groupByDay,
  isWetNight,
  isDryNight,
  tally,
  productAdequacy,
  dateStr,
} from './insights';
import type { LogEntry, CheckIn, Med, Product } from './store';
import { fmtVol, type Units } from './units';

/**
 * A short, plain-text clinical summary of the diary — the thing you paste into a
 * patient-portal message ("here's where I'm at") or read to a nurse on the phone. It sits
 * between the raw CSV (too much) and the printable chart (a formatted page you can't paste):
 * a few neutral sentences a clinician can skim.
 *
 * Strictly descriptive — every line is a count or an average, never an interpretation. Lines
 * with no data are omitted rather than shown as "—", so the summary is only as long as the
 * diary is deep. Volumes render in the user's unit; the reader is told figures are
 * self-reported.
 */
export function buildClinicalSummary(
  entries: readonly LogEntry[],
  checkins: readonly CheckIn[],
  meds: readonly Med[],
  products: readonly Product[],
  units: Units,
): string {
  const at = (e: LogEntry) => (e.kind === 'night' ? e.bedtime : e.at);
  if (entries.length === 0) return 'No events logged yet.';

  const times = entries.map(at);
  const start = Math.min(...times);
  const end = Math.max(...times);
  const days = groupByDay(entries).length || 1;
  const range =
    dateStr(start) === dateStr(end) ? dateStr(start) : `${dateStr(start)}–${dateStr(end)}`;

  const allVoids = voidsOf(entries);
  const toilet = toiletVoidsOf(entries);
  const leaks = leaksOf(entries);
  const wettings = wettingsOf(entries);
  const nights = nightsOf(entries);
  const coreVoids: VoidEvent[] = toilet.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));
  const cap = voidedVolumeStats(coreVoids);

  const lines: string[] = [`Bladder diary summary — ${range} (${days} day${days === 1 ? '' : 's'}).`, ''];

  // Frequency: toilet trips, plus total emptyings when wettings into protection exist.
  const voidsPerDay = (toilet.length / days).toFixed(1);
  let freq = `Voiding: ${voidsPerDay} toilet void${toilet.length === 1 ? '' : 's'}/day`;
  if (wettings.length > 0) freq += `; ${(allVoids.length / days).toFixed(1)} total bladder emptyings/day counting leaks into protection`;
  lines.push(freq + '.');

  // Capacity from measured toilet voids only.
  if (cap.measured > 0) {
    lines.push(`Capacity: functional (max void) ${fmtVol(cap.maxMl, units)}, average ${fmtVol(cap.averageMl, units)} over ${cap.measured} measured void${cap.measured === 1 ? '' : 's'}.`);
  }

  // Nights: nocturia average, NPi from the most recent measurable night, wet/dry tally.
  if (nights.length > 0) {
    const nocturiaAvg = (nights.reduce((s, n) => s + nocturiaCount(coreVoids, { bedtime: n.bedtime, rising: n.rising }), 0) / nights.length).toFixed(1);
    let nightLine = `Nights: ${nocturiaAvg} nocturia void${nocturiaAvg === '1.0' ? '' : 's'}/night over ${nights.length} night${nights.length === 1 ? '' : 's'}`;
    const recentNpi = [...nights]
      .sort((a, b) => b.bedtime - a.bedtime)
      .map((n) => nocturnalPolyuriaIndex(coreVoids, { bedtime: n.bedtime, rising: n.rising }).ratio)
      .find((r) => r != null);
    if (recentNpi != null) nightLine += `; nocturnal polyuria index ${(recentNpi * 100).toFixed(0)}%`;
    lines.push(nightLine + '.');
    const wet = nights.filter(isWetNight).length;
    const dry = nights.filter(isDryNight).length;
    if (wet + dry > 0) lines.push(`Wet nights ${wet}, dry nights ${dry}.`);
  }

  // Incontinence episodes (leaks): every involuntary loss, split by containment, with the most
  // common trigger. "Escaped" reached clothing/bed; "caught" stayed in protection.
  const episodes = incontinenceEpisodesOf(entries);
  if (episodes.length > 0) {
    const escaped = leaks.length; // leaked === true
    const caught = episodes.length - escaped;
    const parts = [];
    if (escaped) parts.push(`${escaped} reached clothing/bed`);
    if (caught) parts.push(`${caught} caught by protection`);
    const triggers = tally(episodes, 'leakTrigger');
    const top = Object.entries(triggers).sort((a, b) => b[1] - a[1])[0];
    lines.push(`Leaks (incontinence episodes): ${episodes.length}${parts.length ? ` (${parts.join(', ')})` : ''}${top ? `, most often ${top[0].toLowerCase()}` : ''}.`);
  }

  // Overnight product adequacy — only products that leaked overnight.
  const leaked = productAdequacy(nights, products).filter((a) => a.leaks > 0);
  if (leaked.length > 0) {
    lines.push('Overnight protection: ' + leaked.map((a) => `${a.name} leaked ${a.leaks} of ${a.nights} night${a.nights === 1 ? '' : 's'}`).join('; ') + '.');
  }

  // Quality-of-life check-in (latest, with count for the trend).
  const lastCk = checkins[checkins.length - 1];
  if (lastCk) {
    lines.push(`Weekly check-in (latest of ${checkins.length}): interference ${lastCk.interference}/10, bother ${lastCk.bother}/10.`);
  }

  // Medications as context, with timing.
  if (meds.length > 0) {
    lines.push('Medications: ' + meds.map((m) => `${m.name} (${m.timing.toLowerCase()})`).join(', ') + '.');
  }

  lines.push('', 'Tracked with u-track. Not a medical device; figures are self-reported.');
  return lines.join('\n');
}
