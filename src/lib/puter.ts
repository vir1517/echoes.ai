
'use client';

import puter from 'puter';

/**
 * Puter Client Utility
 * Provides access to Puter.js cloud features like KV storage, AI, and Hosting.
 */
export const getPuter = () => {
  if (typeof window !== 'undefined') {
    return puter;
  }
  return null;
};

export async function saveProfileToPuter(profileData: any) {
  const p = getPuter();
  if (!p) return null;
  
  try {
    // Save to Puter's Key-Value store for serverless persistence
    const profiles = await p.kv.get('echo_profiles') || [];
    const updatedProfiles = [...(Array.isArray(profiles) ? profiles : []), profileData];
    await p.kv.set('echo_profiles', updatedProfiles);
    return true;
  } catch (error) {
    console.error("Error saving to Puter KV:", error);
    return false;
  }
}

export async function getProfilesFromPuter() {
  const p = getPuter();
  if (!p) return [];
  
  try {
    const profiles = await p.kv.get('echo_profiles');
    return Array.isArray(profiles) ? profiles : [];
  } catch (error) {
    console.error("Error fetching from Puter KV:", error);
    return [];
  }
}
