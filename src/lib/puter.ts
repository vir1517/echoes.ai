
'use client';

import * as puter from 'puter';

/**
 * Puter Client Utility
 * Provides access to Puter.js cloud features like KV storage.
 * Falls back to localStorage if Puter is unavailable or errors.
 */
export const getPuter = () => {
  if (typeof window !== 'undefined') {
    const p = (window as any).puter || (puter as any).default || puter;
    return p;
  }
  return null;
};

const STORAGE_KEY = 'echo_profiles_v10'; // Incremented version for stability

/**
 * Saves a profile to Puter KV storage with LocalStorage as a primary source of truth.
 */
export async function saveProfileToPuter(profileData: any) {
  const p = getPuter();
  
  // 1. Update LocalStorage immediately
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
      
      // Dispatch events for cross-tab synchronization
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('profile-updated'));
    } catch (e) {
      console.error("Local storage update failed:", e);
    }
  }

  // 2. Sync with Puter KV in the background if available
  if (p && p.kv) {
    try {
      const stored = await p.kv.get('echo_profiles');
      let profiles = Array.isArray(stored) ? stored : (typeof stored === 'string' ? JSON.parse(stored) : []);

      const index = profiles.findIndex((pr: any) => pr.id === profileData.id);
      if (index !== -1) {
        profiles[index] = profileData;
      } else {
        profiles.push(profileData);
      }
      
      await p.kv.set('echo_profiles', profiles);
    } catch (error) {
      console.warn("Puter KV sync failed:", error);
    }
  }
  
  return true; 
}

/**
 * Retrieves all profiles from Puter KV storage or LocalStorage fallback.
 */
export async function getProfilesFromPuter() {
  const p = getPuter();
  let localProfiles = [];

  // Get local profiles first - this is the primary source of truth for current session
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      localProfiles = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Local storage fetch failed:", e);
    }
  }
  
  // Attempt to sync from cloud
  if (p && p.kv) {
    try {
      const cloudProfilesRaw = await p.kv.get('echo_profiles');
      const cloudProfiles = Array.isArray(cloudProfilesRaw) 
        ? cloudProfilesRaw 
        : (typeof cloudProfilesRaw === 'string' ? JSON.parse(cloudProfilesRaw) : []);
      
      if (cloudProfiles.length > 0) {
        // Merge cloud and local, favoring cloud version for identical IDs but keeping local-only items
        const mergedMap = new Map();
        localProfiles.forEach((pr: any) => mergedMap.set(pr.id, pr));
        cloudProfiles.forEach((pr: any) => mergedMap.set(pr.id, pr));
        
        const merged = Array.from(mergedMap.values());
        
        // Sync merged back to local if it changed
        if (typeof window !== 'undefined' && JSON.stringify(merged) !== JSON.stringify(localProfiles)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
        
        return merged;
      }
    } catch (error) {
      console.warn("Puter KV fetch failed, using local only.");
    }
  }
  
  return localProfiles;
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
  
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const profiles = JSON.parse(stored);
        const filtered = profiles.filter((pr: any) => pr.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (e) {
      console.error("Local storage delete failed:", e);
    }
  }

  if (p && p.kv) {
    try {
      const profilesRaw = await p.kv.get('echo_profiles');
      const profiles = Array.isArray(profilesRaw) ? profilesRaw : (typeof profilesRaw === 'string' ? JSON.parse(profilesRaw) : []);
      const filtered = profiles.filter((pr: any) => pr.id !== id);
      await p.kv.set('echo_profiles', filtered);
    } catch (e) {
      console.warn("Puter KV delete failed");
    }
  }
  
  return true;
}
