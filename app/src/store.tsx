import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  composeCore,
  composeGateway,
  buildTrendReport,
  buildMeasuredDayReport,
  nocturiaCount,
  type Surface,
  type TrackingModule,
  type VoidEvent,
  type SleepPeriod,
  type DayVoids,
  type MeasuredDayReport,
  type TrendReport,
} from '@core';
import { MODULES, DEFAULT_DRY_WEIGHTS, DEFAULT_DRINK_NAMES, type AppQuestion, type ModuleDef } from './modules';
import type { Units } from './units';
import { cloudEnabled, onAuth, db, signInWithGoogle, signOutUser, completeMagicLink } from './firebase';

/** Fields that persist to Firestore (everything except transient UI/auth state). */
const PERSIST_KEYS = ['onboarded', 'enabledModules', 'traits', 'products', 'drinkTypes', 'units', 'entries'] as const;
export interface AppUser {
  uid: string;
  name: string | null;
  email: string | null;
}

export type Screen = 'onboarding' | 'home' | 'void' | 'leak' | 'change' | 'drink' | 'morning' | 'report' | 'chart' | 'detail' | 'settings' | 'signin';

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
/** A protection change: urine that went into the product, not the toilet. Carries a
 * volume (usually weighed) but is NOT a bathroom trip, so it never adds to nocturia. */
export interface ChangeEntry {
  kind: 'change';
  id: string;
  at: number;
  productId: string | null;
  volumeMl: number | null;
  answers: Record<string, string>;
}
/** A drink — fluid intake, the input side of the frequency-volume chart. */
export interface DrinkEntry {
  kind: 'drink';
  id: string;
  at: number;
  type: string;
  volumeMl: number | null;
}
export type LogEntry = VoidEntry | LeakEntry | NightEntry | ChangeEntry | DrinkEntry;

/** A protection product in the user's library — a trait, set rarely (spec §6.5). */
export interface Product {
  id: string;
  name: string;
  dryGrams: number;
  /** The absorbency tier it was created from (for dedup + default weight). */
  tier?: string;
}

interface State {
  onboarded: boolean;
  enabledModules: string[];
  traits: Record<string, string>;
  products: Product[];
  /** Drink types offered when logging fluid — user-pruned in Settings. */
  drinkTypes: string[];
  /** Display/input units for volumes. Storage is always ml. */
  units: Units;
  entries: LogEntry[];
  measuredDay: boolean;
  screen: Screen;
  /** Which drill-down the detail screen is showing. */
  detail: string | null;
  /** Signed-in user, or null in guest/local mode. */
  user: AppUser | null;
  /** True once the initial auth check has completed (avoids an onboarding flash). */
  authReady: boolean;
}

interface Store extends State {
  navigate: (s: Screen) => void;
  openDetail: (key: string) => void;
  signIn: () => void;
  signOut: () => void;
  completeOnboarding: (modules: string[], traits: Record<string, string>, productTiers: string[]) => void;
  logVoid: (v: { volumeMl: number | null; answers: Record<string, string>; at?: number }) => void;
  logLeak: (answers: Record<string, string>, at?: number) => void;
  logChange: (c: { productId: string | null; volumeMl: number | null; answers: Record<string, string>; at?: number }) => void;
  logDrink: (d: { type: string; volumeMl: number | null; at?: number }) => void;
  removeDrinkType: (name: string) => void;
  addDrinkType: (name: string) => void;
  setUnits: (u: Units) => void;
  logNight: (n: Omit<NightEntry, 'kind' | 'id' | 'nightId'>) => void;
  setMeasuredDay: (on: boolean) => void;
  addProduct: (name: string, dryGrams: number, tier?: string) => void;
  updateProduct: (id: string, patch: { name?: string; dryGrams?: number }) => void;
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
  // Empty by default — weighing only applies to people who use protection, so the
  // library (and the "weigh a product" option) stays hidden until they add one.
  products: [],
  drinkTypes: DEFAULT_DRINK_NAMES,
  units: 'oz', // freedom units by default; toggle in Settings
  entries: [],
  measuredDay: false,
  screen: 'onboarding',
  detail: null,
  user: null,
  authReady: false,
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
  const hydrating = useRef(false);

