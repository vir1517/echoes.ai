
'use client';

import * as puter from 'puter';

/**
 * Puter Client Utility
 * Provides access to Puter.js cloud features like KV storage.
 * LocalStorage is used as the PRIMARY source of truth for immediate availability.
 */
export const getPuter = () => {
  if (typeof window !== 'undefined') {
    const p = (window as any).puter || (puter as any).default || puter;
    return p;
  }
  return null;
};

const STORAGE_KEY = 'echo_profiles_v2';

/**
 * Saves a profile to local storage and attempts to sync with Puter KV.
 */
export async function saveProfileToPuter(profileData: any) {
  if (typeof window === 'undefined') return false;
  
  // 1. Authoritative Update: LocalStorage
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
    
    // Broadcast to current tab and others
    window.dispatchEvent(new CustomEvent('profile-updated'));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  } catch (e) {
    console.error("Critical: Local storage save failed", e);
  }

  // 2. Cloud Sync: Puter KV (Background)
  const p = getPuter();
  if (p && p.kv) {
    try {
      // Fetch latest from cloud to avoid overwriting newer data
      const cloudRaw = await p.kv.get('echo_profiles');
      let cloudProfiles = Array.isArray(cloudRaw) 
        ? cloudRaw 
        : (typeof cloudRaw === 'string' ? JSON.parse(cloudRaw) : []);

      const index = cloudProfiles.findIndex((pr: any) => pr.id === profileData.id);
      if (index !== -1) {
        cloudProfiles[index] = profileData;
      } else {
        cloudProfiles.push(profileData);
      }
      
      await p.kv.set('echo_profiles', cloudProfiles);
    } catch (error) {
      console.warn("Puter KV background sync failed", error);
    }
  }
  
  return true; 
}

/**
 * Retrieves all profiles, merging local storage and Puter cloud data.
 */
export async function getProfilesFromPuter() {
  if (typeof window === 'undefined') return [];
  
  // Load local first (instant)
  let localProfiles = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    localProfiles = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Local storage read failed", e);
  }
  
  // Try to merge with cloud data if available
  const p = getPuter();
  if (p && p.kv) {
    try {
      const cloudRaw = await p.kv.get('echo_profiles');
      const cloudProfiles = Array.isArray(cloudRaw) 
        ? cloudRaw 
        : (typeof cloudRaw === 'string' ? JSON.parse(cloudRaw) : []);
      
      if (cloudProfiles && cloudProfiles.length > 0) {
        // Use a map to merge, cloud versions win on ID collision
        const mergedMap = new Map();
        localProfiles.forEach((pr: any) => mergedMap.set(pr.id, pr));
        cloudProfiles.forEach((pr: any) => mergedMap.set(pr.id, pr));
        
        const merged = Array.from(mergedMap.values());
        
        // Update local if cloud had new info
        if (JSON.stringify(merged) !== JSON.stringify(localProfiles)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        }
      }
    } catch (error) {
      console.warn("Puter KV fetch failed, falling back to local storage.");
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
 * Deletes a profile by ID from local storage and Puter KV.
 */
export async function deleteProfileFromPuter(id: string) {
  if (typeof window === 'undefined') return false;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const profiles = JSON.parse(stored);
      const filtered = profiles.filter((pr: any) => pr.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('profile-updated'));
    }
  } catch (e) {
    console.error("Local storage delete failed", e);
  }

  const p = getPuter();
  if (p && p.kv) {
    try {
      const cloudRaw = await p.kv.get('echo_profiles');
      const cloudProfiles = Array.isArray(cloudRaw) 
        ? cloudRaw 
        : (typeof cloudRaw === 'string' ? JSON.parse(cloudRaw) : []);
      const filtered = cloudProfiles.filter((pr: any) => pr.id !== id);
      await p.kv.set('echo_profiles', filtered);
    } catch (e) {
      console.warn("Puter KV delete sync failed");
    }
  }
  
  return true;
}
