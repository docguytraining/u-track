import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  composeCore,
  composeGateway,
  buildTrendReport,
  buildMeasuredDayReport,
  mergeOnSignIn,
  nocturiaCount,
  type Surface,
  type TrackingModule,
  type VoidEvent,
  type SleepPeriod,
  type DayVoids,
  type MeasuredDayReport,
  type TrendReport,
} from '@core';
import { MODULES, DEFAULT_DRY_WEIGHTS, USAGE_BY_TIER, DEFAULT_DRINK_NAMES, type AppQuestion, type ModuleDef } from './modules';
import type { Units } from './units';
import { cloudEnabled, onAuth, db, signInWithGoogle, signOutUser, completeMagicLink } from './firebase';
import { loadLocalDiary, saveLocalDiary, clearLocalDiary } from './localstore';

/** Fields that persist to Firestore (everything except transient UI/auth state). */
const PERSIST_KEYS = ['onboarded', 'enabledModules', 'traits', 'products', 'drinkTypes', 'units', 'entries', 'checkins', 'meds'] as const;
type Persisted = Pick<State, (typeof PERSIST_KEYS)[number]>;
const pickPersisted = (o: State): Persisted =>
  Object.fromEntries(PERSIST_KEYS.map((k) => [k, o[k]])) as Persisted;

/**
 * Adopt a persisted-field payload (a cloud doc, a restore file, or the on-device guest blob)
 * onto a base state, validating each field's type first. A hand-edited or hostile backup — or
 * a corrupted localStorage entry — can set a field to the wrong shape (e.g. `products` as a
 * number); copying it verbatim would crash the screens that map over it, and the corruption
 * would then sync to the cloud and survive reload. Anything malformed is dropped, keeping the
 * base value. Entries are normalized to the current model (older data may predate it).
 */
export function applyPersisted(base: State, data: Record<string, unknown>): State {
  const next: State = { ...base };
  const strArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
  const objArr = (v: unknown): v is Record<string, unknown>[] => Array.isArray(v) && v.every((x) => !!x && typeof x === 'object' && !Array.isArray(x));
  if (typeof data.onboarded === 'boolean') next.onboarded = data.onboarded;
  if (strArr(data.enabledModules)) next.enabledModules = data.enabledModules;
  if (data.traits && typeof data.traits === 'object' && !Array.isArray(data.traits)) next.traits = data.traits as Record<string, string>;
  if (objArr(data.products)) next.products = data.products as unknown as Product[];
  if (strArr(data.drinkTypes)) next.drinkTypes = data.drinkTypes;
  if (data.units === 'ml' || data.units === 'oz') next.units = data.units;
  if (objArr(data.checkins)) next.checkins = data.checkins as unknown as CheckIn[];
  if (objArr(data.meds)) next.meds = data.meds as unknown as Med[];
  next.entries = normalizeEntries(Array.isArray(data.entries) ? (data.entries as unknown[]) : base.entries);
  return next;
}
export interface AppUser {
  uid: string;
  name: string | null;
  email: string | null;
}

export type Screen = 'onboarding' | 'home' | 'log' | 'void' | 'leak' | 'change' | 'drink' | 'morning' | 'checkin' | 'report' | 'chart' | 'detail' | 'settings' | 'signin';

/** A weekly quality-of-life check-in — the "how much is this affecting you" side of a
 * clinical questionnaire, tracked over time. Two 0–10 scales, kept apart from `entries`. */
export interface CheckIn {
  id: string;
  at: number;
  /** Interference with day-to-day activities, 0 (not at all) – 10 (a great deal). */
  interference: number;
  /** How much it bothered you, 0–10. */
  bother: number;
}

/** When during the day a medication is usually taken. Timing is the point clinically:
 * an evening or bedtime diuretic can look exactly like nocturia on the chart, so a
 * provider reading the export wants the medication list next to the night numbers. */
export type MedTiming = 'Morning' | 'Midday' | 'Evening' | 'Bedtime' | 'As needed';
export const MED_TIMINGS: MedTiming[] = ['Morning', 'Midday', 'Evening', 'Bedtime', 'As needed'];

/** A medication the person takes — context for reading the diary, not a dosing log.
 * We record only the name and when it's taken; the app never judges or advises on it. */
export interface Med {
  id: string;
  name: string;
  timing: MedTiming;
}

