// The profiles and the saved data. All data access goes through this file.
// Firebase keeps the data. It also works without a network: the changes wait on
// the device, then they are sent.

import { createDemoData } from "./demo.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";
import { dateKey } from "./time.js";

const FIREBASE_CODE = "https://www.gstatic.com/firebasejs/13.1.0";
const DEMO_KEY = "suivi-heures.demo";
const THEME_KEY = "suivi-heures.theme";
const OLD_LOCAL_KEY = "suivi-heures.data";
const GROUPS = ["sessions", "absences", "closedDays", "notes", "holidayOverrides", "settings"];

/** True when the page shows the example data instead of the real data. */
export const isDemo = new URLSearchParams(location.search).has("demo");

let firebase = null;
let savedDocument = null;
let reportSaveError = (error) => console.error(error);
let stopWatching = () => {};

// ----- format -----

/**
 * Adds the missing fields to some saved data.
 *
 * Args:
 *   saved: The saved data, possibly from an older version.
 *
 * Returns:
 *   The data, with these fields:
 *   - sessions: an array of { id, start, end }. The dates are ISO strings.
 *     `end` is null while the session runs.
 *   - absences: an object from day key to a kind of absence.
 *   - closedDays: an object from day key to true, for the finished days.
 *   - notes: an object from day key to a text.
 *   - holidayOverrides: the changes to the holidays. See `effectiveHolidays`.
 *   - settings: { dailyHours, vacationDays, startDate, startBalanceMinutes,
 *     profileName }. `startDate` is null until the first use.
 */
export function normalizeData(saved) {
  return {
    sessions: saved.sessions ?? [],
    absences: saved.absences ?? {},
    closedDays: saved.closedDays ?? {},
    notes: saved.notes ?? {},
    holidayOverrides: saved.holidayOverrides ?? {},
    settings: {
      dailyHours: 8,
      vacationDays: 20,
      startDate: null,
      startBalanceMinutes: 0,
      profileName: null,
      ...saved.settings,
    },
  };
}

// In Firebase, the sessions are a map from id to session. Two devices can then
// change different sessions without losing the work of the other device.
function toDocument(data) {
  const sessions = {};
  for (const { id, start, end } of data.sessions) {
    sessions[id] = { start, end };
  }
  // A full copy: the app changes its data in place, and this copy must not follow.
  return structuredClone({ ...data, sessions });
}

function fromDocument(document) {
  const sessions = Object.entries(document.sessions ?? {}).map(([id, { start, end }]) => ({ id, start, end }));
  return normalizeData({ ...document, sessions });
}

