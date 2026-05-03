'use client';

import type { LovedOne, PersonaArtifact } from '@/lib/mock-data';

/* ---------- Ollama helpers (unchanged) ---------- */
async function chooseOllamaModel(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:3001/api/tags');
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
  if (!model) { console.warn('[Ollama] No model found'); return ''; }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('http://localhost:3001/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt, stream: false, format,
        options: { temperature: format === 'json' ? 0.2 : 0.7, top_p: 0.9 } })
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data.response || data.message?.content || '').trim();
  } catch { return ''; }
}

/* ---------- Evidence builder (unchanged) ---------- */
export function buildProfileEvidence(profile: Partial<LovedOne> & { memorySnippets?: string[] }): string[] {
  const evidence: string[] = [];
  if (profile.name) evidence.push(`Identity: ${profile.name}.`);
  if (profile.relation) evidence.push(`Relationship: ${profile.relation}.`);
  if (profile.birthYear || profile.passingYear) evidence.push(`Years: ${profile.birthYear || 'unknown'} to ${profile.passingYear || 'unknown'}.`);
  if (profile.birthPlace) evidence.push(`Birthplace/context: ${profile.birthPlace}.`);
  if (profile.summary) evidence.push(`Summary: ${profile.summary}`);
  if (profile.phrases?.length) evidence.push(`Known phrases: ${profile.phrases.join('; ')}`);
  if (profile.beliefs?.length) evidence.push(`Values: ${profile.beliefs.join('; ')}`);
  if (profile.memorySnippets?.length) profile.memorySnippets.forEach((m,i) => evidence.push(`Memory ${i+1}: ${m}`));
  profile.artifacts?.forEach((a,i) => {
    const label = `${a.type.toUpperCase()} ${i+1} (${a.name})`;
    if (a.userContext) evidence.push(`${label} context: ${a.userContext}`);
    if (a.extractedText) evidence.push(`${label} text: ${a.extractedText}`);
    if (a.transcript) evidence.push(`${label} transcript: ${a.transcript}`);
    if (a.analysis) evidence.push(`${label} analysis: ${a.analysis}`);
  });
  return evidence.map(e => e.replace(/\s+/g,' ').trim().slice(0,1400)).filter(Boolean).slice(0,40);
}

/* ---------- Persona generation (unchanged) ---------- */
export interface PersonaGenerationInput {
  lovedOneName: string; textDocuments?: string[]; imageDataUris?: string[];
  videoDataUris?: string[]; audioDataUris?: string[]; artifacts?: PersonaArtifact[];
}
export interface PersonaGenerationOutput {
  personalityTraits: string[]; keyBeliefs: string[];
  speakingStyle: { tone: string; commonPhrases: string[]; cadenceDescription: string; };
  overallSummary: string; exampleDialogues: string[];
}
export async function speakPersona(input: PersonaGenerationInput): Promise<PersonaGenerationOutput> {
  const artifactDescriptions: string[] = [];
  for (const a of input.artifacts || []) {
    if (a.userContext) artifactDescriptions.push(`[Context] ${a.userContext.slice(0,1500)}`);
    if (a.extractedText) artifactDescriptions.push(`[Text] ${a.extractedText.slice(0,8000)}`);
    if (a.transcript) artifactDescriptions.push(`[Transcript] ${a.transcript.slice(0,4000)}`);
    if (a.analysis) artifactDescriptions.push(`[Analysis] ${a.analysis.slice(0,2000)}`);
  }
  const textMaterial = (input.textDocuments || []).join('\n\n');
  const prompt = `You are an empathetic archivist creating a persona for a memorial app. The person: ${input.lovedOneName}.
Evidence: ${textMaterial || '(none)'}
Artifacts: ${artifactDescriptions.length ? artifactDescriptions.join('\n\n') : '(none)'}
Return JSON: { "personalityTraits": [...], "keyBeliefs": [...], "speakingStyle": { "tone": "", "commonPhrases": [], "cadenceDescription": "" }, "overallSummary": "", "exampleDialogues": [...] }`;
  const raw = await ollamaChat(prompt, 'json');
  if (raw) {
    try {
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
      return {
        personalityTraits: parsed.personalityTraits?.length ? parsed.personalityTraits : ['Warm','Loving'],
        keyBeliefs: parsed.keyBeliefs?.length ? parsed.keyBeliefs : ['Family first'],
        speakingStyle: { tone: parsed.speakingStyle?.tone || 'Gentle', commonPhrases: parsed.speakingStyle?.commonPhrases || [], cadenceDescription: parsed.speakingStyle?.cadenceDescription || 'Natural' },
        overallSummary: parsed.overallSummary || 'Remembered with love.',
        exampleDialogues: parsed.exampleDialogues?.length ? parsed.exampleDialogues : ['I am here with you.'],
      };
    } catch {}
  }
  return {
    personalityTraits: ['Caring'], keyBeliefs: ['Family mattered.'],
    speakingStyle: { tone: 'Warm', commonPhrases: [], cadenceDescription: 'Gentle' },
    overallSummary: 'Remembered through stories.',
    exampleDialogues: ['Tell me what you remember.'],
  };
}

