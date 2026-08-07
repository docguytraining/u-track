/**
 * Sign-in hydration policy (spec §2.3, persistence adapter) — pure, so it is tested
 * without React or Firestore.
 *
 * Local storage is only for people who have NOT signed in. When you sign in:
 *  - Returning account (a cloud doc exists): the account's own cloud data is the sole
 *    source of truth. Start from clean defaults and apply ONLY the fields the cloud doc
 *    actually contains, so a field missing from the cloud can never fall back to the
 *    previous (local or other-account) session's value.
 *  - First sign-in (no cloud doc yet): migrate the current local/guest data into the
 *    new account, so signing in SAVES your work instead of deleting it.
 *
 * The UI must WARN before sign-in when local data exists, since switching to an
 * existing account replaces that local data with the account's data.
 */
export function mergeOnSignIn<T extends Record<string, unknown>>(
  defaults: T,
  local: T,
  cloud: Partial<T> | null | undefined,
): T {
  if (cloud == null) return { ...local }; // first sign-in: migrate local/guest data in
  const next = { ...defaults }; // returning account: clean slate + only its own cloud fields
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (cloud[key] !== undefined) next[key] = cloud[key] as T[keyof T];
  }
  return next;
}
