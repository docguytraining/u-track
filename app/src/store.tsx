import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  composeCore,
  composeGateway,
  buildTrendReport,
  buildMeasuredDayReport,
  type Surface,
  type TrackingModule,
  type VoidEvent,
  type SleepPeriod,
  type DayVoids,
  type MeasuredDayReport,
  type TrendReport,
} from '@core';
import { MODULES, type AppQuestion, type ModuleDef } from './modules';

export type Screen = 'onboarding' | 'home' | 'void' | 'leak' | 'morning' | 'report' | 'detail' | 'settings';

export interface VoidEntry {
  kind: 'void';
  id: string;
  at: number;
  volumeMl: number | null;
  answers: Record<string, string>;
}
export interface LeakEntry {
  kind: 'leak';
  id: string;
  at: number;
  answers: Record<string, string>;
}
export interface NightEntry {
  kind: 'night';
  id: string;
  nightId: string;
  bedtime: number;
  rising: number;
  firstVoidVolumeMl: number | null;
  answers: Record<string, string>;
}
export type LogEntry = VoidEntry | LeakEntry | NightEntry;

/** A protection product in the user's library — a trait, set rarely (spec §6.5). */
export interface Product {
  id: string;
  name: string;
  dryGrams: number;
}

interface State {
  onboarded: boolean;
  enabledModules: string[];
  traits: Record<string, string>;
  products: Product[];
  entries: LogEntry[];
  measuredDay: boolean;
  screen: Screen;
  /** Which drill-down the detail screen is showing. */
  detail: string | null;
}

interface Store extends State {
  navigate: (s: Screen) => void;
  openDetail: (key: string) => void;
  completeOnboarding: (modules: string[], traits: Record<string, string>) => void;
  logVoid: (v: { volumeMl: number | null; answers: Record<string, string> }) => void;
  logLeak: (answers: Record<string, string>) => void;
  logNight: (n: Omit<NightEntry, 'kind' | 'id' | 'nightId'>) => void;
  setMeasuredDay: (on: boolean) => void;
  addProduct: (name: string, dryGrams: number) => void;
  removeProduct: (id: string) => void;
  loadSample: () => void;
  rerunOnboarding: () => void;
  reset: () => void;
  enabledModuleDefs: ModuleDef[];
  coreQuestions: (surface: Surface) => AppQuestion[];
  gatewayQuestions: (surface: Surface) => AppQuestion[];
  reports: { trend: TrendReport; measured: MeasuredDayReport | null };
}

const Ctx = createContext<Store | null>(null);
export const useStore = (): Store => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
};

const initial: State = {
  onboarded: false,
  enabledModules: [],
  traits: {},
  // One sample product so the weigh-a-product path is usable immediately (§6.5 example).
  products: [{ id: 'p1', name: 'Overnight diaper', dryGrams: 62 }],
  entries: [],
  measuredDay: false,
  screen: 'onboarding',
  detail: null,
};

let seq = 0;
const id = (): string => `e${Date.now()}_${seq++}`;
const dayKey = (at: number): string => new Date(at).toLocaleDateString('en-CA'); // YYYY-MM-DD local

