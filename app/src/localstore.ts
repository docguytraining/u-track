/**
 * On-device persistence for the guest (signed-out) diary.
 *
 * Signed-in data lives in Firestore; guests have no cloud doc, so without this their diary
 * would exist only in memory and vanish on reload or when the OS reclaims an installed PWA.
 * A bladder diary spans days, and the app's front door is "no account needed" — so guest data
 * must survive a close/reopen. We keep the persisted slice as one JSON blob in localStorage
 * (the diary is small text; a heavy year of logging is still well under the quota).
 *
 * This is deliberately separate from the signed-in path: on sign-in the local copy is migrated
 * to the cloud and cleared, and sign-out already wipes the Firestore cache — so no account's
 * data is ever left behind in this key on a shared device.
 */

const KEY = 'utrack:v1:diary';

const storage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Some browsers throw on localStorage access in private mode / blocked cookies.
    return null;
  }
};

/** The stored persisted-field blob, or null if absent/unusable. Shape is validated later by
 * the same field-by-field guards the restore-from-backup path uses. */
export function loadLocalDiary(): Record<string, unknown> | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function saveLocalDiary(data: Record<string, unknown>): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage disabled — nothing we can do; the in-memory state still works.
  }
}

export function clearLocalDiary(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
