/**
 * Module registry + profile-composed core — spec §5.4 / tests §9.D (not yet implemented).
 * The core question set for each surface is composed from ENABLED modules: budget 2,
 * filled by priority, deduped by question id, empty core allowed (pure tap).
 */
export type Surface = 'void' | 'leak' | 'night' | 'morning';

export interface QuestionDef {
  id: string;
  surface: Surface;
  coreEligible: boolean;
  priority: number;
}

export interface TrackingModule {
  id: string;
  enabled: boolean;
  eventTypes: string[];
  questions: QuestionDef[];
}

export const CORE_BUDGET = 2;

/**
 * All questions the ENABLED modules contribute to a surface, deduped by id.
 * When two modules own the same question id, the higher-priority instance wins
 * (spec §5.4 dedup). Disabled modules never appear.
 */
function enabledQuestions(
  modules: readonly TrackingModule[],
  surface: Surface,
): QuestionDef[] {
  const byId = new Map<string, QuestionDef>();
  for (const m of modules) {
    if (!m.enabled) continue;
    for (const question of m.questions) {
      if (question.surface !== surface) continue;
      const existing = byId.get(question.id);
      if (!existing || question.priority > existing.priority) {
        byId.set(question.id, question);
      }
    }
  }
  return [...byId.values()];
}

/** Highest priority first; id as a stable tiebreaker so composition is deterministic. */
function byPriorityDesc(a: QuestionDef, b: QuestionDef): number {
  return b.priority - a.priority || a.id.localeCompare(b.id);
}

/** Compose the core questions for a surface from the enabled modules (spec §5.4). */
export function composeCore(
  modules: readonly TrackingModule[],
  surface: Surface,
): QuestionDef[] {
  // Only coreEligible questions compete for the budget; empty core is valid (pure tap).
  return enabledQuestions(modules, surface)
    .filter((question) => question.coreEligible)
    .sort(byPriorityDesc)
    .slice(0, CORE_BUDGET);
}

/** Everything enabled for a surface that didn't make core → the "Track anything else?" gateway. */
export function composeGateway(
  modules: readonly TrackingModule[],
  surface: Surface,
): QuestionDef[] {
  const inCore = new Set(composeCore(modules, surface).map((question) => question.id));
  return enabledQuestions(modules, surface)
    .filter((question) => !inCore.has(question.id))
    .sort(byPriorityDesc);
}
