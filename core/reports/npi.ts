/**
 * Nocturnal polyuria index — spec §4.1 / tests §9.B (not yet implemented).
 * NPi = NUV / 24h voided volume. Withheld (null) unless the contributing voids are
 * genuinely measured; flagged against the 0.33 threshold WITHOUT emitting a diagnosis.
 */
import { nocturnalUrineVolume, type VoidEvent, type SleepPeriod } from '../time/night';

export interface NpiResult {
  ratio: number | null;
  /** true only when every contributing void has a real volume. */
  complete: boolean;
  /** ratio > threshold; null when ratio is null. Threshold is age-dependent (spec §4.1). */
  overThreshold: boolean | null;
}

export function nocturnalPolyuriaIndex(
  voids: readonly VoidEvent[],
  sleep: SleepPeriod,
  threshold = 0.33,
): NpiResult {
  // Both numerator (NUV) and denominator (24h voided volume) must be genuinely
  // measured. If any void lacks a real volume the ratio is withheld, never guessed.
  const complete = voids.length > 0 && voids.every((v) => v.volumeMl != null);
  if (!complete) {
    return { ratio: null, complete: false, overThreshold: null };
  }

  const total24h = voids.reduce((sum, v) => sum + (v.volumeMl ?? 0), 0);
  const nuv = nocturnalUrineVolume(voids, sleep);
  if (total24h <= 0 || nuv == null) {
    return { ratio: null, complete, overThreshold: null };
  }

  const ratio = nuv / total24h;
  // A flag against the (age-dependent, caller-supplied) threshold — not a diagnosis.
  return { ratio, complete, overThreshold: ratio > threshold };
}
