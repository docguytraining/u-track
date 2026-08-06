/**
 * Tiered onboarding — infer, then confirm (spec §7.1, test §9.18).
 *
 * Quick onboarding asks a few plain-language symptom questions and INFERS which
 * modules to enable — no checkbox list of conditions, because self-classifying at
 * the moment you know least is bad UX. The inferred set is a suggestion the user
 * confirms or edits; the full checkbox list still lives in Settings as the override
 * (§7.8). Expanded onboarding then fills trait-level detail via applyOnboarding.
 *
 * NOTE (design, open to revision): the question WORDING and the exact answer→module
 * mapping below are a first-pass draft grounded in the spec + the origin ChatGPT/
 * Claude threads. Edit freely — every rule is one line here.
 */
import { applyOnboarding, type Profile } from '../profile/profile';

/** Plain-language quick-onboarding answers. Each is "did you say yes?". */
export interface QuickOnboardingAnswers {
  /** "Do you wake at night to urinate?" */
  wakesToUrinateAtNight?: boolean;
  /** "Do you wake up wet, or wet the bed?" */
  wakesUpWet?: boolean;
  /** "Do you leak during the day?" */
  leaksInDaytime?: boolean;
  /** "Do you get sudden strong urges, or trouble holding it?" */
  hasUrgency?: boolean;
  /** "Weak stream, hard to start, or don't feel empty afterward?" */
  hasEmptyingTrouble?: boolean;
  /** "Do you often not feel the need until it's urgent, or until you leak?" */
  reducedAwareness?: boolean;
  /** "Do you use pads, guards, or diapers?" */
  usesProtection?: boolean;
}

/** Infer the enabled-module id set from quick-onboarding answers. */
export function inferModules(answers: QuickOnboardingAnswers): string[] {
  const modules = new Set<string>();
  if (answers.wakesToUrinateAtNight) modules.add('nocturia');
  if (answers.wakesUpWet) {
    modules.add('nightWetting');
    modules.add('protection'); // overnight wetting needs protection tracking to be useful
  }
  if (answers.leaksInDaytime) modules.add('leakage');
  if (answers.hasUrgency) modules.add('urgency');
  if (answers.hasEmptyingTrouble) modules.add('bph');
  if (answers.reducedAwareness) modules.add('awareness');
  if (answers.usesProtection) modules.add('protection');
  return [...modules];
}

/**
 * Convenience path: infer modules from answers and apply them straight to the
 * profile (events preserved). The "infer, then confirm" UX instead calls
 * inferModules() to seed the confirm screen, then applyOnboarding() with whatever
 * the user ticks — so this is the shortcut for "accept the suggestion as-is".
 */
export function quickOnboard(profile: Profile, answers: QuickOnboardingAnswers): Profile {
  return applyOnboarding(profile, { enabledModules: inferModules(answers) });
}
