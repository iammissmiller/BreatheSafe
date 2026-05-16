/* ═══════════════════════════════════════════
   BREATHESAFE — db.js
   Firestore database layer.
   Wraps all read/write for profile, logs, episodes.
   Falls back to localStorage if user not authenticated.
═══════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBx-BCvoJn8_KrpVL8eWM-rW0ELyCj7ULs",
  authDomain: "breathesafe-20c64.firebaseapp.com",
  projectId: "breathesafe-20c64",
  storageBucket: "breathesafe-20c64.firebasestorage.app",
  messagingSenderId: "1031715271372",
  appId: "1:1031715271372:web:f48be78326e269f1304869"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── CURRENT USER ── */
let currentUID = null;

onAuthStateChanged(auth, user => {
  currentUID = user ? user.uid : null;
});

function getUID() {
  return currentUID || auth.currentUser?.uid || null;
}

/* ══════════════════════════════════════════
   PROFILE
══════════════════════════════════════════ */

const PROFILE_KEYS = ['bs-name','bs-age','bs-comfort','bs-conditions','bs-smoke','bs-sensitivity','bs-outdoors','bs-concern'];

export async function saveProfile(data) {
  // Always save to localStorage
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));

  const uid = getUID();
  if (!uid) return;

  try {
    await setDoc(doc(db, 'users', uid, 'data', 'profile'), {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore profile save failed:', e);
  }
}

export async function loadProfile() {
  const uid = getUID();
  if (!uid) return getLocalProfile();

  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'profile'));
    if (snap.exists()) {
      const data = snap.data();
      // Sync to localStorage
      PROFILE_KEYS.forEach(k => {
        if (data[k] !== undefined) localStorage.setItem(k, data[k]);
      });
      return data;
    }
  } catch (e) {
    console.warn('Firestore profile load failed:', e);
  }

  return getLocalProfile();
}

function getLocalProfile() {
  const data = {};
  PROFILE_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;
  });
  return data;
}

/* ══════════════════════════════════════════
   SYMPTOM LOGS
   Structure: users/{uid}/logs/{date}
   { date, comfort, symptoms, timeOfDay, trigger }
══════════════════════════════════════════ */

export async function savelog(entry) {
  // Always save to localStorage
  const logs = getLocalLogs();
  const existing = logs.findIndex(l => l.date === entry.date);
  if (existing >= 0) logs[existing] = entry;
  else logs.push(entry);
  localStorage.setItem('bs-logs', JSON.stringify(logs));

  const uid = getUID();
  if (!uid) return;

  try {
    await setDoc(doc(db, 'users', uid, 'logs', entry.date), {
      ...entry,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore log save failed:', e);
  }
}

export async function loadLogs() {
  const uid = getUID();
  if (!uid) return getLocalLogs();

  try {
    const q    = query(collection(db, 'users', uid, 'logs'), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    const logs = snap.docs.map(d => {
      const data = d.data();
      delete data.updatedAt;
      return data;
    });
    // Sync to localStorage
    localStorage.setItem('bs-logs', JSON.stringify(logs));
    return logs;
  } catch (e) {
    console.warn('Firestore logs load failed:', e);
  }

  return getLocalLogs();
}

export function getLocalLogs() {
  try { return JSON.parse(localStorage.getItem('bs-logs') || '[]'); }
  catch { return []; }
}

/* ══════════════════════════════════════════
   EPISODES (HelpZone)
   Structure: users/{uid}/episodes/{auto-id}
   { date, time, triggers, stepsCompleted }
══════════════════════════════════════════ */

export async function saveEpisode(episode) {
  // Always save to localStorage
  const episodes = getLocalEpisodes();
  episodes.push(episode);
  localStorage.setItem('bs-episodes', JSON.stringify(episodes));

  const uid = getUID();
  if (!uid) return;

  try {
    await addDoc(collection(db, 'users', uid, 'episodes'), {
      ...episode,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Firestore episode save failed:', e);
  }
}

export async function loadEpisodes() {
  const uid = getUID();
  if (!uid) return getLocalEpisodes();

  try {
    const q    = query(collection(db, 'users', uid, 'episodes'), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    const episodes = snap.docs.map(d => {
      const data = d.data();
      delete data.createdAt;
      return data;
    });
    localStorage.setItem('bs-episodes', JSON.stringify(episodes));
    return episodes;
  } catch (e) {
    console.warn('Firestore episodes load failed:', e);
  }

  return getLocalEpisodes();
}

export function getLocalEpisodes() {
  try { return JSON.parse(localStorage.getItem('bs-episodes') || '[]'); }
  catch { return []; }
}

/* ══════════════════════════════════════════
   SYNC ON LOGIN
   Call this after Firebase Auth signs in.
   Pulls Firestore data and syncs to localStorage.
══════════════════════════════════════════ */

export async function syncOnLogin() {
  await Promise.allSettled([
    loadProfile(),
    loadLogs(),
    loadEpisodes(),
  ]);
  console.log('BreatheSafe: Firestore sync complete');
}