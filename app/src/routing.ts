export type ScreenKey =
  | 'splash'
  | 'signin'
  | 'onboarding'
  | 'void'
  | 'leak'
  | 'change'
  | 'drink'
  | 'morning'
  | 'checkin'
  | 'report'
  | 'chart'
  | 'detail'
  | 'settings'
  | 'home';

const ROUTED: ScreenKey[] = ['void', 'leak', 'change', 'drink', 'morning', 'checkin', 'report', 'chart', 'detail', 'settings'];

/**
 * Pure routing decision. Order matters:
 *  1. Wait for auth before deciding anything (avoids an onboarding flash).
 *  2. Sign-in is reachable at any time — including before onboarding — so a returning
 *     user can log in straight from the welcome.
 *  3. Otherwise a not-onboarded user is sent through onboarding.
 *  4. Onboarded users go to the screen they asked for; anything unrecognised is home.
 */
export function selectScreen(s: { authReady: boolean; onboarded: boolean; screen: string }): ScreenKey {
  if (!s.authReady) return 'splash';
  if (s.screen === 'signin') return 'signin';
  if (!s.onboarded) return 'onboarding';
  return (ROUTED as string[]).includes(s.screen) ? (s.screen as ScreenKey) : 'home';
}
