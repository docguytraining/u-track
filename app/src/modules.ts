import type { QuestionDef, Surface } from '@core';

/** A registry QuestionDef plus the UI copy needed to render it. */
export interface AppQuestion extends QuestionDef {
  prompt: string;
  options: string[];
}

export interface ModuleDef {
  id: string;
  label: string;
  blurb: string;
  /** Dashboard tile title shown when the module is enabled (spec §7.2). */
  widget?: string;
  questions: AppQuestion[];
}

const q = (
  id: string,
  surface: Surface,
  coreEligible: boolean,
  priority: number,
  prompt: string,
  options: string[],
): AppQuestion => ({ id, surface, coreEligible, priority, prompt, options });

/**
 * The module catalog. Each module contributes questions to event surfaces; the
 * core's composeCore/composeGateway decide which land on the fast path vs. the
 * "Track anything else?" gateway. Question wording is a draft (see onboarding.ts).
 */
export const MODULES: Record<string, ModuleDef> = {
  urgency: {
    id: 'urgency',
    label: 'Urgency',
    blurb: 'Sudden urges, trouble holding it',
    widget: 'Urgency pattern',
    questions: [q('urgency', 'void', true, 80, 'How strong was the urge?', ['None', 'Mild', 'Strong', 'Couldn’t wait'])],
  },
  bph: {
    id: 'bph',
    label: 'Emptying / BPH',
    blurb: 'Stream, straining, emptying',
    widget: 'Emptying check',
    questions: [
      q('stream', 'void', true, 60, 'Stream force?', ['Strong', 'Normal', 'Weak', 'Dribble']),
      q('hesitancy', 'void', false, 40, 'How long before it started?', ['Right away', 'A few seconds', 'Had to wait']),
      q('strainInit', 'void', false, 35, 'Strain to start?', ['No', 'A little', 'A lot']),
      q('strainHold', 'void', false, 34, 'Strain to keep it going?', ['No', 'A little', 'A lot']),
      q('intermittency', 'void', false, 30, 'Stops and starts?', ['No', 'Once or twice', 'A lot']),
      q('dribble', 'void', false, 25, 'After-dribble?', ['None', 'A little', 'A lot']),
      q('incomplete', 'void', false, 20, 'Feel empty afterward?', ['Empty', 'Unsure', 'Still full']),
    ],
  },
  leakage: {
    id: 'leakage',
    label: 'Leakage',
    blurb: 'Daytime leaks and triggers',
    widget: 'Leaks & triggers',
    questions: [
      q('leakSeverity', 'leak', true, 80, 'How much leaked?', ['Damp', 'Moderate', 'Soaked']),
      q('leakTrigger', 'leak', true, 70, 'What set it off?', ['Urge', 'Cough / sneeze', 'Laughing', 'Other', 'N/A']),
      // Sensation only — did you feel it happen? Urge vs stress is the trigger's job, so no
      // "urge" wording here (a cough leak has no urge). Point-in-time, so no "sometimes".
      q('leakAwareness', 'leak', false, 40, 'Did you feel it happen?', ['Felt it', 'Found out after', 'Unsure']),
    ],
  },
  nocturia: {
    id: 'nocturia',
    label: 'Nighttime urination',
    blurb: 'Waking at night to pee',
    widget: 'Night summary',
    questions: [
      q('howWasNight', 'morning', true, 90, 'How was your night?', ['Slept through', 'Woke to pee', 'Woke several times', 'Woke wet', 'Unsure']),
    ],
  },
  nightWetting: {
    id: 'nightWetting',
    label: 'Nighttime wetting',
    blurb: 'Wetting during sleep',
    widget: 'Wet nights',
    questions: [
      q('wetDry', 'morning', true, 85, 'Wet or dry this morning?', ['Dry', 'Damp', 'Wet', 'Soaked']),
      // Sensation, not arousal or blame: only shown on a wet night AND only when the
      // profile says awareness is reduced (see awarenessReduced) — the insensate signal.
      q('wetAwareness', 'morning', false, 50, 'Any warning before it happened?', ['Felt it coming', 'No warning — found out after', 'Not sure']),
    ],
  },
  protection: {
    id: 'protection',
    label: 'Protection',
    blurb: 'Pads, guards, diapers',
    widget: 'Protection use',
    // "Which protection overnight?" is asked from the user's own product library in the
    // morning check-in (scoped to overnight products), not as a fixed multiple-choice.
    questions: [],
  },
  awareness: {
    id: 'awareness',
    label: 'Bladder awareness',
    blurb: 'Warning time, sensation, control',
    widget: 'Bladder awareness',
    questions: [],
  },
};

