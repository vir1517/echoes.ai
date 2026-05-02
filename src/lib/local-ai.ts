'use client';

import type { LovedOne, PersonaArtifact } from '@/lib/mock-data';

/* ----------------------------- Ollama helpers ----------------------------- */

async function chooseOllamaModel(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) return null;
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);
    console.log('[Ollama] Available models:', models);
    const order = ['llama3.2', 'qwen2.5', 'mistral', 'gemma2', 'phi3'];
    return order.find(m => models.some(n => n.startsWith(m))) || models[0] || null;
  } catch {
    return null;
  }
}

async function ollamaChat(prompt: string, format?: 'json'): Promise<string> {
  const model = await chooseOllamaModel();
  if (!model) {
    console.warn('[Ollama] No model found');
    return '';
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.warn('[Ollama] Request timed out after 15s');
    controller.abort();
  }, 15000);
  try {
    console.log(`[Ollama] Sending request to model ${model}...`);
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format,
        options: { temperature: format === 'json' ? 0.2 : 0.7, top_p: 0.9 }
      })
    });
    if (!res.ok) { console.error('[Ollama] Bad response:', res.status); return ''; }
    const data = await res.json();
    console.log('[Ollama] Response received.');
    return (data.response || data.message?.content || '').trim();
  } catch (err) {
    if ((err as Error).name === 'AbortError') console.error('[Ollama] Request aborted');
    else console.error('[Ollama] Fetch error:', err);
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------------------------- Evidence builder ---------------------------- */

export function buildProfileEvidence(profile: Partial<LovedOne> & { memorySnippets?: string[] }): string[] {
  const evidence: string[] = [];
  if (profile.name) evidence.push(`Identity: ${profile.name}.`);
  if (profile.relation) evidence.push(`Relationship: ${profile.relation}.`);
  if (profile.birthYear || profile.passingYear) evidence.push(`Years: ${profile.birthYear || 'unknown'} to ${profile.passingYear || 'unknown'}.`);
  if (profile.birthPlace) evidence.push(`Birthplace/context: ${profile.birthPlace}.`);
  if (profile.summary) evidence.push(`Summary: ${profile.summary}`);
  if (profile.phrases?.length) evidence.push(`Known phrases: ${profile.phrases.join('; ')}`);
  if (profile.beliefs?.length) evidence.push(`Values: ${profile.beliefs.join('; ')}`);
  if (profile.memorySnippets?.length) profile.memorySnippets.forEach((memory, index) => evidence.push(`Memory ${index + 1}: ${memory}`));
  profile.artifacts?.forEach((artifact, index) => {
    const label = `${artifact.type.toUpperCase()} ${index + 1} (${artifact.name})`;
    if (artifact.userContext) evidence.push(`${label} user context: ${artifact.userContext}`);
    if (artifact.extractedText) evidence.push(`${label} extracted text: ${artifact.extractedText}`);
    if (artifact.transcript) evidence.push(`${label} transcript: ${artifact.transcript}`);
    if (artifact.analysis) evidence.push(`${label} visual analysis: ${artifact.analysis}`);
  });
  return evidence.map(item => item.replace(/\s+/g, ' ').trim().slice(0, 1400)).filter(Boolean).slice(0, 40);
}

/* ------------------------- Persona generation ----------------------------- */

export interface PersonaGenerationInput {
  lovedOneName: string;
  textDocuments?: string[];
  imageDataUris?: string[];
  videoDataUris?: string[];
  audioDataUris?: string[];
  artifacts?: PersonaArtifact[];
}

export interface PersonaGenerationOutput {
  personalityTraits: string[];
  keyBeliefs: string[];
  speakingStyle: { tone: string; commonPhrases: string[]; cadenceDescription: string; };
  overallSummary: string;
  exampleDialogues: string[];
}

export async function generatePersona(input: PersonaGenerationInput): Promise<PersonaGenerationOutput> {
  const artifactDescriptions: string[] = [];
  for (const a of input.artifacts || []) {
    if (a.userContext) artifactDescriptions.push(`[Context for ${a.name}] ${a.userContext.slice(0, 1500)}`);
    if (a.extractedText) artifactDescriptions.push(`[Text from ${a.name}] ${a.extractedText.slice(0, 8000)}`);
    if (a.transcript) artifactDescriptions.push(`[Transcript ${a.name}] ${a.transcript.slice(0, 4000)}`);
    if (a.analysis) artifactDescriptions.push(`[Analysis ${a.name}] ${a.analysis.slice(0, 2000)}`);
  }
  const textMaterial = (input.textDocuments || []).join('\n\n');
  const prompt = `You are an empathetic archivist creating a persona for a memorial app. The person is: ${input.lovedOneName}.
Below are all the materials provided by their family. Extract every detail possible and build a rich, grounded persona.
Family’s written notes:
${textMaterial || '(none)'}
Artifacts and extracted content:
${artifactDescriptions.length ? artifactDescriptions.join('\n\n') : '(none)'}
Rules:
- Use only information that appears in the evidence. Do not invent facts.
- Highlight contradictions or uncertainty.
- The persona should feel warm, real, and conversational.
Return only JSON with this exact structure:
{
  "personalityTraits": ["list of 4-7 specific traits"],
  "keyBeliefs": ["list of 3-5 core beliefs"],
  "speakingStyle": { "tone": "brief description of their tone", "commonPhrases": ["phrases they often said"], "cadenceDescription": "rhythm, pace, pauses, accent hints" },
  "overallSummary": "2-4 sentences summarizing their life and character",
  "exampleDialogues": ["3-4 realistic first-person sentences"]
}`;
  const raw = await ollamaChat(prompt, 'json');
  if (raw) {
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      const parsed = JSON.parse(jsonStr);
      return {
        personalityTraits: parsed.personalityTraits?.length ? parsed.personalityTraits : ['Warm', 'Loving'],
        keyBeliefs: parsed.keyBeliefs?.length ? parsed.keyBeliefs : ['Family first'],
        speakingStyle: {
          tone: parsed.speakingStyle?.tone || 'Gentle and warm',
          commonPhrases: parsed.speakingStyle?.commonPhrases || [],
          cadenceDescription: parsed.speakingStyle?.cadenceDescription || 'Natural, conversational pace',
        },
        overallSummary: parsed.overallSummary || `${input.lovedOneName} is remembered with love.`,
        exampleDialogues: parsed.exampleDialogues?.length ? parsed.exampleDialogues : ['I am here with you.'],
      };
    } catch {}
  }
  return {
    personalityTraits: ['Caring', 'Family-oriented'],
    keyBeliefs: ['Family mattered deeply.'],
    speakingStyle: { tone: 'Warm and familiar', commonPhrases: [], cadenceDescription: 'Gentle, unhurried' },
    overallSummary: `${input.lovedOneName} is remembered through shared stories.`,
    exampleDialogues: ['Tell me what you remember.', "I'm glad you're here."],
  };
}

