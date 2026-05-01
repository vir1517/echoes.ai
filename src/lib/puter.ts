
'use client';

import puter from 'puter';

/**
 * Puter Client Utility
 * Provides access to Puter.js cloud features like KV storage.
 */
export const getPuter = () => {
  if (typeof window !== 'undefined') {
    const p = (puter as any).default || puter || (window as any).puter;
    return p;
  }
  return null;
};

export async function saveProfileToPuter(profileData: any) {
  const p = getPuter();
  
  if (!p || !p.kv) {
    console.error("Puter or Puter KV namespace is not available.");
    return false;
  }
  
  try {
    let profiles = [];
    try {
      const stored = await p.kv.get('echo_profiles');
      profiles = Array.isArray(stored) ? stored : [];
    } catch (e) {
      console.warn("Could not retrieve existing profiles, starting fresh.");
    }

    // Check if profile exists to update, otherwise add
    const index = profiles.findIndex((p: any) => p.id === profileData.id);
    if (index !== -1) {
      profiles[index] = profileData;
    } else {
      profiles.push(profileData);
    }
    
    await p.kv.set('echo_profiles', profiles);
    return true;
  } catch (error) {
    console.error("Error saving to Puter KV:", error);
    return false;
  }
}

export async function getProfilesFromPuter() {
  const p = getPuter();
  
  if (!p || !p.kv) {
    return [];
  }
  
  try {
    const profiles = await p.kv.get('echo_profiles');
    return Array.isArray(profiles) ? profiles : [];
  } catch (error) {
    console.error("Error fetching from Puter KV:", error);
    return [];
  }
}

export async function getProfileById(id: string) {
  const profiles = await getProfilesFromPuter();
  return profiles.find((p: any) => p.id === id) || null;
}
