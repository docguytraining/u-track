import { describe, it, expect } from 'vitest';
import {
  composeCore,
  composeGateway,
  CORE_BUDGET,
  type QuestionDef,
  type TrackingModule,
} from './registry';

const q = (
  id: string,
  surface: QuestionDef['surface'],
  coreEligible: boolean,
  priority: number,
): QuestionDef => ({ id, surface, coreEligible, priority });

// OAB profile promotes urgency to the void surface's core.
const oab: TrackingModule = {
  id: 'oab',
  enabled: true,
  eventTypes: ['void'],
  questions: [q('urgency', 'void', true, 50)],
};

// BPH's per-void cluster is all gateway (§6.1: never on the fast path).
const bph: TrackingModule = {
  id: 'bph',
  enabled: true,
  eventTypes: ['void'],
  questions: [
    q('stream', 'void', false, 40),
    q('hesitancy', 'void', false, 10),
    q('incompleteEmptying', 'void', false, 5),
  ],
};

// A second module that DOES promote a void core question, to test composition.
const emptying: TrackingModule = {
  id: 'emptying',
  enabled: true,
  eventTypes: ['void'],
  questions: [q('emptying', 'void', true, 40)],
};

// Enuresis-only: rich morning, and crucially NO daytime-void question at all.
const enuresis: TrackingModule = {
  id: 'enuresis',
  enabled: true,
  eventTypes: ['night', 'morning'],
  questions: [
    q('wetDry', 'morning', true, 60),
    q('awareness', 'morning', true, 55),
  ],
};

// Nocturia and IPSS both own the same morning "nocturia count" question id.
const nocturia: TrackingModule = {
  id: 'nocturia',
  enabled: true,
  eventTypes: ['night', 'morning'],
  questions: [q('nocturiaCount', 'morning', true, 70)],
};
const ipss: TrackingModule = {
  id: 'ipss',
  enabled: true,
  eventTypes: ['morning'],
  questions: [q('nocturiaCount', 'morning', true, 30)],
};

const ids = (qs: QuestionDef[]): string[] => qs.map((x) => x.id);

describe('D. Module registry composition (§5.4, §9.D)', () => {
  it('D13: enabling a module adds exactly its questions; disabling removes them; core untouched', () => {
    const bphOff: TrackingModule = { ...bph, enabled: false };

    // Disabled BPH contributes nothing.
    expect(ids(composeCore([oab, bphOff], 'void'))).toEqual(['urgency']);
    expect(composeGateway([oab, bphOff], 'void')).toEqual([]);

    // Enabling BPH adds exactly its three gateway questions — and does NOT disturb core.
    expect(ids(composeCore([oab, bph], 'void'))).toEqual(['urgency']);
    expect(ids(composeGateway([oab, bph], 'void'))).toEqual([
      'stream',
      'hesitancy',
      'incompleteEmptying',
    ]);
  });

  it('D14: two modules on the same surface compose without collision', () => {
    const core = composeCore([oab, emptying], 'void');
    expect(new Set(ids(core))).toEqual(new Set(['urgency', 'emptying']));
    expect(core).toHaveLength(2);
  });

  it('D15: core respects the budget of 2 and priority order; overflow falls to the gateway', () => {
    const a: TrackingModule = { id: 'a', enabled: true, eventTypes: [], questions: [q('a', 'void', true, 10)] };
    const b: TrackingModule = { id: 'b', enabled: true, eventTypes: [], questions: [q('b', 'void', true, 30)] };
    const c: TrackingModule = { id: 'c', enabled: true, eventTypes: [], questions: [q('c', 'void', true, 20)] };

    expect(CORE_BUDGET).toBe(2);
    expect(ids(composeCore([a, b, c], 'void'))).toEqual(['b', 'c']); // highest priority first
    expect(ids(composeGateway([a, b, c], 'void'))).toEqual(['a']); // the overflow
  });

  it('D16: enuresis-only void core is empty (pure tap); BPH+OAB core is non-empty within budget', () => {
    expect(composeCore([enuresis], 'void')).toEqual([]); // pure tap

    const core = composeCore([bph, oab], 'void');
    expect(core.length).toBeGreaterThan(0);
    expect(core.length).toBeLessThanOrEqual(CORE_BUDGET);
    expect(ids(core)).toEqual(['urgency']); // BPH cluster stays in the gateway
  });

  it('D17: a question owned by two enabled modules appears once (dedup by question.id)', () => {
    const core = composeCore([nocturia, ipss], 'morning');
    expect(ids(core)).toEqual(['nocturiaCount']);

    // Exactly one occurrence across the whole surface (core + gateway).
    const all = [...core, ...composeGateway([nocturia, ipss], 'morning')];
    expect(all.filter((x) => x.id === 'nocturiaCount')).toHaveLength(1);
  });
});
