'use client';
import { VOICEBOX_ENGINE } from '@/lib/voicebox-config';
import type { KnowledgeChunk, LovedOne, PersonaArtifact } from '@/lib/mock-data';

const BRIDGE_BASE = 'http://localhost:3001';

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','had','has','he',
  'her','his','i','in','is','it','its','me','my','of','on','or','our',
  'she','that','the','their','them','they','this','to','was','we','were',
  'with','you','your'
]);

let audioCtx: AudioContext | null = null;

/* ─────────────────────────────────────────────────────────────────────────────
   Puter.js AI helper
───────────────────────────────────────────────────────────────────────────── */
const PUTER_MODEL = 'gpt-4o-mini';

async function waitForPuter(timeoutMs = 8000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const p = (window as any).puter;
    if (p?.ai?.chat) return p;
    await new Promise(r => setTimeout(r, 120));
  }
  return null;
}

async function puterChat(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
): Promise<string> {
  try {
    const puter = await waitForPuter();
    if (!puter) {
      console.warn('[Puter] puter.js did not load in time');
      return '';
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ];

    const result = await puter.ai.chat(messages, { model: PUTER_MODEL });

    // Puter can return a string, an object with message.content, or a Response-like object
    let text = '';
    if (typeof result === 'string') {
      text = result;
    } else if (result?.message?.content) {
      text = result.message.content;
    } else if (typeof result?.toString === 'function') {
      const s = result.toString();
      if (s !== '[object Object]') text = s;
    }

    if (jsonMode) {
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    }

    return text.trim();
  } catch (err) {
    console.error('[Puter] chat error:', err);
    return '';
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Text utilities
───────────────────────────────────────────────────────────────────────────── */
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || [])
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function chunkText(text: string, limit = 500): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= limit) return [cleaned];
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (!sentence) continue;
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= limit) { current = next; continue; }
    if (current) chunks.push(current);
    current = sentence;
    while (current.length > limit) {
      chunks.push(current.slice(0, limit));
      current = current.slice(limit).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function extractKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  for (const t of tokenize(text)) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([t]) => t);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Knowledge chunks
───────────────────────────────────────────────────────────────────────────── */
function makeChunk(
  sourceType: KnowledgeChunk['sourceType'],
  sourceName: string,
  text: string,
  index: number,
): KnowledgeChunk {
  return {
    id: `${sourceType}-${sourceName}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    text,
    sourceType,
    sourceName,
    keywords: extractKeywords(text),
  };
}

export function buildKnowledgeChunks(
  profile: Partial<LovedOne> & { memorySnippets?: string[] },
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  const identityFacts = [
    profile.name       ? `Name: ${profile.name}` : '',
    profile.relation   ? `Relationship: ${profile.relation}` : '',
    profile.birthYear  ? `Birth year: ${profile.birthYear}` : '',
    profile.passingYear? `Passing year: ${profile.passingYear}` : '',
    profile.birthPlace ? `Birthplace: ${profile.birthPlace}` : '',
    profile.summary    ? `Summary: ${profile.summary}` : '',
    profile.phrases?.length  ? `Common phrases: ${profile.phrases.join('; ')}` : '',
    profile.beliefs?.length  ? `Beliefs and values: ${profile.beliefs.join('; ')}` : '',
  ].filter(Boolean).join('. ');

  if (identityFacts) {
    chunkText(identityFacts).forEach((text, i) =>
      chunks.push(makeChunk('identity', profile.name || 'identity', text, i)));
  }

  (profile.memorySnippets || []).forEach((memory, i) => {
    chunkText(memory).forEach((text, si) =>
      chunks.push(makeChunk('memory', `memory-${i + 1}`, text, si)));
  });

  (profile.artifacts || []).forEach((artifact, i) => {
    const sourceType = artifact.type === 'text'  ? 'document'
                     : artifact.type === 'audio' ? 'audio'
                     : artifact.type as KnowledgeChunk['sourceType'];
    const fields = [
      artifact.userContext   ? `Family context: ${artifact.userContext}` : '',
      artifact.extractedText ? `Extracted text: ${artifact.extractedText}` : '',
      artifact.transcript    ? `Transcript: ${artifact.transcript}` : '',
      artifact.analysis      ? `Analysis: ${artifact.analysis}` : '',
    ].filter(Boolean).join('\n');
    chunkText(fields, 650).forEach((text, si) =>
      chunks.push(makeChunk(sourceType, artifact.name || `artifact-${i + 1}`, text, si)));
  });

  return chunks;
}

export function buildProfileEvidence(
  profile: Partial<LovedOne> & { memorySnippets?: string[] },
): string[] {
  return buildKnowledgeChunks(profile)
    .map(c => `${c.sourceName}: ${c.text}`)
    .slice(0, 40);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Retrieval
───────────────────────────────────────────────────────────────────────────── */
function scoreChunk(chunk: KnowledgeChunk, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const haystack = `${chunk.text} ${chunk.keywords?.join(' ') || ''}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += chunk.keywords?.includes(token) ? 3 : 1;
  }
  if (chunk.sourceType === 'memory')   score += 0.2;
  if (chunk.sourceType === 'identity') score += 0.1;
  return score;
}

