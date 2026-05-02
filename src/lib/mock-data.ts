
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
  artifacts?: PersonaArtifact[];
  voiceSampleDataUri?: string;
  voiceSampleName?: string;
  voiceProfile?: {
    hasReferenceAudio: boolean;
    accent: string;
    styleNotes: string;
  };
  inferenceNotes?: string[];
  sourceEvidence?: string[];
}

export interface PersonaArtifact {
  type: 'image' | 'video' | 'audio' | 'text';
  name: string;
  dataUri: string;
  userContext?: string;
  extractedText?: string;
  transcript?: string;
  analysis?: string;
  size?: number;
  mimeType?: string;
}

/**
 * Empty by default to ensure only user-added profiles are displayed.
 * This acts as the fallback for local storage.
 */
export const MOCK_LOVED_ONES: LovedOne[] = [];
