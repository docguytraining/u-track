import { describe, it, expect } from 'vitest';
import { eventsToCsv, buildBackup, parseBackup } from './backup';
import type { LogEntry, Product } from './store';

const products: Product[] = [{ id: 'p1', name: 'Overnight brief', dryGrams: 100 }];

describe('eventsToCsv', () => {
  it('emits a header and a readable, comma-safe row per event, oldest first', () => {
    const entries: LogEntry[] = [
      { kind: 'drink', id: 'd1', at: Date.UTC(2026, 7, 5, 10), type: 'Coffee, black', volumeMl: 200 },
      { kind: 'void', id: 'v1', at: Date.UTC(2026, 7, 5, 9, 30), where: 'toilet', leaked: false, volumeMl: 250, size: null, productId: null, answers: {} },
    ];
    const csv = eventsToCsv(entries, products);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,time,type,detail,volume_ml,product');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('void'); // sorted oldest-first: the 09:30 void precedes the 10:00 drink
    expect(csv).toContain('"Coffee, black"'); // a cell with a comma is quoted
    expect(csv).toContain('250');
  });

  it('neutralizes spreadsheet formula injection in user-controlled cells', () => {
    const nasty: Product[] = [{ id: 'p1', name: '=HYPERLINK("http://evil","click")', dryGrams: 100 }];
    const entries: LogEntry[] = [
      { kind: 'change', id: 'c1', at: Date.UTC(2026, 7, 5, 9), productId: 'p1', volumeMl: 50, answers: {} },
    ];
    const csv = eventsToCsv(entries, nasty);
    // The formula must be defused with a leading apostrophe (inside the quoted cell), never
    // emitted so a spreadsheet would execute it.
    expect(csv).toContain(`"'=HYPERLINK`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
});

describe('parseBackup', () => {
  it('accepts the wrapped and bare forms and rejects anything else', () => {
    const wrapped = JSON.stringify(buildBackup({ entries: [] }, '2026-08-05T00:00:00Z'));
    expect(parseBackup(wrapped)).toEqual({ entries: [] });
    expect(parseBackup(JSON.stringify({ entries: [{ kind: 'void' }] }))).toEqual({ entries: [{ kind: 'void' }] });
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup(JSON.stringify({ foo: 1 }))).toBeNull(); // no entries array → not ours
  });
});
