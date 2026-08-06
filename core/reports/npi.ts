/**
 * Nocturnal polyuria index — spec §4.1 / tests §9.B (not yet implemented).
 * NPi = NUV / 24h voided volume. Withheld (null) unless the contributing voids are
 * genuinely measured; flagged against the 0.33 threshold WITHOUT emitting a diagnosis.
 */
import type { VoidEvent, SleepPeriod } from '../time/night';

export interface NpiResult {
  ratio: number | null;
  /** true only when every contributing void has a real volume. */
  complete: boolean;
  /** ratio > threshold; null when ratio is null. Threshold is age-dependent (spec §4.1). */
  overThreshold: boolean | null;
}

export function nocturnalPolyuriaIndex(
  _voids: readonly VoidEvent[],
  _sleep: SleepPeriod,
  _threshold = 0.33,
): NpiResult {
  throw new Error('not implemented');
}
