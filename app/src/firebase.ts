import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  connectFirestoreEmulator,
  terminate,
  clearIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const emu = import.meta.env.VITE_USE_EMULATOR;
const useEmulator = emu === '1' || emu === 'true';

/** Cloud sync is possible when a projectId exists (the emulator needs only that). */
export const cloudEnabled = !!cfg.projectId;

let app: FirebaseApp | null = null;
let authRef: Auth | null = null;
let dbRef: Firestore | null = null;

if (cloudEnabled) {
  app = initializeApp(cfg);
  authRef = getAuth(app);
  // Skip on-disk cache against the emulator so local test data never mingles with prod.
  dbRef = useEmulator
    ? initializeFirestore(app, { ignoreUndefinedProperties: true })
    : initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache() });

  if (useEmulator) {
    connectAuthEmulator(authRef, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(dbRef, '127.0.0.1', 8080);
  }
}

export const auth = authRef;
export const db = dbRef;
export const usingEmulator = useEmulator && cloudEnabled;

const noCloud = () => Promise.reject(new Error('cloud not configured'));

const provider = new GoogleAuthProvider();
export const signInWithGoogle = () => (authRef ? signInWithPopup(authRef, provider) : noCloud());

// Email + password.
export const signInEmailPassword = (email: string, pw: string) =>
  authRef ? signInWithEmailAndPassword(authRef, email, pw) : noCloud();
export const createAccount = (email: string, pw: string) =>
  authRef ? createUserWithEmailAndPassword(authRef, email, pw) : noCloud();

// Passwordless email link (magic link). The redirect comes back to this same URL.
const LINK_EMAIL_KEY = 'utrack:emailForSignIn';
const linkSettings = () => ({ url: window.location.origin + window.location.pathname, handleCodeInApp: true });
export const sendMagicLink = (email: string) => {
  if (!authRef) return noCloud();
  window.localStorage.setItem(LINK_EMAIL_KEY, email);
  return sendSignInLinkToEmail(authRef, email, linkSettings());
};
export const pendingEmailLink = () => !!authRef && isSignInWithEmailLink(authRef, window.location.href);
export const completeMagicLink = async (): Promise<User | null> => {
  if (!authRef || !isSignInWithEmailLink(authRef, window.location.href)) return null;
  let email = window.localStorage.getItem(LINK_EMAIL_KEY);
  if (!email) email = window.prompt('Confirm the email you used to sign in') ?? '';
  const res = await signInWithEmailLink(authRef, email, window.location.href);
  window.localStorage.removeItem(LINK_EMAIL_KEY);
  window.history.replaceState({}, '', window.location.origin + window.location.pathname); // strip the link params
  return res.user;
};

export const signOutUser = async () => {
  if (!authRef) return;
  await signOut(authRef);
  // Wipe the on-disk Firestore cache so the signed-out user's diary doesn't linger in
  // IndexedDB on a shared device. Best-effort: terminate then clear (needs no other open
  // tab holding the DB). The caller reloads afterward to re-init a fresh Firestore.
  if (dbRef && !useEmulator) {
    try {
      await terminate(dbRef);
      await clearIndexedDbPersistence(dbRef);
    } catch { /* another tab open, or nothing cached — ignore */ }
  }
};
export const onAuth = (cb: (u: User | null) => void) => (authRef ? onAuthStateChanged(authRef, cb) : () => {});
export type { User };
