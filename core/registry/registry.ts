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

/** Compose the core questions for a surface from the enabled modules (spec §5.4). */
export function composeCore(
  _modules: readonly TrackingModule[],
  _surface: Surface,
): QuestionDef[] {
  throw new Error('not implemented');
}

/** Everything enabled for a surface that didn't make core → the "Track anything else?" gateway. */
export function composeGateway(
  _modules: readonly TrackingModule[],
  _surface: Surface,
): QuestionDef[] {
  throw new Error('not implemented');
}
