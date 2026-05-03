'use client';

import type { KnowledgeChunk, LovedOne, PersonaArtifact } from '@/lib/mock-data';

const BRIDGE_BASE = 'http://localhost:3001';
const OLLAMA_BASE = 'http://localhost:11434/api';
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'had', 'has', 'he', 'her',
  'his', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'she', 'that',
  'the', 'their', 'them', 'they', 'this', 'to', 'was', 'we', 'were', 'with', 'you', 'your'
]);

let audioCtx: AudioContext | null = null;
let cachedFastModel: string | null = null;
let cachedVisionModel: string | null = null;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(token => token.length > 1 && !STOP_WORDS.has(token));
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
    if (next.length <= limit) {
      current = next;
      continue;
    }
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
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([token]) => token);
}

async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((model: any) => model.name as string);
  } catch {
    return [];
  }
}

async function chooseFastOllamaModel(): Promise<string | null> {
  if (cachedFastModel) return cachedFastModel;
  const models = await listOllamaModels();
  const order = ['llama3.2:1b', 'llama3.2', 'qwen2.5:1.5b', 'phi3', 'gemma2:2b'];
  cachedFastModel = order.find(target => models.some(model => model.startsWith(target))) || models[0] || null;
  return cachedFastModel;
}

async function chooseVisionModel(): Promise<string | null> {
  if (cachedVisionModel) return cachedVisionModel;
  const models = await listOllamaModels();
  const order = ['gemma3', 'llava', 'qwen2.5vl', 'minicpm-v', 'moondream'];
  cachedVisionModel = order.find(target => models.some(model => model.startsWith(target))) || null;
  return cachedVisionModel;
}

async function ollamaGenerate(prompt: string, options?: {
  format?: 'json';
  model?: string | null;
  images?: string[];
  temperature?: number;
  numPredict?: number;
}) {
  const model = options?.model ?? await chooseFastOllamaModel();
  if (!model) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${BRIDGE_BASE}/api/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        images: options?.images,
        stream: false,
        format: options?.format,
        keep_alive: -1,
        options: {
          temperature: options?.temperature ?? (options?.format === 'json' ? 0.15 : 0.2),
          top_p: 0.9,
          num_predict: options?.numPredict ?? 160,
        },
      }),
    });

    if (!res.ok) return '';
    const data = await res.json();
    return (data.response || data.message?.content || '').trim();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeImageArtifact(artifact: PersonaArtifact): Promise<string> {
  const userContext = artifact.userContext?.trim();
  const visionModel = await chooseVisionModel();
  if (!artifact.dataUri) {
    return userContext ? `Family context: ${userContext}` : '';
  }
  if (!visionModel) {
    return userContext
      ? `Family context: ${userContext}. Automated image vision is unavailable on this machine because no Ollama vision model is installed.`
      : '';
  }

  const prompt = `Analyze this family photo for a memorial profile. Describe only observable details that could matter later:
- people, age clues, clothing, setting, objects, text in image, activity, approximate era, mood
- if uncertain, say uncertain
- if family context is provided, combine it carefully without inventing facts
Family context: ${userContext || '(none)'}
Return 5-8 short factual lines.`;

  const result = await ollamaGenerate(prompt, {
    model: visionModel,
    images: [artifact.dataUri.split(',')[1] || artifact.dataUri],
    temperature: 0.1,
    numPredict: 220,
  });

  return result || (userContext ? `Family context: ${userContext}` : '');
}

async function extractVideoFrames(dataUri: string, maxFrames = 3): Promise<string[]> {
  return await new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = dataUri;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const frames: string[] = [];

    video.onloadedmetadata = async () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        resolve([]);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth || 640, 640);
      canvas.height = Math.min(video.videoHeight || 360, 360);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve([]);
        return;
      }

      const points = Array.from({ length: maxFrames }, (_, index) => {
        const ratio = (index + 1) / (maxFrames + 1);
        return Math.max(0, Math.min(video.duration - 0.1, video.duration * ratio));
      });

      const seekTo = (time: number) => new Promise<void>((done) => {
        const handler = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.72));
          video.removeEventListener('seeked', handler);
          done();
        };
        video.addEventListener('seeked', handler, { once: true });
        video.currentTime = time;
      });

      for (const time of points) {
        await seekTo(time);
      }
      resolve(frames);
    };

    video.onerror = () => resolve([]);
  });
}

