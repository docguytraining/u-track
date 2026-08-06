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

/** grams (wet − dry) → mL at 1 g ≈ 1 mL. */
export function weighedVolumeMl(_dryGrams: number, _wetGrams: number): number {
  throw new Error('not implemented');
}

/** The lowest-confidence quality among a set — what a mixed report must surface. */
export function lowestQuality(_volumes: readonly Volume[]): VolumeQuality {
  throw new Error('not implemented');
}
