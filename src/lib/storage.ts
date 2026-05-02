'use client';

import type { LovedOne } from '@/lib/mock-data';

const STORAGE_KEY = 'echo_profiles_v3';
const DB_NAME = 'echoes_profile_vault';
const DB_VERSION = 1;
const DB_STORE = 'kv';
const DB_PROFILES_KEY = 'profiles';

/* --------------------- IndexedDB helpers --------------------- */
function openProfileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readProfilesFromIndexedDb(): Promise<LovedOne[]> {
  try {
    const db = await openProfileDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(DB_PROFILES_KEY);
      req.onsuccess = () => resolve(req.result ? (Array.isArray(req.result) ? req.result : []) : []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

async function writeProfilesToIndexedDb(profiles: LovedOne[]): Promise<boolean> {
  try {
    const db = await openProfileDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(profiles, DB_PROFILES_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
    });
  } catch {
    return false;
  }
}

/* ---------------- Lightweight localStorage mirror --------------- */
function stripLargeFields(profile: LovedOne): LovedOne {
  return {
    ...profile,
    artifacts: profile.artifacts?.map(({ dataUri, ...rest }) => ({
      ...rest,
      dataUri: rest.type === 'image' ? dataUri : '', // keep only images
    })),
  };
}

function notifySync(profiles: LovedOne[]) {
  window.dispatchEvent(new CustomEvent('profile-updated'));
  window.dispatchEvent(new StorageEvent('storage', {
    key: STORAGE_KEY,
    newValue: JSON.stringify(profiles.map(stripLargeFields)),
  }));
}

/* ------------------ Public API ------------------ */
export async function saveProfile(profileData: LovedOne): Promise<boolean> {
  let profiles = await getProfiles();
  const idx = profiles.findIndex(p => p.id === profileData.id);
  if (idx !== -1) profiles[idx] = profileData;
  else profiles.push(profileData);

  const success = await writeProfilesToIndexedDb(profiles);
  if (success) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.map(stripLargeFields)));
    notifySync(profiles);
  }
  return success;
}

export async function getProfiles(): Promise<LovedOne[]> {
  const indexed = await readProfilesFromIndexedDb();
  if (indexed.length) return indexed;
  // fallback to localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored) as LovedOne[]; } catch {}
  }
  return [];
}

export async function getProfileById(id: string): Promise<LovedOne | null> {
  const profiles = await getProfiles();
  return profiles.find(p => p.id === id) ?? null;
}

export async function deleteProfile(id: string): Promise<boolean> {
  const profiles = (await getProfiles()).filter(p => p.id !== id);
  const success = await writeProfilesToIndexedDb(profiles);
  if (success) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.map(stripLargeFields)));
    notifySync(profiles);
  }
  return success;
}