function canonical(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Lists the fields that differ between two documents.
 *
 * Args:
 *   before: The old document.
 *   after: The new document.
 *
 * Returns:
 *   An array of { group, key, value }. `value` is undefined for a removed field.
 */
export function listChanges(before, after) {
  const changes = [];
  for (const group of GROUPS) {
    const keys = new Set([...Object.keys(before[group] ?? {}), ...Object.keys(after[group] ?? {})]);
    for (const key of keys) {
      const oldValue = before[group]?.[key];
      const newValue = after[group]?.[key];
      if (canonical(oldValue) !== canonical(newValue)) {
        changes.push({ group, key, value: newValue });
      }
    }
  }
  return changes;
}

// ----- firebase -----

async function connect() {
  if (firebase) {
    return firebase;
  }
  const [appSdk, authSdk, store] = await Promise.all([
    import(`${FIREBASE_CODE}/firebase-app.js`),
    import(`${FIREBASE_CODE}/firebase-auth.js`),
    import(`${FIREBASE_CODE}/firebase-firestore.js`),
  ]);
  const app = appSdk.initializeApp(FIREBASE_CONFIG);
  const auth = authSdk.getAuth(app);
  const db = store.initializeFirestore(app, {
    localCache: store.persistentLocalCache({ tabManager: store.persistentMultipleTabManager() }),
  });
  firebase = { authSdk, auth, store, db };
  return firebase;
}

function userDocument() {
  const { auth, db, store } = firebase;
  return store.doc(db, "users", auth.currentUser.uid);
}

// ----- profiles -----

/**
 * Turns a profile name into the e-mail address that Firebase needs. No e-mail
 * is ever sent to it.
 *
 * Args:
 *   name: The name typed by the user.
 *
 * Returns:
 *   An address like "ludo@suivi-heures-679b4.firebaseapp.com".
 *
 * Raises:
 *   Error with the code "profile/invalid-name" if the name cannot be used.
 */
export function profileEmail(name) {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (!/^[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?$/.test(clean) || clean.length < 2) {
    throw Object.assign(new Error("Invalid profile name"), { code: "profile/invalid-name" });
  }
  return `${clean}@${FIREBASE_CONFIG.authDomain}`;
}

/**
 * Tells if a profile is connected on this device.
 *
 * Returns:
 *   True if a profile is connected.
 */
export async function hasProfile() {
  const { auth } = await connect();
  await auth.authStateReady();
  return auth.currentUser !== null;
}

/**
 * Connects an existing profile.
 *
 * Args:
 *   name: The profile name.
 *   password: The password.
 */
export async function signIn(name, password) {
  const email = profileEmail(name);
  const { authSdk, auth } = await connect();
  await authSdk.signInWithEmailAndPassword(auth, email, password);
}

/**
 * Tells how many work periods of an older version wait on this device.
 *
 * Returns:
 *   The number of periods.
 */
export function countOldLocalSessions() {
  const saved = JSON.parse(localStorage.getItem(OLD_LOCAL_KEY) ?? "{}");
  return saved.sessions?.length ?? 0;
}

/**
 * Creates a profile. Without a valid invite code, nothing stays in Firebase.
 *
 * Args:
 *   name: The profile name, as the user wants to see it.
 *   password: The password.
 *   inviteCode: The invite code.
 *   keepOldData: True to start with the data of an older version on this device.
 *
 * Raises:
 *   Error with the code "profile/invalid-invite" if the code is refused.
 */
export async function createProfile(name, password, inviteCode, keepOldData) {
  const email = profileEmail(name);
  const { authSdk, auth, store } = await connect();
  const { user } = await authSdk.createUserWithEmailAndPassword(auth, email, password);

  const saved = keepOldData ? JSON.parse(localStorage.getItem(OLD_LOCAL_KEY) ?? "{}") : {};
  const data = normalizeData(saved);
  data.settings.profileName = name.trim();
  data.settings.startDate ??= dateKey(new Date());
  try {
    await store.setDoc(userDocument(), { ...toDocument(data), inviteCode });
  } catch (error) {
    await authSdk.deleteUser(user);
    if (error.code === "permission-denied" || error.code === "invalid-argument") {
      throw Object.assign(new Error("Invite refused"), { code: "profile/invalid-invite" });
    }
    throw error;
  }
  if (keepOldData) {
    localStorage.removeItem(OLD_LOCAL_KEY);
  }
}

/**
 * Disconnects the profile and removes its copy from this device.
 */
export async function signOutProfile() {
  const { authSdk, auth, db, store } = await connect();
  stopWatching();
  await authSdk.signOut(auth);
  await store.terminate(db);
  try {
    await store.clearIndexedDbPersistence(db);
  } catch {
    // Another tab still uses the copy. It stays unreadable without the profile
    // through the app, and the next sign-in replaces it.
  }
}

/**
 * Changes the password of the connected profile.
 *
 * Args:
 *   currentPassword: The current password.
 *   newPassword: The new password.
 */
export async function changePassword(currentPassword, newPassword) {
  const { authSdk, auth } = await connect();
  const user = auth.currentUser;
  const credential = authSdk.EmailAuthProvider.credential(user.email, currentPassword);
  await authSdk.reauthenticateWithCredential(user, credential);
  await authSdk.updatePassword(user, newPassword);
}

// ----- data -----

/**
 * Reads the saved data.
 *
 * Returns:
 *   The data. See `normalizeData`.
 *
 * Raises:
 *   Error with the code "profile/missing" if the profile has no data in Firebase.
 */
export async function loadData() {
  if (isDemo) {
    const saved = localStorage.getItem(DEMO_KEY);
    return normalizeData(saved ? JSON.parse(saved) : createDemoData(new Date()));
  }
  const { store } = await connect();
  const snapshot = await new Promise((resolve, reject) => {
    const stop = store.onSnapshot(
      userDocument(),
      { includeMetadataChanges: true },
      (current) => {
        if (current.exists() || !current.metadata.fromCache) {
          stop();
          resolve(current);
        }
      },
      reject,
    );
  });
  if (!snapshot.exists()) {
    throw Object.assign(new Error("Profile without data"), { code: "profile/missing" });
  }
  const data = fromDocument(snapshot.data());
  savedDocument = toDocument(data);
  return data;
}

/**
 * Saves the data. Only the changed fields are sent. The function does not wait
 * for the network: without a network, the changes leave later.
 *
 * Args:
 *   data: The data to save.
 */
export async function saveData(data) {
  if (isDemo) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(data));
    return;
  }
  const { store } = firebase;
  const nextDocument = toDocument(data);
  const changes = listChanges(savedDocument, nextDocument);
  savedDocument = nextDocument;
  if (changes.length === 0) {
    return;
  }
  const fields = changes.flatMap(({ group, key, value }) => [
    new store.FieldPath(group, key),
    value === undefined ? store.deleteField() : value,
  ]);
  store.updateDoc(userDocument(), ...fields).catch((error) => reportSaveError(error));
}

/**
 * Follows the changes made on the other devices.
 *
 * Args:
 *   onChange: Called with the new data when another device changed it.
 *   onError: Called when a change could not be saved or read.
 */
export function watchData(onChange, onError) {
  if (isDemo) {
    return;
  }
  reportSaveError = onError;
  const { store } = firebase;
  stopWatching = store.onSnapshot(
    userDocument(),
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }
      const data = fromDocument(snapshot.data());
      const document = toDocument(data);
      if (listChanges(savedDocument, document).length > 0) {
        savedDocument = document;
        onChange(data);
      }
    },
    onError,
  );
}

// ----- settings of this device -----

/**
 * Reads the theme chosen on this device.
 *
 * Returns:
 *   "auto", "light" or "dark".
 */
export function loadTheme() {
  return localStorage.getItem(THEME_KEY) ?? "auto";
}

/**
 * Saves the theme chosen on this device.
 *
 * Args:
 *   theme: "auto", "light" or "dark".
 */
export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}
