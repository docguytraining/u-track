import { describe, it, expect } from 'vitest';
import { weighedVolumeMl, estimatedVolume, lowestQuality, type Volume } from './volume';

/** Group C — Volume & quality (spec §5.3, §9.C). */
describe('C. Volume & quality', () => {
  it('C10: weighed volume = wet grams − dry grams at 1 g ≈ 1 mL', () => {
    expect(weighedVolumeMl(200, 480)).toBe(280);
    expect(weighedVolumeMl(0, 0)).toBe(0);
  });

  it('C11: an estimated volume stores a range and never masquerades as a measured number', () => {
    const e = estimatedVolume('300-500');
    expect(e.quality).toBe('estimated');
    expect(e.range).toBe('300-500');
    expect(e.valueMl).toBeNull(); // no numeric mL that a report could mistake for measured
  });

  it('C12: a mixed-quality report surfaces the lowest quality present', () => {
    const measured: Volume = { valueMl: 350, quality: 'measured' };
    const weighed: Volume = { valueMl: 280, quality: 'weighed' };
    const estimated: Volume = estimatedVolume('300-500');
    const none: Volume = { valueMl: null, quality: 'none' };

    expect(lowestQuality([measured, measured])).toBe('measured');
    expect(lowestQuality([measured, weighed])).toBe('weighed');
    expect(lowestQuality([measured, weighed, estimated])).toBe('estimated');
    expect(lowestQuality([measured, weighed, estimated, none])).toBe('none');
    expect(lowestQuality([])).toBe('none'); // nothing recorded → no confidence to claim
  });
});