async function analyzeVideoArtifact(artifact: PersonaArtifact): Promise<string> {
  const userContext = artifact.userContext?.trim();
  if (!artifact.dataUri) return userContext ? `Family context: ${userContext}` : '';

  const visionModel = await chooseVisionModel();
  if (!visionModel) {
    return userContext
      ? `Family context: ${userContext}. Automated video vision is unavailable on this machine because no Ollama vision model is installed.`
      : '';
  }

  const frames = await extractVideoFrames(artifact.dataUri);
  if (!frames.length) return userContext ? `Family context: ${userContext}` : '';

  const descriptions: string[] = [];
  for (const [index, frame] of frames.entries()) {
    const prompt = `Describe this frame from a family video. Focus on people, place, activity, visible text, objects, and emotional tone.
Frame position: ${index + 1} of ${frames.length}
Family context: ${userContext || '(none)'}`;
    const result = await ollamaGenerate(prompt, {
      model: visionModel,
      images: [frame.split(',')[1] || frame],
      temperature: 0.1,
      numPredict: 140,
    });
    if (result) descriptions.push(`Frame ${index + 1}: ${result}`);
  }

  return descriptions.join('\n');
}

export async function enrichArtifacts(artifacts: PersonaArtifact[]): Promise<PersonaArtifact[]> {
  const enriched: PersonaArtifact[] = [];
  for (const artifact of artifacts) {
    let next = { ...artifact };
    if (artifact.type === 'image' && !artifact.analysis) {
      next.analysis = await analyzeImageArtifact(artifact);
    }
    if (artifact.type === 'video' && !artifact.analysis) {
      next.analysis = await analyzeVideoArtifact(artifact);
    }
    enriched.push(next);
  }
  return enriched;
}

function makeChunk(sourceType: KnowledgeChunk['sourceType'], sourceName: string, text: string, index: number): KnowledgeChunk {
  return {
    id: `${sourceType}-${sourceName}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    text,
    sourceType,
    sourceName,
    keywords: extractKeywords(text),
  };
}

export function buildKnowledgeChunks(profile: Partial<LovedOne> & { memorySnippets?: string[] }): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const identityFacts = [
    profile.name ? `Name: ${profile.name}` : '',
    profile.relation ? `Relationship: ${profile.relation}` : '',
    profile.birthYear ? `Birth year: ${profile.birthYear}` : '',
    profile.passingYear ? `Passing year: ${profile.passingYear}` : '',
    profile.birthPlace ? `Birthplace: ${profile.birthPlace}` : '',
    profile.summary ? `Summary: ${profile.summary}` : '',
    profile.phrases?.length ? `Common phrases: ${profile.phrases.join('; ')}` : '',
    profile.beliefs?.length ? `Beliefs and values: ${profile.beliefs.join('; ')}` : '',
  ].filter(Boolean).join('. ');

  if (identityFacts) {
    chunkText(identityFacts).forEach((text, index) => chunks.push(makeChunk('identity', profile.name || 'identity', text, index)));
  }

  (profile.memorySnippets || []).forEach((memory, index) => {
    chunkText(memory).forEach((text, subIndex) => {
      chunks.push(makeChunk('memory', `memory-${index + 1}`, text, subIndex));
    });
  });

  (profile.artifacts || []).forEach((artifact, index) => {
    const sourceType = artifact.type === 'text'
      ? 'document'
      : artifact.type === 'audio'
        ? 'audio'
        : artifact.type;

    const fields = [
      artifact.userContext ? `Family context: ${artifact.userContext}` : '',
      artifact.extractedText ? `Extracted text: ${artifact.extractedText}` : '',
      artifact.transcript ? `Transcript: ${artifact.transcript}` : '',
      artifact.analysis ? `Analysis: ${artifact.analysis}` : '',
    ].filter(Boolean).join('\n');

    chunkText(fields, 650).forEach((text, subIndex) => {
      chunks.push(makeChunk(sourceType, artifact.name || `artifact-${index + 1}`, text, subIndex));
    });
  });

  return chunks;
}

function scoreChunk(chunk: KnowledgeChunk, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const haystack = `${chunk.text} ${chunk.keywords?.join(' ') || ''}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += chunk.keywords?.includes(token) ? 3 : 1;
  }
  if (chunk.sourceType === 'memory') score += 0.2;
  if (chunk.sourceType === 'identity') score += 0.1;
  return score;
}

export function retrieveRelevantKnowledge(
  knowledgeChunks: KnowledgeChunk[] | undefined,
  userInputText: string,
  conversationHistory: { role: 'user' | 'model'; content: string }[],
  limit = 8,
): KnowledgeChunk[] {
  const historyText = conversationHistory.slice(-4).map(item => item.content).join(' ');
  const queryTokens = [...new Set(tokenize(`${userInputText} ${historyText}`))];
  const chunks = (knowledgeChunks || []).map(chunk => ({ chunk, score: scoreChunk(chunk, queryTokens) }));
  const ranked = chunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.chunk);

  if (ranked.length) return ranked;
  return (knowledgeChunks || []).slice(0, Math.min(limit, knowledgeChunks?.length || 0));
}

export function buildProfileEvidence(profile: Partial<LovedOne> & { memorySnippets?: string[] }): string[] {
  const chunks = buildKnowledgeChunks(profile);
  return chunks.map(chunk => `${chunk.sourceName}: ${chunk.text}`).slice(0, 40);
}

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

