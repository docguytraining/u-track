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
      q('leakSeverity', 'leak', true, 80, 'How much?', ['Damp', 'Moderate', 'Soaked']),
      q('leakTrigger', 'leak', true, 70, 'What set it off?', ['Urge', 'Cough / lift', 'Couldn’t reach', 'Unsure']),
      // Point-in-time: about THIS leak, so no "sometimes" (that's a trait — see awareness).
      q('leakAwareness', 'leak', false, 40, 'Did you feel this one happening?', ['Felt the urge first', 'Found out after', 'Unsure']),
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
      q('wetAwareness', 'morning', false, 50, 'Did you notice before waking?', ['Woke before', 'Slept through', 'Found out after', 'Unsure']),
    ],
  },
  protection: {
    id: 'protection',
    label: 'Protection',
    blurb: 'Pads, guards, diapers',
    widget: 'Protection use',
    questions: [
      q('protectionUsed', 'morning', false, 45, 'Protection overnight?', ['None', 'Pad / guard', 'Pull-up', 'Diaper']),
    ],
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
export const PRODUCT_TIERS: { name: string; grams: number }[] = [
  { name: 'Light guard / shield', grams: 20 }, // Prevail Guard, Tena Men L1
  { name: 'Standard guard', grams: 40 }, // Depend Guard, Tena Men L2/3
  { name: 'Daytime pull-up', grams: 60 }, // Depend Real Fit, Tena Stretch
  { name: 'Overnight brief', grams: 100 }, // Tranquility ATN, TENA Complete
  { name: 'Max-capacity brief', grams: 220 }, // NorthShore MegaMax, BetterDry
];

export const DEFAULT_DRY_WEIGHTS: Record<string, number> = Object.fromEntries(
  PRODUCT_TIERS.map((t) => [t.name, t.grams]),
);

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
