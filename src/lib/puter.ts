'use client';

import puter from 'puter';

/**
 * Puter Client Utility
 * Provides access to Puter.js cloud features like KV storage, AI, and Hosting.
 */
export const getPuter = () => {
  if (typeof window !== 'undefined') {
    // Handle ESM/CJS default import mismatch which often causes "undefined" property errors
    // Also check for the browser global in case it's loaded via CDN
    const p = (puter as any).default || puter || (window as any).puter;
    return p;
  }
  return null;
};

export async function saveProfileToPuter(profileData: any) {
  const p = getPuter();
  
  // Defensive check for the Puter instance and the KV namespace
  if (!p || !p.kv) {
    console.error("Puter or Puter KV namespace is not available.");
    return false;
  }
  
  try {
    // Retrieve existing profiles or start with an empty array
    let profiles = [];
    try {
      const stored = await p.kv.get('echo_profiles');
      profiles = Array.isArray(stored) ? stored : [];
    } catch (e) {
      console.warn("Could not retrieve existing profiles, starting fresh.");
    }

    const updatedProfiles = [...profiles, profileData];
    
    // Save back to Puter's Key-Value store
    await p.kv.set('echo_profiles', updatedProfiles);
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