  // Auth: subscribe once. On sign-in, load the user's cloud doc (or seed it from the
  // current local state on first sign-in). In guest mode, just mark auth ready.
  useEffect(() => {
    if (!cloudEnabled) {
      setState((s) => ({ ...s, authReady: true }));
      return;
    }
    // If this page load is a magic-link redirect, finish sign-in (then onAuth fires).
    void completeMagicLink().catch(() => {});
    return onAuth(async (u) => {
      if (!u || !db) {
        setState((s) => ({ ...s, user: null, authReady: true }));
        return;
      }
      hydrating.current = true;
      let data: Record<string, unknown> | null = null;
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
      } catch { /* offline or rules-denied — treat as empty; never fall back to prior state */ }
      setState(() => {
        // SECURITY (multi-tenant): every signed-in session starts from clean defaults —
        // never the previous session's state — so one user can NEVER see another's data
        // (or their own guest data). Only this user's own cloud doc populates it.
        const next: State = { ...initial, user: { uid: u.uid, name: u.displayName, email: u.email }, authReady: true };
        if (data) {
          for (const k of PERSIST_KEYS) {
            if (data[k] !== undefined) (next as Record<string, unknown>)[k] = data[k];
          }
        }
        next.screen = next.onboarded ? 'home' : 'onboarding';
        return next;
      });
      hydrating.current = false;
    });
  }, []);

  // Persist to Firestore (debounced) whenever a persisted field changes while signed in.
  useEffect(() => {
    if (!cloudEnabled || !db || !state.user || hydrating.current) return;
    const snapshot = Object.fromEntries(PERSIST_KEYS.map((k) => [k, state[k]]));
    const ref = doc(db, 'users', state.user.uid);
    const t = setTimeout(() => { setDoc(ref, snapshot, { merge: true }).catch(() => {}); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user, state.onboarded, state.enabledModules, state.traits, state.products, state.drinkTypes, state.units, state.entries]);

  const store = useMemo<Store>(() => {
    const voids = state.entries.filter((e): e is VoidEntry => e.kind === 'void');
    const nights = state.entries.filter((e): e is NightEntry => e.kind === 'night');
    const changes = state.entries.filter((e): e is ChangeEntry => e.kind === 'change');
    const coreVoids: VoidEvent[] = voids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));
    // Changed products carry real urine volume but are not bathroom trips.
    const changeVoids: VoidEvent[] = changes.map((c) => ({ id: c.id, at: c.at, volumeMl: c.volumeMl }));
    const volumeEvents = [...coreVoids, ...changeVoids];

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
      state.measuredDay && latestSleep && volumeEvents.length
        ? // NUV/NPi include absorbed volume; nocturia counts actual voids only.
          { ...buildMeasuredDayReport(volumeEvents, latestSleep), nocturiaEpisodes: nocturiaCount(coreVoids, latestSleep) }
        : null;

    return {
      ...state,
      navigate: (screen) => setState((s) => ({ ...s, screen })),
      openDetail: (key) => setState((s) => ({ ...s, screen: 'detail', detail: key })),
      signIn: () => { void signInWithGoogle().catch(() => {}); },
      // Sign out returns to a clean guest state so no data lingers on the shared device.
      signOut: () => { void signOutUser().finally(() => setState(() => ({ ...initial, authReady: true }))); },
      completeOnboarding: (modules, traits, productTiers) =>
        setState((s) => {
          // Auto-create a library product for each absorbency tier the user selected,
          // seeded with the tier's default weight; deduped by tier so re-running is safe.
          const have = new Set(s.products.map((p) => p.tier).filter(Boolean));
          const created: Product[] = [];
          for (const tier of productTiers) {
            if (!have.has(tier)) {
              created.push({ id: id(), name: tier, dryGrams: DEFAULT_DRY_WEIGHTS[tier] ?? 0, tier });
              have.add(tier);
            }
          }
          return { ...s, onboarded: true, enabledModules: modules, traits, products: [...s.products, ...created], screen: 'home' };
        }),
      logVoid: ({ volumeMl, answers, at }) =>
        setState((s) => ({ ...s, entries: [...s.entries, { kind: 'void', id: id(), at: at ?? Date.now(), volumeMl, answers }] })),
      logLeak: (answers, at) =>
        setState((s) => ({ ...s, entries: [...s.entries, { kind: 'leak', id: id(), at: at ?? Date.now(), answers }] })),
      logChange: ({ productId, volumeMl, answers, at }) =>
        setState((s) => ({ ...s, entries: [...s.entries, { kind: 'change', id: id(), at: at ?? Date.now(), productId, volumeMl, answers }] })),
      logDrink: ({ type, volumeMl, at }) =>
        setState((s) => ({ ...s, entries: [...s.entries, { kind: 'drink', id: id(), at: at ?? Date.now(), type, volumeMl }] })),
      removeDrinkType: (name) => setState((s) => ({ ...s, drinkTypes: s.drinkTypes.filter((t) => t !== name) })),
      addDrinkType: (name) => setState((s) => (s.drinkTypes.includes(name) ? s : { ...s, drinkTypes: [...s.drinkTypes, name] })),
      setUnits: (u) => setState((s) => ({ ...s, units: u })),
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
      addProduct: (name, dryGrams, tier) =>
        setState((s) => ({ ...s, products: [...s.products, { id: id(), name, dryGrams, tier }] })),
      updateProduct: (pid, patch) =>
        setState((s) => ({ ...s, products: s.products.map((p) => (p.id === pid ? { ...p, ...patch } : p)) })),
      removeProduct: (pid) => setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== pid) })),
      // Re-run onboarding: back to the setup flow, keeping logged events (spec §7.1).
      rerunOnboarding: () => setState((s) => ({ ...s, onboarded: false })),
      loadSample: () =>
        setState((s) => {
          // ~3 weeks of realistic data: measured on ~1 day in 3 (volumes present),
          // partial otherwise; occasional missed night and leaks — so the reports and
          // the data-quality flag have something honest to chew on.
          const H = 3_600_000, DAY = 86_400_000, MIN = 60_000;
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const base = midnight.getTime();
          const rota = ['Water', 'Water', 'Soda', 'Water', 'Juice', 'Water'];
          const out: LogEntry[] = [];
          const N = 18;
          for (let i = N - 1; i >= 0; i--) {
            const day0 = base - i * DAY;
            const rising = day0 + 7 * H + (i % 3) * 20 * MIN;
            const bedtime = day0 - 1 * H - (i % 2) * 30 * MIN; // ~22:30–23:00 the night before
            const measured = i % 3 === 0;
            const hasNight = i % 5 !== 4; // occasional missed morning check-in
            const nNoct = i % 3 === 1 ? 2 : 1;
            const vol = (b: number) => (measured ? b : null);

            out.push({ kind: 'void', id: id(), at: bedtime - 20 * MIN, volumeMl: vol(300), answers: {} }); // pre-sleep
            for (let k = 0; k < nNoct; k++) out.push({ kind: 'void', id: id(), at: bedtime + (2 + k * 2.5) * H, volumeMl: vol(210 - k * 20), answers: {} });
            const fm = vol(280);
            out.push({ kind: 'void', id: id(), at: rising + 10 * MIN, volumeMl: fm, answers: { firstMorning: 'yes' } });
            for (const t of [9, 11, 13, 15, 18, 20]) out.push({ kind: 'void', id: id(), at: day0 + t * H + (i % 7) * MIN, volumeMl: vol(220 + (t % 3) * 30), answers: {} });
            let di = 0;
            for (const t of [7, 10, 12, 15, 18, 20]) { out.push({ kind: 'drink', id: id(), at: day0 + t * H, type: rota[(i + di) % rota.length] ?? 'Water', volumeMl: 355 }); di++; }
            // Mostly wet, occasionally dry — realistic for someone in overnight briefs.
            const wetDry = ['Wet', 'Soaked', 'Damp', 'Wet', 'Dry', 'Soaked'][i % 6]!;
            const isWet = wetDry !== 'Dry';
            if (hasNight) out.push({ kind: 'night', id: id(), nightId: dayKey(bedtime), bedtime, rising, firstVoidVolumeMl: fm, answers: { howWasNight: nNoct > 1 ? 'Woke several times' : 'Woke to pee', wetDry, nightVoids: String(nNoct) } });
            // On wet nights, a weighed overnight change — urine into the brief, not the toilet.
            if (isWet) out.push({ kind: 'change', id: id(), at: rising + 5 * MIN, productId: null, volumeMl: 260 + (i % 4) * 60, answers: { fullness: wetDry === 'Soaked' ? 'Saturated' : 'Heavy' } });
            if (i % 4 === 0) out.push({ kind: 'leak', id: id(), at: day0 + 14 * H, answers: { leakSeverity: 'Damp', leakTrigger: i % 8 === 0 ? 'Cough / lift' : 'Urge' } });
          }
          return { ...s, entries: [...s.entries, ...out], measuredDay: true };
        }),
      // Clear all diary data but stay signed in (persisted → also clears the cloud doc).
      reset: () => setState((s) => ({ ...initial, user: s.user, authReady: true })),
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
