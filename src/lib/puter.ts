'use client';

import * as puter from 'puter';

/**
 * Puter Client Utility
 * Provides access to Puter.js cloud features like KV storage.
 * Falls back to localStorage if Puter is unavailable or errors.
 */
export const getPuter = () => {
  if (typeof window !== 'undefined') {
    // Puter is often available globally in its own environment
    // Or via the default export of the npm package
    const p = (window as any).puter || (puter as any).default || puter;
    return p;
  }
  return null;
};

const STORAGE_KEY = 'echo_profiles_local';

/**
 * Saves a profile to Puter KV storage with LocalStorage as a fallback.
 */
export async function saveProfileToPuter(profileData: any) {
  const p = getPuter();
  
  // Try Puter KV first
  if (p && p.kv) {
    try {
      let profiles = [];
      const stored = await p.kv.get('echo_profiles');
      profiles = Array.isArray(stored) ? stored : (typeof stored === 'string' ? JSON.parse(stored) : []);

      const index = profiles.findIndex((pr: any) => pr.id === profileData.id);
      if (index !== -1) {
        profiles[index] = profileData;
      } else {
        profiles.push(profileData);
      }
      
      await p.kv.set('echo_profiles', profiles);
      return true;
    } catch (error) {
      console.warn("Puter KV failed, falling back to local storage:", error);
    }
  }

  // Fallback to LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const profiles = stored ? JSON.parse(stored) : [];
      const index = profiles.findIndex((pr: any) => pr.id === profileData.id);
      if (index !== -1) {
        profiles[index] = profileData;
      } else {
        profiles.push(profileData);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      return true;
    } catch (e) {
      console.error("Local storage fallback failed:", e);
    }
  }
  
  return false;
}

/**
 * Retrieves all profiles from Puter KV storage or LocalStorage fallback.
 */
export async function getProfilesFromPuter() {
  const p = getPuter();
  
  if (p && p.kv) {
    try {
      const profiles = await p.kv.get('echo_profiles');
      if (profiles) {
        return Array.isArray(profiles) ? profiles : (typeof profiles === 'string' ? JSON.parse(profiles) : []);
      }
    } catch (error) {
      console.warn("Puter KV fetch failed, falling back to local storage:", error);
    }
  }
  
  // Fallback to LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Local storage fetch failed:", e);
    }
  }
  
  return [];
}

/**
 * Retrieves a single profile by ID.
 */
export async function getProfileById(id: string) {
  const profiles = await getProfilesFromPuter();
  return profiles.find((p: any) => p.id === id) || null;
}

/**
 * Deletes a profile by ID.
 */
export async function deleteProfileFromPuter(id: string) {
  const p = getPuter();
  
  let success = false;
  if (p && p.kv) {
    try {
      const profiles = await getProfilesFromPuter();
      const filtered = profiles.filter((pr: any) => pr.id !== id);
      await p.kv.set('echo_profiles', filtered);
      success = true;
    } catch (e) {
      console.warn("Puter KV delete failed, trying local storage");
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const profiles = JSON.parse(stored);
        const filtered = profiles.filter((pr: any) => pr.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        success = true;
      }
    } catch (e) {
      console.error("Local storage delete failed:", e);
    }
  }
  
  return success;
}
