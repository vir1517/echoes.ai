
export interface LovedOne {
  id: string;
  name: string;
  birthYear: number;
  passingYear: number;
  relation: string;
  avatarUrl: string;
  summary: string;
  traits: string[];
  birthPlace: string;
  languages: string[];
  occupation: string;
  phrases: string[];
  beliefs: string[];
  events: { year: number; title: string; description: string }[];
}

/**
 * Empty by default to ensure only user-added profiles are displayed.
 * This acts as the fallback for local storage.
 */
export const MOCK_LOVED_ONES: LovedOne[] = [];