/**
 * A void — one bladder emptying, the umbrella for everything. Two orthogonal facts
 * describe what happened to it:
 *  - `where`  — where it ended up: toilet / product / both, or null for a pure escape
 *               (the "Leak" fast-log: it reached no toilet and no logged product).
 *  - `leaked` — did any escape onto clothing/skin/bed. Independent of `where`: you can
 *               leak on the way to the toilet, through a product, or with nothing on.
 * Size can be a measured volume (`volumeMl`, jug or weighed — feeds the capacity/NPi math)
 * or, when you can't measure (e.g. into a product), a perceived `size` that is descriptive
 * only and never summed into the volume math.
 */
export type VoidWhere = 'toilet' | 'product' | 'both' | null;
export interface VoidEntry {
  kind: 'void';
  id: string;
  at: number;
  where: VoidWhere;
  leaked: boolean;
  volumeMl: number | null;
  size: string | null;
  productId: string | null;
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
export type LogEntry = VoidEntry | NightEntry | ChangeEntry | DrinkEntry;

/**
 * Bring persisted entries up to the current shape. Older data used separate `leak` and
 * `wetting` event kinds and voids without `where`/`leaked`; all of them normalize into the
 * unified void so a returning user's history survives the model change.
 */
export function normalizeEntries(raw: readonly unknown[]): LogEntry[] {
  const out: LogEntry[] = [];
  for (const item of raw ?? []) {
    // Skip anything that isn't a real object — a null or primitive slipped in by a truncated
    // write or a hand-edited backup would otherwise throw on `e.at` and white-screen the app.
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const at = e.at as number;
    const answers = (e.answers as Record<string, string>) ?? {};
    if (e.kind === 'wetting') {
      out.push({ kind: 'void', id: e.id as string, at, where: 'product', leaked: false, volumeMl: null, size: null, productId: (e.productId as string | null) ?? null, answers });
    } else if (e.kind === 'leak') {
      out.push({ kind: 'void', id: e.id as string, at, where: null, leaked: true, volumeMl: null, size: null, productId: null, answers });
    } else if (e.kind === 'void') {
      out.push({
        kind: 'void', id: e.id as string, at,
        where: (e.where as VoidWhere) ?? 'toilet',
        leaked: (e.leaked as boolean) ?? false,
        volumeMl: (e.volumeMl as number | null) ?? null,
        size: (e.size as string | null) ?? null,
        productId: (e.productId as string | null) ?? null,
        answers,
      });
    } else {
      out.push(item as LogEntry);
    }
  }
  return out;
}

/** When a product is normally used — scopes the "which product?" pickers by context. */
export type ProductUsage = 'day' | 'night' | 'both';
/** A protection product in the user's library — a trait, set rarely (spec §6.5). */
export interface Product {
  id: string;
  name: string;
  dryGrams: number;
  /** The absorbency tier it was created from (for dedup + default weight). */
  tier?: string;
  /** Daytime / overnight / both — set by the user, defaults from the tier. */
  usage?: ProductUsage;
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
  checkins: CheckIn[];
  /** Medications the person takes, with timing — context for reading the night data. */
  meds: Med[];
  measuredDay: boolean;
  screen: Screen;
  /** Which drill-down the detail screen is showing. */
  detail: string | null;
  /** Signed-in user, or null in guest/local mode. */
  user: AppUser | null;
  /** True once the initial auth check has completed (avoids an onboarding flash). */
  authReady: boolean;
  /** A transient "saved" acknowledgement shown after logging; not persisted. */
  notice: string | null;
}

interface Store extends State {
  navigate: (s: Screen) => void;
  openDetail: (key: string) => void;
  /** Clear the transient save acknowledgement. */
  dismissNotice: () => void;
  signIn: () => void;
  signOut: () => void;
  completeOnboarding: (modules: string[], traits: Record<string, string>, productTiers: string[]) => void;
  logVoid: (v: { where?: VoidWhere; leaked?: boolean; volumeMl?: number | null; size?: string | null; productId?: string | null; answers: Record<string, string>; at?: number }) => void;
  logLeak: (answers: Record<string, string>, at?: number, opts?: { contained?: boolean; productId?: string | null }) => void;
  /** The unified single-button log: one event described by where it went + how much, from which
   * the void/leak distinction and continence are derived. `escaped` only applies to a product. */
  logEvent: (e: { where: 'toilet' | 'product' | 'clothing'; size: string | null; escaped?: boolean; volumeMl?: number | null; productId?: string | null; answers?: Record<string, string>; at?: number }) => void;
  logChange: (c: { productId: string | null; volumeMl: number | null; answers: Record<string, string>; at?: number }) => void;
  logDrink: (d: { type: string; volumeMl: number | null; at?: number }) => void;
  logCheckin: (c: { interference: number; bother: number }) => void;
  addMed: (name: string, timing: MedTiming) => void;
  removeMed: (id: string) => void;
  /** Remove a logged entry by id — for something recorded by accident. */
  deleteEntry: (id: string) => void;
  /** Put a just-deleted entry back (for undo), keeping its original time-order. */
  restoreEntry: (entry: LogEntry) => void;
  removeDrinkType: (name: string) => void;
  addDrinkType: (name: string) => void;
  setUnits: (u: Units) => void;
  logNight: (n: Omit<NightEntry, 'kind' | 'id' | 'nightId'>) => void;
  setMeasuredDay: (on: boolean) => void;
  addProduct: (name: string, dryGrams: number, tier?: string, usage?: ProductUsage) => void;
  updateProduct: (id: string, patch: { name?: string; dryGrams?: number; usage?: ProductUsage }) => void;
  removeProduct: (id: string) => void;
  loadSample: () => void;
  /** Replace all diary data from a backup file's `data` payload (migrating old entries). */
  restoreBackup: (data: Record<string, unknown>) => void;
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
  checkins: [],
  meds: [],
  measuredDay: false,
  screen: 'onboarding',
  detail: null,
  user: null,
  authReady: false,
  notice: null,
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

/** First render state: a returning guest's on-device diary if present, else the empty start.
 * If a signed-in user exists, onAuth will hydrate from the cloud and supersede this. */
function bootstrap(): State {
  const local = loadLocalDiary();
  if (!local) return initial;
  try {
    const s = applyPersisted(initial, local);
    // A returning guest who already onboarded should land on Home, not the setup flow.
    return { ...s, screen: s.onboarded ? 'home' : 'onboarding' };
  } catch {
    // bootstrap() runs inside render (useState initializer); if a corrupt blob slips past the
    // field guards and throws, drop it rather than white-screen on every reload with no way out.
    clearLocalDiary();
    return initial;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(bootstrap);
  const hydrating = useRef(false);
  // Set while a cloud sign-out is in flight (until the reload wipes everything). Firebase's
  // signOut fires onAuth(null), which leaves the ex-user's entries in memory with user===null —
  // without this guard the guest-save effect would write that diary back to the shared local
  // key, racing the reload and re-creating the exact shared-device leak sign-out prevents.
  const signingOut = useRef(false);

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
      setState((s) => {
        // Tested policy (core/sync/mergeOnSignIn): first sign-in migrates local data;
        // a returning account loads only its own cloud doc — never a prior session.
        // Migrate a returning account's entries (old leak/wetting kinds → unified void).
        const cloud = data ? ({ ...data, entries: normalizeEntries((data.entries as unknown[]) ?? []) } as Partial<Persisted>) : null;
        const merged = mergeOnSignIn(pickPersisted(initial), pickPersisted(s), cloud);
        const next: State = { ...initial, ...merged, user: { uid: u.uid, name: u.displayName, email: u.email }, authReady: true };
        next.screen = next.onboarded ? 'home' : 'onboarding';
        return next;
      });
      hydrating.current = false;
      // The guest blob (if any) has now been migrated into this account's cloud doc on first
      // sign-in, or superseded by it on a returning account. Either way the on-device copy is
      // stale and must not linger for the next person on a shared device — clear it.
      clearLocalDiary();
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
  }, [state.user, state.onboarded, state.enabledModules, state.traits, state.products, state.drinkTypes, state.units, state.entries, state.checkins, state.meds]);

