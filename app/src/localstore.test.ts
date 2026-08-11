import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocalDiary, saveLocalDiary, clearLocalDiary } from './localstore';

/** Minimal in-memory Storage so the localstore module has a window.localStorage to talk to
 * under the node test environment. */
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: memStorage() };
});

describe('localstore (guest on-device persistence)', () => {
  it('round-trips a persisted diary slice', () => {
    const slice = {
      onboarded: true,
      enabledModules: ['void', 'night'],
      traits: { sex: 'f' },
      products: [{ id: 'p1', name: 'Night brief', dryGrams: 40 }],
      drinkTypes: ['Water', 'Coffee'],
      units: 'oz',
      entries: [{ kind: 'void', id: 'e1', at: 1_000, where: 'toilet', volumeMl: 250, answers: {} }],
      checkins: [],
      meds: [],
    };
    saveLocalDiary(slice);
    expect(loadLocalDiary()).toEqual(slice);
  });

  it('returns null when nothing is stored', () => {
    expect(loadLocalDiary()).toBeNull();
  });

  it('returns null (never throws) on a corrupted value', () => {
    (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.setItem('utrack:v1:diary', '{not json');
    expect(loadLocalDiary()).toBeNull();
  });

  it('returns null for a stored non-object (e.g. an array)', () => {
    (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.setItem('utrack:v1:diary', '[1,2,3]');
    expect(loadLocalDiary()).toBeNull();
  });

  it('clears the stored diary', () => {
    saveLocalDiary({ entries: [] });
    expect(loadLocalDiary()).not.toBeNull();
    clearLocalDiary();
    expect(loadLocalDiary()).toBeNull();
  });

  it('does nothing and does not throw when window is unavailable', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(() => saveLocalDiary({ entries: [] })).not.toThrow();
    expect(loadLocalDiary()).toBeNull();
    expect(() => clearLocalDiary()).not.toThrow();
  });
});
