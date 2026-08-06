/**
 * Volume + quality model — spec §5.3 / tests §9.C (not yet implemented).
 * Every volume carries a quality flag; reports degrade to the lowest quality present.
 */
export type VolumeQuality = 'measured' | 'weighed' | 'estimated' | 'none';

export interface Volume {
  valueMl: number | null;
  quality: VolumeQuality;
  range?: string; // when quality === 'estimated', e.g. "300-500"
}

/**
 * Confidence ordering, most → least trustworthy. A report degrades to the lowest
 * rank present, so it never claims more precision than the weakest input supports.
 */
const QUALITY_RANK: Record<VolumeQuality, number> = {
  measured: 3,
  weighed: 2,
  estimated: 1,
  none: 0,
};

/** grams (wet − dry) → mL at 1 g ≈ 1 mL. */
export function weighedVolumeMl(dryGrams: number, wetGrams: number): number {
  return wetGrams - dryGrams;
}

/**
 * An estimated volume: a stored range with NO numeric mL, so it can never be
 * summed or displayed as if it were a real measurement (spec §5.3).
 */
export function estimatedVolume(range: string): Volume {
  return { valueMl: null, quality: 'estimated', range };
}

/** The lowest-confidence quality among a set — what a mixed report must surface. */
export function lowestQuality(volumes: readonly Volume[]): VolumeQuality {
  let lowest: VolumeQuality = 'measured';
  let seen = false;
  for (const v of volumes) {
    seen = true;
    if (QUALITY_RANK[v.quality] < QUALITY_RANK[lowest]) lowest = v.quality;
  }
  return seen ? lowest : 'none';
}