  // Persist to this device (debounced) whenever a persisted field changes while signed out.
  // This is what makes "no account needed" durable: a guest's diary survives reload and the
  // OS reclaiming an installed PWA. Signed-in data goes to the cloud instead (effect above),
  // and is cleared from here on sign-in, so the two never both own the same diary.
  useEffect(() => {
    if (state.user || !state.authReady || hydrating.current || signingOut.current) return;
    const snapshot = Object.fromEntries(PERSIST_KEYS.map((k) => [k, state[k]]));
    const t = setTimeout(() => saveLocalDiary(snapshot), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user, state.authReady, state.onboarded, state.enabledModules, state.traits, state.products, state.drinkTypes, state.units, state.entries, state.checkins, state.meds]);

  const store = useMemo<Store>(() => {
    const voids = state.entries.filter((e): e is VoidEntry => e.kind === 'void');
    const nights = state.entries.filter((e): e is NightEntry => e.kind === 'night');
    const changes = state.entries.filter((e): e is ChangeEntry => e.kind === 'change');
    // Only voids that reached the toilet are bathroom trips — they alone feed capacity,
    // nocturia and NUV. Product/leak voids count toward frequency but not these.
    const toiletVoids = voids.filter((v) => v.where === 'toilet' || v.where === 'both');
    const coreVoids: VoidEvent[] = toiletVoids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));
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
      // signOutUser wipes the on-disk Firestore cache and terminates the DB, so when cloud is
      // active we reload to re-init a fresh instance; local-only mode just resets in place.
      signOut: () => {
        clearLocalDiary();
        // Cloud path reloads after wiping caches; block the guest-save effect from re-persisting
        // the ex-user's in-memory diary in the window before that reload. (Local-only mode has no
        // reload, so it must keep saving — don't set the guard there.)
        if (cloudEnabled && typeof window !== 'undefined') signingOut.current = true;
        void signOutUser().finally(() => {
          if (cloudEnabled && typeof window !== 'undefined') window.location.reload();
          else setState(() => ({ ...initial, authReady: true }));
        });
      },
      completeOnboarding: (modules, traits, productTiers) =>
        setState((s) => {
          // Auto-create a library product for each absorbency tier the user selected,
          // seeded with the tier's default weight; deduped by tier so re-running is safe.
          const have = new Set(s.products.map((p) => p.tier).filter(Boolean));
          const created: Product[] = [];
          for (const tier of productTiers) {
            if (!have.has(tier)) {
              created.push({ id: id(), name: tier, dryGrams: DEFAULT_DRY_WEIGHTS[tier] ?? 0, tier, usage: USAGE_BY_TIER[tier] ?? 'both' });
              have.add(tier);
            }
          }
          return { ...s, onboarded: true, enabledModules: modules, traits, products: [...s.products, ...created], screen: 'home' };
        }),
      logVoid: ({ where = 'toilet', leaked = false, volumeMl = null, size = null, productId = null, answers, at }) =>
        setState((s) => ({ ...s, notice: 'Void logged', entries: [...s.entries, { kind: 'void', id: id(), at: at ?? Date.now(), where, leaked, volumeMl, size, productId, answers }] })),
      // The Leak fast-log: a void that escaped, reaching no toilet and no logged product.
      // A leak is an involuntary loss; containment is just an attribute. If the product caught
      // it, that's where='product', leaked=false (a contained episode — the same shape a "void
      // into product" produces); if it reached clothing/bed, where=null, leaked=true. Either way
      // the user logged a leak from the leak screen — no detour to the void screen.
      logLeak: (answers, at, opts) =>
        setState((s) => ({
          ...s,
          notice: 'Leak logged',
          entries: [...s.entries, {
            kind: 'void', id: id(), at: at ?? Date.now(),
            where: opts?.contained ? 'product' : null,
            leaked: !opts?.contained,
            volumeMl: null, size: null,
            productId: opts?.contained ? (opts.productId ?? null) : null,
            answers,
          }],
        })),
      // Translate the unified event into the stored void record. Continence is where it went:
      // toilet = a continent void (may carry a measured volume on a 24-hour check); into product
      // or onto clothing = an involuntary loss (a leak), with `leaked` marking whether it escaped
      // containment. "Void" vs "leak" is never stored — it's read back off `where`/`leaked`.
      logEvent: ({ where, size, escaped = false, volumeMl = null, productId = null, answers = {}, at }) =>
        setState((s) => ({
          ...s,
          notice: where === 'toilet' ? 'Void logged' : 'Leak logged',
          entries: [...s.entries, {
            kind: 'void', id: id(), at: at ?? Date.now(),
            where: where === 'clothing' ? null : where,
            leaked: where === 'clothing' ? true : where === 'product' ? escaped : false,
            // Measured volume is a 24-hour-check thing and only applies to a toilet void; the
            // qualitative size is kept for every event (it's what estimates volume off-check).
            volumeMl: where === 'toilet' ? volumeMl : null,
            size,
            productId: where === 'product' ? productId : null,
            answers,
          }],
        })),
      logChange: ({ productId, volumeMl, answers, at }) =>
        setState((s) => ({ ...s, notice: 'Change logged', entries: [...s.entries, { kind: 'change', id: id(), at: at ?? Date.now(), productId, volumeMl, answers }] })),
      logDrink: ({ type, volumeMl, at }) =>
        setState((s) => ({ ...s, notice: 'Drink logged', entries: [...s.entries, { kind: 'drink', id: id(), at: at ?? Date.now(), type, volumeMl }] })),
      logCheckin: ({ interference, bother }) =>
        setState((s) => ({ ...s, notice: 'Check-in saved', checkins: [...s.checkins, { id: id(), at: Date.now(), interference, bother }] })),
      dismissNotice: () => setState((s) => (s.notice == null ? s : { ...s, notice: null })),
      addMed: (name, timing) =>
        setState((s) => ({ ...s, meds: [...s.meds, { id: id(), name, timing }] })),
      removeMed: (mid) => setState((s) => ({ ...s, meds: s.meds.filter((m) => m.id !== mid) })),
      deleteEntry: (eid) => setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== eid) })),
      restoreEntry: (entry) =>
        setState((s) => (s.entries.some((e) => e.id === entry.id) ? s : { ...s, entries: [...s.entries, entry] })),
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
              ? [{ kind: 'void', id: id(), at: n.rising + 10 * 60_000, where: 'toilet', leaked: false, volumeMl: n.firstVoidVolumeMl, size: null, productId: null, answers: { firstMorning: 'yes' } }]
              : [];
          return { ...s, notice: 'Morning check-in saved', entries: [...s.entries, night, ...firstVoid] };
        }),
      setMeasuredDay: (on) => setState((s) => ({ ...s, measuredDay: on })),
      addProduct: (name, dryGrams, tier, usage) =>
        setState((s) => ({ ...s, products: [...s.products, { id: id(), name, dryGrams, tier, usage }] })),
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

            // A void that reached the toilet — the bathroom trips that carry volume.
            const tvoid = (at: number, volumeMl: number | null, answers: Record<string, string> = {}): LogEntry =>
              ({ kind: 'void', id: id(), at, where: 'toilet', leaked: false, volumeMl, size: null, productId: null, answers });

            out.push(tvoid(bedtime - 20 * MIN, vol(300))); // pre-sleep
            for (let k = 0; k < nNoct; k++) out.push(tvoid(bedtime + (2 + k * 2.5) * H, vol(210 - k * 20)));
            const fm = vol(280);
            out.push(tvoid(rising + 10 * MIN, fm, { firstMorning: 'yes' }));
            for (const t of [9, 11, 13, 15, 18, 20]) out.push(tvoid(day0 + t * H + (i % 7) * MIN, vol(220 + (t % 3) * 30)));
            let di = 0;
            for (const t of [7, 10, 12, 15, 18, 20]) { out.push({ kind: 'drink', id: id(), at: day0 + t * H, type: rota[(i + di) % rota.length] ?? 'Water', volumeMl: 355 }); di++; }
            // Mostly wet, occasionally dry — realistic for someone in overnight briefs.
            const wetDry = ['Wet', 'Soaked', 'Damp', 'Wet', 'Dry', 'Soaked'][i % 6]!;
            const isWet = wetDry !== 'Dry';
            if (hasNight) out.push({ kind: 'night', id: id(), nightId: dayKey(bedtime), bedtime, rising, firstVoidVolumeMl: fm, answers: { howWasNight: nNoct > 1 ? 'Woke several times' : 'Woke to pee', wetDry, nightVoids: String(nNoct) } });
            // On wet nights, a weighed overnight change — urine into the brief, not the toilet.
            if (isWet) out.push({ kind: 'change', id: id(), at: rising + 5 * MIN, productId: null, volumeMl: 260 + (i % 4) * 60, answers: { fullness: wetDry === 'Soaked' ? 'Saturated' : 'Heavy' } });
            // Daytime voids into the product (no change) — these feed voiding frequency, not
            // volume; the perceived size is descriptive only.
            if (isWet) {
              out.push({ kind: 'void', id: id(), at: day0 + 10 * H + (i % 5) * MIN, where: 'product', leaked: false, volumeMl: null, size: 'Small', productId: null, answers: { leakSeverity: 'Damp', leakTrigger: 'Unsure' } });
              if (i % 2 === 0) out.push({ kind: 'void', id: id(), at: day0 + 16 * H, where: 'product', leaked: false, volumeMl: null, size: 'Medium', productId: null, answers: { leakSeverity: 'Moderate', leakTrigger: 'Urge' } });
            }
            // An occasional escape (leak) — reached no toilet, no containment.
            if (i % 4 === 0) out.push({ kind: 'void', id: id(), at: day0 + 14 * H, where: null, leaked: true, volumeMl: null, size: null, productId: null, answers: { leakSeverity: 'Damp', leakTrigger: i % 8 === 0 ? 'Cough / lift' : 'Urge' } });
          }
          return { ...s, entries: [...s.entries, ...out], measuredDay: true };
        }),
      // Clear all diary data but stay signed in (persisted → also clears the cloud doc).
      // For a guest, also drop the on-device copy immediately.
      reset: () => { clearLocalDiary(); setState((s) => ({ ...initial, user: s.user, authReady: true })); },
      restoreBackup: (data) => setState((s) => applyPersisted(s, data)),
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