/* ---------- Persona conversation (unchanged) ---------- */
export interface ConversationInput {
  personaId: string;
  personaContext: { name: string; summary: string; traits: string[]; phrases: string[]; sourceEvidence?: string[]; voiceProfile?: any; voiceSampleDataUri?: string; };
  userInputText: string; conversationHistory: { role: 'user'|'model'; content: string }[];
}
export async function converseWithPersona(input: ConversationInput): Promise<{ responseText: string }> {
  const evidence = (input.personaContext.sourceEvidence || []).map((e,i) => `[${i+1}] ${e}`).join('\n');
  const history = input.conversationHistory.slice(-6).map(e => `${e.role==='user'?'User':input.personaContext.name}: ${e.content}`).join('\n');
  const prompt = `You are the Echo of ${input.personaContext.name}. Speak in first person.
Persona: ${input.personaContext.summary} Traits: ${input.personaContext.traits.join(', ')} Phrases: ${input.personaContext.phrases.join(', ') || 'none'}
Evidence: ${evidence || 'No detailed evidence – ask for more memories.'}
Conversation: ${history || '(new)'}
User says: "${input.userInputText}"
Respond with 1-2 short, warm sentences. If you don't know, say you don't recall and ask a gentle question.`;
  const res = await ollamaChat(prompt);
  return { responseText: res || "I'm here, listening." };
}

/* ---------- Voicebox TTS integration (via bridge) ---------- */
const BRIDGE_BASE = 'http://localhost:3001'; // Our bridge server

let audioCtx: AudioContext | null = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

export async function cloneVoice(file: File, profileName?: string): Promise<string | null> {
  const fd = new FormData();
  fd.append('file', file);
  if (profileName) fd.append('profileName', profileName);
  try {
    const res = await fetch(`${BRIDGE_BASE}/upload-voice`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Bridge upload failed'));
    const data = await res.json();
    return data.speaker_id || data.profileId || null;
  } catch (e) {
    console.error('cloneVoice failed:', e);
    return null;
  }
}

export async function deleteVoiceboxProfile(profileId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/voice-profile/${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Bridge delete failed'));
    return true;
  } catch (e) {
    console.error('deleteVoiceboxProfile failed:', e);
    return false;
  }
}

async function playVoiceboxTTS(text: string, voiceboxProfileId: string, onStart?:()=>void, onEnd?:()=>void): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceboxProfileId }),
    });
    if (!res.ok) {
      console.error('Bridge /speak failed', res.status);
      return false;
    }
    const arrayBuffer = await res.arrayBuffer();
    ensureAudio(); if (!audioCtx) return false;
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource(); source.buffer = audioBuffer; source.connect(audioCtx.destination);
    source.onended = () => onEnd?.(); source.start(); onStart?.();
    return true;
  } catch (e) {
    console.error('playVoiceboxTTS error:', e);
    return false;
  }
}

function speakBrowserFallback(text: string, onStart?:()=>void, onEnd?:()=>void) {
  if (typeof window==='undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate=0.9; u.pitch=1; u.volume=1;
  const voices = window.speechSynthesis.getVoices();
  const pref = voices.find(v => v.lang.startsWith('en') && /Google US English|Samantha|Ava|Allison/i.test(v.name)) || voices.find(v => v.lang.startsWith('en'));
  if (pref) u.voice = pref;
  u.onstart = () => onStart?.(); u.onend = () => onEnd?.(); u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function initAudioContext() { ensureAudio(); }

export async function speakWithBrowserTTS(
  text: string,
  speakerId?: string,
  opts?: { onStart?:()=>void; onEnd?:()=>void }
) {
  if (speakerId) {
    const ok = await playVoiceboxTTS(text, speakerId, opts?.onStart, opts?.onEnd);
    if (ok) return;
    throw new Error('[Voicebox] TTS failed for cloned voice profile');
  }
  speakBrowserFallback(text, opts?.onStart, opts?.onEnd);
}
