import { describe, it, expect } from 'vitest';
import { voidedVolumeStats } from './capacity';
import type { VoidEvent } from '../time/night';

const v = (id: string, at: number, volumeMl: number | null): VoidEvent => ({ id, at, volumeMl });

/**
 * Voided-volume stats — max voided volume is the standard proxy for functional
 * bladder capacity; average is over measured voids only. Withheld (null), not zero,
 * when nothing was measured — same honesty rule as the rest of the core.
 */
describe('Voided volume stats', () => {
  it('max = functional-capacity proxy; average is over measured voids only', () => {
    const voids = [v('a', 1, 220), v('b', 2, 180), v('c', 3, 260), v('d', 4, null), v('e', 5, 300)];
    const s = voidedVolumeStats(voids);
    expect(s.voids).toBe(5);
    expect(s.measured).toBe(4);
    expect(s.maxMl).toBe(300);
    expect(s.averageMl).toBe((220 + 180 + 260 + 300) / 4); // 240 — the unmeasured void is excluded
  });

  it('no measured volumes → nulls, not zeros', () => {
    const s = voidedVolumeStats([v('a', 1, null), v('b', 2, null)]);
    expect(s.voids).toBe(2);
    expect(s.measured).toBe(0);
    expect(s.maxMl).toBeNull();
    expect(s.averageMl).toBeNull();
  });

  it('empty set', () => {
    expect(voidedVolumeStats([])).toEqual({ voids: 0, measured: 0, maxMl: null, averageMl: null });
  });
});