export async function speakPersona(input: PersonaGenerationInput): Promise<PersonaGenerationOutput> {
  const evidence = [
    ...(input.textDocuments || []),
    ...((input.artifacts || []).flatMap(artifact => [
      artifact.userContext ? `${artifact.name} context: ${artifact.userContext}` : '',
      artifact.extractedText ? `${artifact.name} extracted text: ${artifact.extractedText}` : '',
      artifact.analysis ? `${artifact.name} analysis: ${artifact.analysis}` : '',
      artifact.transcript ? `${artifact.name} transcript: ${artifact.transcript}` : '',
    ]).filter(Boolean)),
  ].join('\n');

  const prompt = `You are building a grounded memorial profile for ${input.lovedOneName}.
Use only the evidence below. Do not invent facts.
Return strict JSON:
{
  "personalityTraits": ["4 to 6 grounded traits"],
  "keyBeliefs": ["3 to 5 grounded values or priorities"],
  "speakingStyle": {
    "tone": "brief description",
    "commonPhrases": ["short phrases actually supported by evidence"],
    "cadenceDescription": "brief style notes"
  },
  "overallSummary": "2 to 4 sentence biography grounded in evidence",
  "exampleDialogues": ["3 short first-person lines that sound like the person"]
}
Evidence:
${evidence || '(none)'}`;

  const raw = await ollamaGenerate(prompt, { format: 'json', numPredict: 220 });
  if (raw) {
    try {
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
      return {
        personalityTraits: parsed.personalityTraits?.length ? parsed.personalityTraits : ['Caring', 'Warm'],
        keyBeliefs: parsed.keyBeliefs?.length ? parsed.keyBeliefs : ['Family first'],
        speakingStyle: {
          tone: parsed.speakingStyle?.tone || 'Warm and familiar',
          commonPhrases: parsed.speakingStyle?.commonPhrases || [],
          cadenceDescription: parsed.speakingStyle?.cadenceDescription || 'Gentle, natural pace',
        },
        overallSummary: parsed.overallSummary || `${input.lovedOneName} is remembered through the family stories saved here.`,
        exampleDialogues: parsed.exampleDialogues?.length ? parsed.exampleDialogues : ['I am glad you are here with me.'],
      };
    } catch {}
  }

  return {
    personalityTraits: ['Caring', 'Warm'],
    keyBeliefs: ['Family first'],
    speakingStyle: { tone: 'Warm and familiar', commonPhrases: [], cadenceDescription: 'Gentle, natural pace' },
    overallSummary: `${input.lovedOneName} is remembered through the family stories saved here.`,
    exampleDialogues: ['I am glad you are here with me.'],
  };
}

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

export async function converseWithPersona(input: ConversationInput): Promise<{ responseText: string; evidenceUsed: string[] }> {
  const retrieved = retrieveRelevantKnowledge(input.personaContext.knowledgeChunks, input.userInputText, input.conversationHistory);
  const evidenceText = retrieved.map((chunk, index) => `[${index + 1}] (${chunk.sourceType}/${chunk.sourceName}) ${chunk.text}`).join('\n');
  const history = input.conversationHistory
    .slice(-4)
    .map(entry => `${entry.role === 'user' ? 'User' : input.personaContext.name}: ${entry.content}`)
    .join('\n');

  const prompt = `You are the Echo of ${input.personaContext.name}. Speak in first person, warmly, and briefly.
You must answer only from the evidence below.
If the evidence is missing, uncertain, or does not support an answer, say you do not remember that detail and ask a gentle follow-up.
Never make up events, relationships, places, or preferences.
Keep the reply to 1 or 2 short sentences.

Evidence:
${evidenceText || '(no evidence found)'}

Conversation:
${history || '(new conversation)'}

User says: "${input.userInputText}"`;

  const responseText = await ollamaGenerate(prompt, {
    temperature: 0.15,
    numPredict: 90,
  });

  return {
    responseText: responseText || "I don't remember enough about that yet. Tell me a little more.",
    evidenceUsed: retrieved.map(chunk => chunk.text),
  };
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

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

async function playVoiceboxTTS(text: string, voiceboxProfileId: string, onStart?:()=>void, onEnd?:()=>void): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceboxProfileId }),
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

function speakBrowserFallback(text: string, onStart?:()=>void, onEnd?:()=>void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(voice => voice.lang.startsWith('en') && /Google US English|Samantha|Ava|Allison/i.test(voice.name))
    || voices.find(voice => voice.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function initAudioContext() {
  ensureAudio();
}

export async function warmVoiceAndLanguageModels() {
  try {
    await fetch(`${BRIDGE_BASE}/warmup`, { method: 'POST' });
  } catch {}
}

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