/* -------------------------- Persona conversation -------------------------- */

export interface ConversationInput {
  personaId: string;
  personaContext: {
    name: string;
    summary: string;
    traits: string[];
    phrases: string[];
    sourceEvidence?: string[];
    voiceProfile?: { hasReferenceAudio: boolean; accent: string; styleNotes: string; };
    voiceSampleDataUri?: string;   // speaker_id
  };
  userInputText: string;
  conversationHistory: { role: 'user' | 'model'; content: string }[];
}

export async function converseWithPersona(input: ConversationInput): Promise<{ responseText: string }> {
  const evidence = (input.personaContext.sourceEvidence || [])
    .map((e, i) => `[${i+1}] ${e}`)
    .join('\n');
  const historyStr = input.conversationHistory
    .slice(-6)
    .map(entry => `${entry.role === 'user' ? 'User' : input.personaContext.name}: ${entry.content}`)
    .join('\n');
  const prompt = `You are the Echo of ${input.personaContext.name}. Speak in first person, warmly and naturally, as if you are their living memory.
Persona:
- Summary: ${input.personaContext.summary}
- Traits: ${input.personaContext.traits.join(', ')}
- Common phrases: ${input.personaContext.phrases.join(', ') || 'none recorded'}
- Speaking style: ${input.personaContext.voiceProfile?.styleNotes || 'warm and gentle, conversational pace'}
Evidence you must rely on (do not invent facts outside of it):
${evidence || 'No detailed evidence – ask for more memories.'}
Conversation so far:
${historyStr || '(new conversation)'}
User says: "${input.userInputText}"
Respond as ${input.personaContext.name} with one or two short, natural sentences. Use contractions and a heartfelt tone. If you don't know something, say you don't recall that detail and ask a gentle question.`;
  const ollamaRes = await ollamaChat(prompt);
  return { responseText: ollamaRes || "I'm here, listening." };
}

/* ------------------------- Enhanced TTS (with cloning) --------------------- */

let audioCtx: AudioContext | null = null;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Try to get cloned voice audio from local TTS server and play via AudioContext
async function fetchAndPlayClone(text: string, speakerId: string, onStart: (() => void) | undefined, onEnd: (() => void) | undefined): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:5001/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker_id: speakerId, language: 'en' })
    });
    if (!res.ok) return false;
    const arrayBuffer = await res.arrayBuffer();
    ensureAudioContext();
    if (!audioCtx) return false;

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);

    source.onended = () => onEnd?.();
    source.start();
    onStart?.();
    return true;
  } catch (err) {
    console.warn('[TTS] Cloned playback error:', err);
    return false;
  }
}

// Browser fallback TTS
function speakWithBrowserFallback(text: string, onStart?: () => void, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && /Google US English|Samantha|Ava|Allison/i.test(v.name))
    || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  setTimeout(() => {
    if (window.speechSynthesis.speaking) return;
    onEnd?.();
  }, 3000);
}

/** Start the audio context on a user gesture (call this from the mic button) */
export function initAudioContext() {
  ensureAudioContext();
}

// The main TTS export – tries cloned server, then falls back to browser TTS
export async function speakWithBrowserTTS(
  text: string,
  speakerId?: string,
  options?: { onStart?: () => void; onEnd?: () => void }
) {
  if (speakerId) {
    console.log('[TTS] Trying cloned voice...');
    const ok = await fetchAndPlayClone(text, speakerId, options?.onStart, options?.onEnd);
    if (ok) return;
    console.warn('[TTS] Cloned voice server unreachable, using browser TTS.');
  }
  speakWithBrowserFallback(text, options?.onStart, options?.onEnd);
}
