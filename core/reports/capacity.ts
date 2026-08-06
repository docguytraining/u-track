/**
 * Voided-volume statistics — spec §6.7 / frequency-volume chart.
 *
 * Max voided volume is the accepted proxy for functional bladder capacity; average
 * voided volume is the mean over measured voids. Both are withheld (null) when no
 * void carries a real volume — never a fabricated zero.
 */
import type { VoidEvent } from '../time/night';

export interface VoidedVolumeStats {
  /** Total voids in the set. */
  voids: number;
  /** How many carried a real measured volume. */
  measured: number;
  /** Largest measured void — the functional-capacity proxy. */
  maxMl: number | null;
  /** Mean of measured voids. */
  averageMl: number | null;
}

export function voidedVolumeStats(voids: readonly VoidEvent[]): VoidedVolumeStats {
  const vals = voids.map((v) => v.volumeMl).filter((x): x is number => x != null);
  return {
    voids: voids.length,
    measured: vals.length,
    maxMl: vals.length ? Math.max(...vals) : null,
    averageMl: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
  };
}
