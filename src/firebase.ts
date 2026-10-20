import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type User } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, onValue, ref } from 'firebase/database';

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getDatabase(app);

if (env.VITE_USE_EMULATOR === 'true') {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(db, host, 9000);
}

/** Resolves once the current session has a user, signing in anonymously if needed. */
export function ensureAnonymousUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        unsub();
        resolve(user);
      }
    });
    auth.authStateReady().then(() => {
      if (!auth.currentUser) signInAnonymously(auth).catch(reject);
    });
  });
}

let serverOffset = 0;
onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
  serverOffset = snap.val() ?? 0;
});

/** Current time estimated on the Firebase server clock (ms). */
export function serverNow(): number {
  return Date.now() + serverOffset;
}
