import { describe, it, expect } from 'vitest';
import { buildClinicalSummary } from './summary';
import type { LogEntry, CheckIn, Med, Product } from './store';

const H = 3_600_000;
const noon = Date.UTC(2026, 7, 5, 12);

const mv = (at: number, volumeMl: number | null): LogEntry =>
  ({ kind: 'void', id: `v${at}`, at, where: 'toilet', leaked: false, volumeMl, size: null, productId: null, answers: {} });
const leak = (at: number, trigger: string): LogEntry =>
  ({ kind: 'void', id: `l${at}`, at, where: null, leaked: true, volumeMl: null, size: null, productId: null, answers: { leakTrigger: trigger } });
const night = (rising: number, answers: Record<string, string> = {}): LogEntry =>
  ({ kind: 'night', id: `n${rising}`, nightId: '', bedtime: rising - 8 * H, rising, firstVoidVolumeMl: null, answers });

describe('buildClinicalSummary', () => {
  it('says so plainly when there is nothing to summarize', () => {
    expect(buildClinicalSummary([], [], [], [], 'ml')).toBe('No events logged yet.');
  });

  it('renders a descriptive, paste-able summary with only the sections that have data', () => {
    const entries: LogEntry[] = [
      mv(noon, 300), mv(noon + 2 * H, 200), mv(noon + 4 * H, null),
      leak(noon + 5 * H, 'Urge'), leak(noon + 6 * H, 'Urge'),
      night(noon + 20 * H, { wetDry: 'Wet' }),
    ];
    const checkins: CheckIn[] = [{ id: 'c1', at: noon, interference: 6, bother: 5 }];
    const meds: Med[] = [{ id: 'm1', name: 'Furosemide', timing: 'Evening' }];
    const products: Product[] = [];

    const out = buildClinicalSummary(entries, checkins, meds, products, 'ml');

    expect(out).toContain('Bladder diary summary');
    expect(out).toContain('toilet voids/day');
    expect(out).toContain('functional (max void) 300 ml'); // measured max
    expect(out).toContain('average 250 ml'); // (300+200)/2
    expect(out).toContain('Leaks: 2, most often urge');
    expect(out).toContain('Weekly check-in (latest of 1): interference 6/10, bother 5/10');
    expect(out).toContain('Medications: Furosemide (evening)');
    expect(out).toContain('self-reported');
  });

  it('omits capacity when nothing was measured', () => {
    const out = buildClinicalSummary([mv(noon, null)], [], [], [], 'ml');
    expect(out).not.toContain('Capacity');
    expect(out).toContain('Voiding: 1.0 toilet void/day');
  });
});