export const MODULE_ORDER = ['nocturia', 'nightWetting', 'urgency', 'leakage', 'bph', 'protection', 'awareness'];

/**
 * Absorbency tiers with typical dry weights (grams). Used to auto-create library
 * entries when onboarding says you use protection; each product is then renameable
 * and reweighable in Settings. Weights are tier defaults, not exact product specs.
 */
type TierUsage = 'day' | 'night' | 'both';
export const PRODUCT_TIERS: { name: string; grams: number; usage: TierUsage }[] = [
  { name: 'Light guard / shield', grams: 20, usage: 'day' }, // Prevail Guard, Tena Men L1
  { name: 'Standard guard', grams: 40, usage: 'day' }, // Depend Guard, Tena Men L2/3
  { name: 'Daytime pull-up', grams: 60, usage: 'day' }, // Depend Real Fit, Tena Stretch
  { name: 'Overnight brief', grams: 100, usage: 'night' }, // Tranquility ATN, TENA Complete
  { name: 'Max-capacity brief', grams: 220, usage: 'night' }, // NorthShore MegaMax, BetterDry
];

export const DEFAULT_DRY_WEIGHTS: Record<string, number> = Object.fromEntries(
  PRODUCT_TIERS.map((t) => [t.name, t.grams]),
);
/** A product's default usage, inferred from the tier it was created from. */
export const USAGE_BY_TIER: Record<string, TierUsage> = Object.fromEntries(
  PRODUCT_TIERS.map((t) => [t.name, t.usage]),
);

/**
 * Drink types for fluid-intake logging (the input side of the frequency-volume
 * chart). Caffeine and alcohol are flagged because their timing drives nocturia.
 * The user prunes the list in Settings — no point asking about drinks you never have.
 */
export const DRINKS: { name: string; caffeine?: boolean; alcohol?: boolean }[] = [
  { name: 'Water' },
  { name: 'Coffee', caffeine: true },
  { name: 'Tea', caffeine: true },
  { name: 'Soda', caffeine: true },
  { name: 'Juice' },
  { name: 'Milk' },
  { name: 'Alcohol', alcohol: true },
  { name: 'Other' },
];
export const DEFAULT_DRINK_NAMES = DRINKS.map((d) => d.name);
export const isCaffeine = (name: string) => !!DRINKS.find((d) => d.name === name)?.caffeine;
export const isAlcohol = (name: string) => !!DRINKS.find((d) => d.name === name)?.alcohol;

/** Quick-onboarding questions → the QuickOnboardingAnswers keys the core infers from. */
export const ONBOARD_QUESTIONS: { key: string; prompt: string }[] = [
  { key: 'wakesToUrinateAtNight', prompt: 'Do you wake at night to urinate?' },
  { key: 'wakesUpWet', prompt: 'Do you ever wake up wet, or wet the bed?' },
  { key: 'leaksInDaytime', prompt: 'Do you leak during the day?' },
  { key: 'hasUrgency', prompt: 'Sudden strong urges, or trouble holding it?' },
  { key: 'hasEmptyingTrouble', prompt: 'Weak stream, hard to start, or not feeling empty?' },
  { key: 'reducedAwareness', prompt: 'Often don’t feel the need until it’s urgent — or until you leak?' },
  { key: 'usesProtection', prompt: 'Do you use pads, guards, or diapers?' },
];

/** Expanded (optional) onboarding traits, shown only for the relevant enabled modules. */
export const EXPANDED_TRAITS: { module: string; key: string; prompt: string; options: string[] }[] = [
  { module: 'awareness', key: 'fillingAwareness', prompt: 'How much do you notice your bladder filling?', options: ['Normal', 'Delayed', 'Minimal', 'Absent'] },
  { module: 'awareness', key: 'warningTime', prompt: 'Once you know, how much warning do you get?', options: ['15+ min', '5–15 min', '<5 min', 'Almost none'] },
  // The general "usually?" version of leak awareness — a trait, where "sometimes" belongs.
  { module: 'awareness', key: 'leakNoticing', prompt: 'When you leak, do you usually notice?', options: ['Usually feel it', 'Sometimes', 'Usually find out after', 'Wake and find it'] },
];