export function retrieveRelevantKnowledge(
  knowledgeChunks: KnowledgeChunk[] | undefined,
  userInputText: string,
  conversationHistory: { role: 'user' | 'model'; content: string }[],
  limit = 8,
): KnowledgeChunk[] {
  const historyText = conversationHistory.slice(-4).map(e => e.content).join(' ');
  const queryTokens = [...new Set(tokenize(`${userInputText} ${historyText}`))];
  const ranked = (knowledgeChunks || [])
    .map(c => ({ c, s: scoreChunk(c, queryTokens) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.c);
  if (ranked.length) return ranked;
  return (knowledgeChunks || []).slice(0, Math.min(limit, knowledgeChunks?.length || 0));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Persona generation (replaces speakPersona / generatePersona)
───────────────────────────────────────────────────────────────────────────── */
export interface PersonaGenerationInput {
  lovedOneName: string;
  textDocuments?: string[];
  artifacts?: PersonaArtifact[];
}

export interface PersonaGenerationOutput {
  personalityTraits: string[];
  keyBeliefs: string[];
  speakingStyle: { tone: string; commonPhrases: string[]; cadenceDescription: string };
  overallSummary: string;
  exampleDialogues: string[];
}

export async function speakPersona(
  input: PersonaGenerationInput,
): Promise<PersonaGenerationOutput> {
  const evidence = [
    ...(input.textDocuments || []),
    ...((input.artifacts || []).flatMap(a => [
      a.userContext   ? `${a.name} context: ${a.userContext}`       : '',
      a.extractedText ? `${a.name} extracted text: ${a.extractedText}` : '',
      a.analysis      ? `${a.name} analysis: ${a.analysis}`         : '',
      a.transcript    ? `${a.name} transcript: ${a.transcript}`     : '',
    ]).filter(Boolean)),
  ].join('\n');

  const system = `You are an empathetic AI archivist helping families preserve the memory of a loved one.
Your job is to deeply analyse ALL provided evidence and build the most accurate, human-sounding memorial persona possible.
Extract every personality nuance, speech habit, value, and quirk you can observe.
Return ONLY valid JSON — no markdown fences, no extra text.`;

  const user = `Build a complete memorial persona for ${input.lovedOneName}.

Evidence:
${evidence || '(none provided)'}

Return this exact JSON shape:
{
  "personalityTraits": ["4 to 6 grounded traits inferred from evidence"],
  "keyBeliefs": ["3 to 5 values or priorities clearly shown in evidence"],
  "speakingStyle": {
    "tone": "one concise description of how they spoke",
    "commonPhrases": ["actual phrases or sentence patterns from evidence"],
    "cadenceDescription": "brief notes on rhythm, warmth, vocabulary level"
  },
  "overallSummary": "3–5 sentence biography written in the third person, grounded entirely in evidence",
  "exampleDialogues": ["5 short first-person lines that sound authentically like this person"]
}`;

  const raw = await puterChat(system, user, true);

  if (raw) {
    try {
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
      return {
        personalityTraits: parsed.personalityTraits?.length ? parsed.personalityTraits : ['Caring', 'Warm'],
        keyBeliefs:        parsed.keyBeliefs?.length        ? parsed.keyBeliefs        : ['Family first'],
        speakingStyle: {
          tone:               parsed.speakingStyle?.tone              || 'Warm and familiar',
          commonPhrases:      parsed.speakingStyle?.commonPhrases     || [],
          cadenceDescription: parsed.speakingStyle?.cadenceDescription || 'Gentle, natural pace',
        },
        overallSummary:  parsed.overallSummary  || `${input.lovedOneName} is remembered through family stories.`,
        exampleDialogues: parsed.exampleDialogues?.length ? parsed.exampleDialogues : ['I am glad you are here with me.'],
      };
    } catch (e) {
      console.error('[Puter] persona JSON parse error:', e, '\nRaw:', raw);
    }
  }

  return {
    personalityTraits: ['Caring', 'Warm'],
    keyBeliefs: ['Family first'],
    speakingStyle: { tone: 'Warm and familiar', commonPhrases: [], cadenceDescription: 'Gentle, natural pace' },
    overallSummary: `${input.lovedOneName} is remembered through family stories.`,
    exampleDialogues: ['I am glad you are here with me.'],
  };
}

// Keep old name as alias so nothing else breaks
export { speakPersona as generatePersona };

/* ─────────────────────────────────────────────────────────────────────────────
   Conversation
───────────────────────────────────────────────────────────────────────────── */
export interface ConversationInput {
  personaId: string;
  personaContext: {
    name: string;
    summary: string;
    traits: string[];
    phrases: string[];
    sourceEvidence?: string[];
    voiceProfile?: any;
    voiceSampleDataUri?: string;
    knowledgeChunks?: KnowledgeChunk[];
  };
  userInputText: string;
  conversationHistory: { role: 'user' | 'model'; content: string }[];
}

export async function converseWithPersona(
  input: ConversationInput,
): Promise<{ responseText: string; evidenceUsed: string[] }> {
  const retrieved = retrieveRelevantKnowledge(
    input.personaContext.knowledgeChunks,
    input.userInputText,
    input.conversationHistory,
  );

  const evidenceText = retrieved
    .map((c, i) => `[${i + 1}] ${c.text}`)
    .join('\n');

  const history = input.conversationHistory
    .slice(-6)
    .map(e => `${e.role === 'user' ? 'Visitor' : input.personaContext.name}: ${e.content}`)
    .join('\n');

  const isGreeting = /^(hi|hello|hey|howdy|good morning|good evening|good afternoon|what\'s up|sup|hiya)\b/i.test(input.userInputText.trim());

  const system = `You are roleplaying as ${input.personaContext.name}, a real person being remembered by their family through a memorial app. You are NOT an AI assistant. You are this specific human being, speaking naturally from memory.

WHO YOU ARE:
${input.personaContext.summary}

YOUR PERSONALITY: ${input.personaContext.traits.join(', ')}
YOUR PHRASES YOU ACTUALLY USED: ${input.personaContext.phrases.join(', ') || '(speak naturally)'}

STRICT RULES — read carefully:
1. NEVER introduce yourself or describe yourself unless directly asked. A real person does not say "Hello, I was a kind adventurous person" — that is bizarre and robotic. Just respond like a human would.
2. NEVER mention that you are an Echo, an AI, a memorial, or anything about the app.
3. On greetings like "hello" or "hi" — just say hi back warmly and naturally. Maybe ask how they are or say it's good to hear from them. ONE or TWO casual sentences max. NO self-description.
4. Only pull from Evidence when the question actually requires a specific memory. For casual conversation, just be natural and warm.
5. Match vocabulary and warmth to the personality traits. If they were formal, be formal. If they were casual and funny, be casual and funny.
6. Keep responses SHORT — 1 to 3 sentences. Real conversations are not essays.
7. Never say "I remember" as an opener every time — vary how you start sentences.
8. If you genuinely don't have evidence for something specific, deflect warmly like a real person would — change the subject, ask them something back, or say you can't quite recall.`;

  const user = `${isGreeting ? '' : `Relevant memories to draw from if needed:
${evidenceText || '(nothing specific found — speak from personality and warmth)'}

`}${history ? `Recent conversation:
${history}

` : ''}${input.personaContext.name} receives this message from a family member: "${input.userInputText}"

Reply as ${input.personaContext.name} would in real life. Be natural, warm, and human. No labels, no self-introduction, no robotic phrasing.`;

  const responseText = await puterChat(system, user);

  return {
    responseText: responseText || "Oh it's so good to hear from you...",
    evidenceUsed: retrieved.map(c => c.text),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Artifact enrichment (text only — no vision model needed)
───────────────────────────────────────────────────────────────────────────── */
export async function enrichArtifacts(
  artifacts: PersonaArtifact[],
): Promise<PersonaArtifact[]> {
  // With Puter we only enrich text artifacts (no image/video upload in new flow)
  return artifacts;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Voice cloning (Voicebox via bridge — unchanged)
───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   Audio / TTS (unchanged)
───────────────────────────────────────────────────────────────────────────── */
function ensureAudio() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

async function playVoiceboxTTS(
  text: string,
  voiceboxProfileId: string,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceboxProfileId, engine: VOICEBOX_ENGINE }),
    });
    if (!res.ok) return false;
    const arrayBuffer = await res.arrayBuffer();
    ensureAudio();
    if (!audioCtx) return false;
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = () => onEnd?.();
    source.start();
    onStart?.();
    return true;
  } catch {
    return false;
  }
}

function speakBrowserFallback(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92; utterance.pitch = 1; utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(v => v.lang.startsWith('en') && /Google US English|Samantha|Ava|Allison/i.test(v.name)) ||
    voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;
  utterance.onstart = () => onStart?.();
  utterance.onend   = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function initAudioContext() { ensureAudio(); }

export async function warmVoiceAndLanguageModels() {
  try { await fetch(`${BRIDGE_BASE}/warmup`, { method: 'POST' }); } catch {}
}

export async function speakWithBrowserTTS(
  text: string,
  speakerId?: string,
  opts?: { onStart?: () => void; onEnd?: () => void },
) {
  if (speakerId) {
    const ok = await playVoiceboxTTS(text, speakerId, opts?.onStart, opts?.onEnd);
    if (ok) return;
    throw new Error('[Voicebox] TTS failed for cloned voice profile');
  }
  speakBrowserFallback(text, opts?.onStart, opts?.onEnd);
}

// Legacy no-op kept for any import that still references it
export function unlockClonedVoiceAudio() {}