/** Build TrackingModules the core can compose from the enabled set. */
function trackingModules(enabled: string[]): TrackingModule[] {
  return enabled.map((mid) => ({
    id: mid,
    enabled: true,
    eventTypes: [],
    questions: MODULES[mid]?.questions ?? [],
  }));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);

  const store = useMemo<Store>(() => {
    const voids = state.entries.filter((e): e is VoidEntry => e.kind === 'void');
    const nights = state.entries.filter((e): e is NightEntry => e.kind === 'night');
    const coreVoids: VoidEvent[] = voids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));

    // Most recent logged night → the sleep period used for the measured-day report.
    const latestSleep: SleepPeriod | null = nights.length
      ? nights.reduce((a, b) => (b.rising > a.rising ? b : a))
      : null;

    // Group voids by the calendar day they occurred; attach a night's sleep to the
    // day it ends on. Enough to exercise buildTrendReport honestly in the prototype.
    const byDay = new Map<string, VoidEvent[]>();
    for (const v of coreVoids) {
      const k = dayKey(v.at);
      (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(v);
    }
    for (const n of nights) if (!byDay.has(dayKey(n.rising))) byDay.set(dayKey(n.rising), []);
    const days: DayVoids[] = [...byDay.entries()].map(([k, dv]) => {
      const night = nights.find((n) => dayKey(n.rising) === k);
      return night
        ? { nightId: k, voids: dv, sleep: { bedtime: night.bedtime, rising: night.rising } }
        : { nightId: k, voids: dv };
    });

    const measured =
      state.measuredDay && latestSleep && coreVoids.length
        ? buildMeasuredDayReport(coreVoids, latestSleep)
        : null;

    return {
      ...state,
      navigate: (screen) => setState((s) => ({ ...s, screen })),
      openDetail: (key) => setState((s) => ({ ...s, screen: 'detail', detail: key })),
      completeOnboarding: (modules, traits) =>
        setState((s) => ({ ...s, onboarded: true, enabledModules: modules, traits, screen: 'home' })),
      logVoid: ({ volumeMl, answers }) =>
        setState((s) => ({ ...s, entries: [...s.entries, { kind: 'void', id: id(), at: Date.now(), volumeMl, answers }] })),
      logLeak: (answers) =>
        setState((s) => ({ ...s, entries: [...s.entries, { kind: 'leak', id: id(), at: Date.now(), answers }] })),
      logNight: (n) =>
        setState((s) => {
          const night: NightEntry = { kind: 'night', id: id(), nightId: dayKey(n.bedtime), ...n };
          // The first-morning void is the single most informative volume — record it as
          // a real void just after rising so NUV/NPi can pick it up (spec §4, §7.6).
          const firstVoid: LogEntry[] =
            n.firstVoidVolumeMl != null
              ? [{ kind: 'void', id: id(), at: n.rising + 10 * 60_000, volumeMl: n.firstVoidVolumeMl, answers: { firstMorning: 'yes' } }]
              : [];
          return { ...s, entries: [...s.entries, night, ...firstVoid] };
        }),
      setMeasuredDay: (on) => setState((s) => ({ ...s, measuredDay: on })),
      addProduct: (name, dryGrams) =>
        setState((s) => ({ ...s, products: [...s.products, { id: id(), name, dryGrams }] })),
      removeProduct: (pid) => setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== pid) })),
      // Re-run onboarding: back to the setup flow, keeping logged events (spec §7.1).
      rerunOnboarding: () => setState((s) => ({ ...s, onboarded: false })),
      loadSample: () =>
        setState((s) => {
          // A realistic fully-measured night so the report is worth looking at without
          // waiting a real 24h: NUV 660 / 1500 → NPi 0.44, 2 nocturia episodes.
          const rising = new Date();
          rising.setHours(7, 0, 0, 0);
          const r = rising.getTime();
          const b = r - 8 * 3_600_000; // 23:00 the night before
          const H = 3_600_000;
          const sample: LogEntry[] = [
            { kind: 'void', id: id(), at: b - 15 * 60_000, volumeMl: 300, answers: {} }, // pre-sleep (excluded)
            { kind: 'void', id: id(), at: b + 2.5 * H, volumeMl: 220, answers: {} }, // nocturnal
            { kind: 'void', id: id(), at: b + 5.25 * H, volumeMl: 180, answers: {} }, // nocturnal
            { kind: 'void', id: id(), at: r + 10 * 60_000, volumeMl: 260, answers: { firstMorning: 'yes' } }, // first-morning
            { kind: 'void', id: id(), at: r + 5 * H, volumeMl: 300, answers: {} }, // daytime
            { kind: 'void', id: id(), at: r + 11 * H, volumeMl: 240, answers: {} }, // daytime
            {
              kind: 'night',
              id: id(),
              nightId: dayKey(b),
              bedtime: b,
              rising: r,
              firstVoidVolumeMl: 260,
              answers: { howWasNight: 'Woke several times', wetDry: 'Dry' },
            },
          ];
          return { ...s, entries: [...s.entries, ...sample], measuredDay: true };
        }),
      reset: () => setState({ ...initial }),
      enabledModuleDefs: state.enabledModules.map((m) => MODULES[m]).filter((m): m is ModuleDef => !!m),
      coreQuestions: (surface) =>
        composeCore(trackingModules(state.enabledModules), surface) as AppQuestion[],
      gatewayQuestions: (surface) =>
        composeGateway(trackingModules(state.enabledModules), surface) as AppQuestion[],
      reports: { trend: buildTrendReport(days), measured },
    };
  }, [state]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
