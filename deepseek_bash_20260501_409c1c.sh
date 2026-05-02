#!/usr/bin/env bash
# Save this as a script or paste directly into terminal (CTRL+SHIFT+V to paste)
# Ensure you are in the project root directory.

set -e

echo "🔧 Setting up free offline Echoes…"

# 1. Create missing directories
mkdir -p src/lib src/app/profile/new src/app/profile/[id]/src

# 2. Create the new local AI module
cat > src/lib/local-ai.ts << 'ENDLOCALAI'
'use client';

import type { LovedOne, PersonaArtifact } from '@/lib/mock-data';

/* --------------------------------- Helpers --------------------------------- */

async function chooseOllamaModel(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) return null;
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);
    // Prefer capable models
    const order = ['llama3.2', 'qwen2.5', 'mistral', 'gemma2', 'phi3'];
    return order.find(m => models.some(n => n.startsWith(m))) || models[0] || null;
  } catch {
    return null;
  }
}

async function ollamaChat(prompt: string, format?: 'json'): Promise<string> {
  const model = await chooseOllamaModel();
  if (!model) return '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
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
    if (!res.ok) return '';
    const data = await res.json();
    return (data.response || data.message?.content || '').trim();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------- Persona generation ------------------------------ */

interface PersonaGenerationInput {
  lovedOneName: string;
  textDocuments?: string[];
  imageDataUris?: string[];
  videoDataUris?: string[];
  audioDataUris?: string[];
  artifacts?: PersonaArtifact[];
}

interface PersonaGenerationOutput {
  personalityTraits: string[];
  keyBeliefs: string[];
  speakingStyle: {
    tone: string;
    commonPhrases: string[];
    cadenceDescription: string;
  };
  overallSummary: string;
  exampleDialogues: string[];
}

export async function generatePersona(input: PersonaGenerationInput): Promise<PersonaGenerationOutput> {
  // Build artifact descriptions
  const artifactDescriptions: string[] = [];
  for (const a of input.artifacts || []) {
    if (a.userContext) artifactDescriptions.push(`[User context for ${a.name}] ${a.userContext.slice(0, 1500)}`);
    if (a.extractedText) artifactDescriptions.push(`[Text from ${a.name}] ${a.extractedText.slice(0, 8000)}`);
    if (a.transcript) artifactDescriptions.push(`[Audio transcript ${a.name}] ${a.transcript.slice(0, 4000)}`);
    if (a.analysis) artifactDescriptions.push(`[Media analysis ${a.name}] ${a.analysis.slice(0, 2000)}`);
  }

  const textMaterial = (input.textDocuments || []).join('\n\n');

  const prompt = `You are an empathetic archivist creating a persona for a memorial app. The person is: ${input.lovedOneName}.

Below are all the materials provided by their family. Extract every detail possible and build a rich, grounded persona.

Family’s written notes:
${textMaterial || '(none)'}

Artifacts and extracted content:
${artifactDescriptions.length ? artifactDescriptions.join('\n\n') : '(none)'}

Important rules:
- Use only information that appears in the evidence. Do not invent facts.
- If something is unclear, note it as an inference with low confidence.
- Highlight contradictions or unresolved details.
- The persona should feel warm, real, and conversational.

Return a JSON object with this exact structure (nothing else):
{
  "personalityTraits": ["list of 4-7 specific traits derived from the evidence"],
  "keyBeliefs": ["list of 3-5 core beliefs or values"],
  "speakingStyle": {
    "tone": "brief description of their tone (e.g., gentle, fiery, poetic)",
    "commonPhrases": ["phrases they often said"],
    "cadenceDescription": "how they speak – rhythm, pace, pauses, accent hints"
  },
  "overallSummary": "2-4 sentences summarizing their life and character, grounded in the material",
  "exampleDialogues": ["3-4 realistic first-person sentences they would say"]
}`;

  // Ollama call (JSON mode)
  const raw = await ollamaChat(prompt, 'json');
  if (raw) {
    try {
      // Try parsing the JSON output
      const jsonStr = raw.match(/\{[\s\S]*\}/g)?.[0] || raw;
      const parsed = JSON.parse(jsonStr);
      return {
        personalityTraits: parsed.personalityTraits?.length ? parsed.personalityTraits : ['Warm', 'Loving'],
        keyBeliefs: parsed.keyBeliefs?.length ? parsed.keyBeliefs : ['Family is everything'],
        speakingStyle: {
          tone: parsed.speakingStyle?.tone || 'Gentle and warm',
          commonPhrases: parsed.speakingStyle?.commonPhrases || [],
          cadenceDescription: parsed.speakingStyle?.cadenceDescription || 'Natural, conversational pace with gentle pauses',
        },
        overallSummary: parsed.overallSummary || `${input.lovedOneName} is remembered with love.`,
        exampleDialogues: parsed.exampleDialogues?.length ? parsed.exampleDialogues : ['I am here with you.'],
      };
    } catch {}
  }

  // Fallback – still better than before
  const traits = textMaterial.match(/(?:loving|kind|strong|funny|gentle|wise|brave|creative|warm|thoughtful)/gi) || [];
  return {
    personalityTraits: [...new Set(traits)].slice(0,5) || ['Caring'],
    keyBeliefs: ['Family mattered deeply to them.'],
    speakingStyle: {
      tone: 'Warm and familiar',
      commonPhrases: [],
      cadenceDescription: 'Gentle, unhurried speech',
    },
    overallSummary: `${input.lovedOneName} is remembered through the stories shared by family.`,
    exampleDialogues: ['Tell me what you remember.', "I'm glad you're here."],
  };
}

/* -------------------- Persona conversation (TTS only) -------------------- */

export interface ConversationInput {
  personaId: string;
  personaContext: {
    name: string;
    summary: string;
    traits: string[];
    phrases: string[];
    sourceEvidence?: string[];
    voiceProfile?: {
      hasReferenceAudio: boolean;
      accent: string;
      styleNotes: string;
    };
    voiceSampleDataUri?: string;
  };
  userInputText: string;
  conversationHistory: { role: 'user' | 'model'; content: string }[];
}

export interface ConversationOutput {
  responseText: string;
  responseAudio?: HTMLAudioElement; // Not used now – we use browser speech synthesis
}

export async function converseWithPersona(input: ConversationInput): Promise<ConversationOutput> {
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

  let responseText = "I'm here, listening.";
  const ollamaRes = await ollamaChat(prompt);
  if (ollamaRes) {
    responseText = ollamaRes;
  }

  // No audio file returned – caller will use browser TTS
  return { responseText };
}

/* ---------------- Browser TTS helper (used in components) ---------------- */

export function speakWithBrowserTTS(text: string, options?: {
  onStart?: () => void;
  onEnd?: () => void;
}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;       // slightly slower for naturalness
  utterance.pitch = 1.0;
  utterance.volume = 1;

  // Try to pick a high-quality English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith('en') &&
    /Google US English|Samantha|Ava|Allison/i.test(v.name)
  ) || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => options?.onStart?.();
  utterance.onend = () => options?.onEnd?.();

  window.speechSynthesis.speak(utterance);
}
ENDLOCALAI

echo "✅ lib/local-ai.ts created"

# 3. Create local storage module (no Puter)
cat > src/lib/storage.ts << 'ENDSTORAGE'
'use client';

import type { LovedOne } from '@/lib/mock-data';

const STORAGE_KEY = 'echo_profiles_v3';
const DB_NAME = 'echoes_profile_vault';
const DB_VERSION = 1;
const DB_STORE = 'kv';
const DB_PROFILES_KEY = 'profiles';

/* --------------------- IndexedDB helpers --------------------- */
function openProfileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readProfilesFromIndexedDb(): Promise<LovedOne[]> {
  try {
    const db = await openProfileDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(DB_PROFILES_KEY);
      req.onsuccess = () => resolve(req.result ? (Array.isArray(req.result) ? req.result : []) : []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

async function writeProfilesToIndexedDb(profiles: LovedOne[]): Promise<boolean> {
  try {
    const db = await openProfileDb();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(profiles, DB_PROFILES_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
    });
  } catch {
    return false;
  }
}

/* ---------------- Lightweight localStorage mirror --------------- */
function stripLargeFields(profile: LovedOne): LovedOne {
  return {
    ...profile,
    artifacts: profile.artifacts?.map(({ dataUri, ...rest }) => ({
      ...rest,
      dataUri: rest.type === 'image' ? dataUri : '', // keep only images
    })),
    voiceSampleDataUri: profile.voiceSampleDataUri ? '' : undefined,
  };
}

function notifySync(profiles: LovedOne[]) {
  window.dispatchEvent(new CustomEvent('profile-updated'));
  window.dispatchEvent(new StorageEvent('storage', {
    key: STORAGE_KEY,
    newValue: JSON.stringify(profiles.map(stripLargeFields)),
  }));
}

/* ------------------ Public API ------------------ */
export async function saveProfile(profileData: LovedOne): Promise<boolean> {
  let profiles = await getProfiles();
  const idx = profiles.findIndex(p => p.id === profileData.id);
  if (idx !== -1) profiles[idx] = profileData;
  else profiles.push(profileData);

  const success = await writeProfilesToIndexedDb(profiles);
  if (success) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.map(stripLargeFields)));
    notifySync(profiles);
  }
  return success;
}

export async function getProfiles(): Promise<LovedOne[]> {
  const indexed = await readProfilesFromIndexedDb();
  if (indexed.length) return indexed;
  // fallback to localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored) as LovedOne[]; } catch {}
  }
  return [];
}

export async function getProfileById(id: string): Promise<LovedOne | null> {
  const profiles = await getProfiles();
  return profiles.find(p => p.id === id) ?? null;
}

export async function deleteProfile(id: string): Promise<boolean> {
  const profiles = (await getProfiles()).filter(p => p.id !== id);
  const success = await writeProfilesToIndexedDb(profiles);
  if (success) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.map(stripLargeFields)));
    notifySync(profiles);
  }
  return success;
}
ENDSTORAGE

echo "✅ lib/storage.ts created"

# 4. Update the CreateProfile page
cat > src/app/profile/new/page.tsx << 'ENDNEWPAGE'
"use client";

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Users, Check, Loader2, Sparkles, Image as ImageIcon,
  Video, FileText, Plus, X, AlertCircle, Mic
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PersonaArtifact } from '@/lib/mock-data';
import { generatePersona } from '@/lib/local-ai';
import { saveProfile, getProfileById } from '@/lib/storage';
import { buildProfileEvidence } from '@/lib/local-ai';

function CreateProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editId = searchParams.get('edit');
  const isEditing = Boolean(editId);

  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Weaving together their memories...");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', birthYear: '', passingYear: '', relation: '',
    birthPlace: '', personality: '', phrases: '', hasAccent: false
  });

  const [memories, setMemories] = useState<{type: string, content: string}[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [artifacts, setArtifacts] = useState<PersonaArtifact[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Load existing profile for editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const existing = await getProfileById(editId);
      if (!existing) { toast({ title: "Profile not found", variant: "destructive" }); router.push('/'); return; }
      setFormData({
        name: existing.name || '', birthYear: String(existing.birthYear || ''),
        passingYear: String(existing.passingYear || ''), relation: existing.relation || '',
        birthPlace: existing.birthPlace || '', personality: existing.summary || '',
        phrases: (existing.phrases || []).join(', '), hasAccent: Boolean(existing.voiceProfile?.hasReferenceAudio),
      });
      setMemories(((existing as any).memorySnippets || []).map((content: string) => ({ type: 'text', content })));
      setArtifacts(existing.artifacts || []);
    })();
  }, [editId, router, toast]);

  useEffect(() => { setValidationError(null); }, [formData, memories, artifacts]);

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setMemories([...memories, { type: 'text', content: newMemory.trim() }]);
    setNewMemory('');
  };

  const removeMemory = (index: number) => setMemories(memories.filter((_, i) => i !== index));

  const resizeImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const max = 800;
        if (w > h && w > max) { h *= max/w; w = max; }
        else if (h > max) { w *= max/h; h = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  const readAsDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const extractTextFromFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (file.type.startsWith('text/') || ['txt','md','csv','json'].includes(ext || '')) return file.text();
    if (ext === 'pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str || '').join(' ') + '\n';
      }
      return text.trim();
    }
    if (ext === 'docx') {
      const mammoth = await import('mammoth/mammoth.browser');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value.trim();
    }
    return `[Unsupported file type: ${file.name}]`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      setUploadStatus(`Reading ${file.name}...`);
      let type: 'image' | 'video' | 'audio' | 'text' = 'text';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      try {
        const dataUri = await readAsDataUri(file);
        const extracted = (type === 'text' || type === 'audio') ? await extractTextFromFile(file) : '';
        setArtifacts(prev => [...prev, {
          type, name: file.name, dataUri: type === 'image' ? await resizeImage(file) : dataUri,
          extractedText: extracted || undefined, size: file.size, mimeType: file.type,
        }]);
      } catch (err) {
        console.error(err);
        toast({ title: "Upload Failed", description: `Could not process ${file.name}.`, variant: "destructive" });
      }
    }
    setUploadStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeArtifact = (idx: number) => setArtifacts(prev => prev.filter((_, i) => i !== idx));
  const updateArtifactContext = (idx: number, context: string) => setArtifacts(prev => prev.map((a,i) => i===idx ? {...a, userContext: context} : a));

  const validateStep = () => {
    if (step === 1) {
      if (!formData.name.trim()) return "Please enter their full name.";
      if (!formData.birthYear) return "Please enter their birth year.";
      if (!formData.passingYear) return "Please enter the year they passed away.";
      if (!formData.relation) return "Please select your relationship to them.";
      if (!formData.personality.trim() || formData.personality.length < 10) return "Please provide a brief description of their personality (at least 10 characters).";
    }
    if (step === 2) {
      if (memories.length === 0 && artifacts.length === 0) return "Please share at least one memory or upload an artifact.";
    }
    return null;
  };

  const handleNext = async () => {
    const error = validateStep();
    if (error) { setValidationError(error); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (step < 4) { setStep(step+1); return; }

    setIsProcessing(true);
    setProcessingStatus("Generating their Echo with local AI (Ollama)…");
    try {
      const textDocs = [
        `Name: ${formData.name}`,
        `Relation: ${formData.relation}`,
        `Personality: ${formData.personality}`,
        `Phrases: ${formData.phrases}`,
        `Birthplace: ${formData.birthPlace}`,
        ...memories.map(m => `Memory: ${m.content}`)
      ];

      const imageUris = artifacts.filter(a => a.type === 'image').map(a => a.dataUri);
      // We don't use image/video URIs directly with Ollama (text only), so artifacts are only for text extraction
      const personaData = await generatePersona({
        lovedOneName: formData.name,
        textDocuments: textDocs,
        artifacts,
        imageDataUris: imageUris.length ? imageUris : undefined, // optional
      });

      const profile = {
        id: editId || `profile-${Date.now()}`,
        name: formData.name,
        birthYear: parseInt(formData.birthYear) || 0,
        passingYear: parseInt(formData.passingYear) || 0,
        relation: formData.relation || 'Loved One',
        avatarUrl: imageUris[0] || `https://picsum.photos/seed/${formData.name}/600/600`,
        traits: personaData.personalityTraits,
        summary: personaData.overallSummary,
        birthPlace: formData.birthPlace || 'Unknown',
        languages: ['English'],
        occupation: 'Family Member',
        phrases: personaData.speakingStyle.commonPhrases.length ? personaData.speakingStyle.commonPhrases : formData.phrases.split(',').map(s => s.trim()).filter(Boolean),
        beliefs: personaData.keyBeliefs,
        events: [],
        exampleDialogues: personaData.exampleDialogues,
        memorySnippets: memories.map(m => m.content),
        artifacts,
        voiceSampleDataUri: artifacts.find(a => a.type === 'audio')?.dataUri,
        voiceSampleName: artifacts.find(a => a.type === 'audio')?.name,
        voiceProfile: {
          hasReferenceAudio: artifacts.some(a => a.type === 'audio'),
          accent: artifacts.some(a => a.type === 'audio') ? 'Reference audio uploaded' : 'US English',
          styleNotes: personaData.speakingStyle.cadenceDescription,
        },
      };

      const success = await saveProfile(profile);
      if (success) {
        toast({ title: isEditing ? "Echo Updated" : "Echo Created", description: "Their memory is now preserved in your family vault." });
        router.push(isEditing ? `/profile/${editId}` : '/');
      } else {
        throw new Error("Could not save profile.");
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Processing Error", description: "The AI service may be offline. Make sure Ollama is running.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const steps = [
    { id: 1, title: 'Identity' },
    { id: 2, title: 'Memories' },
    { id: 3, title: 'Invite' },
    { id: 4, title: 'Review' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-24 px-8 flex items-center justify-between glass sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-white/5">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent animate-pulse" />
          <h1 className="font-bold tracking-[0.1em] text-lg uppercase text-white/90">{isEditing ? 'Editing an Echo' : 'Creating an Echo'}</h1>
        </div>
        <div className="w-12" />
      </header>

      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload}
        accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-10 py-20 space-y-12">
        {/* Step indicators */}
        <div className="flex items-center justify-between relative px-6">
          <div className="absolute top-5 left-0 right-0 h-px bg-white/10 -z-10 mx-16" />
          {steps.map(s => (
            <div key={s.id} className="flex flex-col items-center gap-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step >= s.id ? 'bg-accent text-accent-foreground scale-110 shadow-[0_0_20px_rgba(82,224,224,0.4)]' : 'bg-white/5 text-muted-foreground')}>
                {step > s.id ? <Check className="w-5 h-5" /> : s.id}
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", step >= s.id ? 'text-white' : 'text-muted-foreground')}>{s.title}</span>
            </div>
          ))}
        </div>

        {validationError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-16 py-24 text-center animate-in fade-in duration-1000">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-[80px] animate-pulse" />
              <Loader2 className="w-24 h-24 text-accent animate-spin relative" />
            </div>
            <div className="space-y-6 max-w-md">
              <h2 className="text-4xl font-bold tracking-tight text-white">Building their Echo</h2>
              <p className="text-muted-foreground italic text-lg font-medium animate-pulse">{processingStatus}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            {/* Step 1: Identity */}
            {step === 1 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold text-white tracking-tight">{isEditing ? 'Update their identity' : 'Who were they?'}</h2>
                {/* ... (the same form fields as before, kept intact) ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-5 md:col-span-2">
                    <Label>Full Name *</Label>
                    <Input placeholder="Margaret Smith" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label>Birth Year *</Label>
                    <Input type="number" placeholder="1945" value={formData.birthYear} onChange={e => setFormData({...formData, birthYear: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label>Passing Year *</Label>
                    <Input type="number" placeholder="2020" value={formData.passingYear} onChange={e => setFormData({...formData, passingYear: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label>Relationship *</Label>
                    <Select value={formData.relation} onValueChange={v => setFormData({...formData, relation: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-16 rounded-2xl px-6"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grandfather">Grandfather</SelectItem>
                        <SelectItem value="Grandmother">Grandmother</SelectItem>
                        <SelectItem value="Father">Father</SelectItem>
                        <SelectItem value="Mother">Mother</SelectItem>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-5">
                    <Label>Birthplace</Label>
                    <Input placeholder="Dublin, Ireland" value={formData.birthPlace} onChange={e => setFormData({...formData, birthPlace: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5 md:col-span-2">
                    <Label>Their Personality *</Label>
                    <Textarea placeholder="Who were they?" value={formData.personality} onChange={e => setFormData({...formData, personality: e.target.value})} className="bg-white/5 border-white/10 min-h-[160px] rounded-[2rem] text-xl p-8" />
                  </div>
                  <div className="space-y-5 md:col-span-2">
                    <Label>Signature Phrases</Label>
                    <Input placeholder="e.g. 'Right as rain'" value={formData.phrases} onChange={e => setFormData({...formData, phrases: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Memories & Artifacts */}
            {step === 2 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold text-white tracking-tight">{isEditing ? 'Add more memories' : 'Share their memories'}</h2>
                <div className="space-y-8">
                  <Label>Memory Snippets</Label>
                  <div className="flex gap-3">
                    <Input placeholder="Add a memory..." value={newMemory} onChange={e => setNewMemory(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMemory()} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6 text-lg" />
                    <Button onClick={addMemory} className="h-16 w-16 rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="w-8 h-8" /></Button>
                  </div>
                  <div className="grid gap-4">
                    {memories.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl group animate-in slide-in-from-right-4">
                        <p className="text-lg text-white/90 italic">"{m.content}"</p>
                        <Button variant="ghost" size="icon" onClick={() => removeMemory(idx)} className="opacity-0 group-hover:opacity-100 hover:text-destructive"><X className="w-5 h-5" /></Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[{icon: ImageIcon, label: 'Photos'}, {icon: Video, label: 'Videos'}, {icon: Mic, label: 'Voice'}, {icon: FileText, label: 'Docs'}].map(({icon: Ic, label}) => (
                    <button key={label} onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group">
                      <Ic className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">{label}</span>
                    </button>
                  ))}
                </div>
                {uploadStatus && <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent font-medium animate-pulse">{uploadStatus}</div>}
                {artifacts.length > 0 && (
                  <div className="space-y-6">
                    <Label>Artifacts Collection</Label>
                    <div className="grid grid-cols-1 gap-4">
                      {artifacts.map((a, idx) => (
                        <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-xl group space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                              {a.type === 'image' ? <ImageIcon className="w-5 h-5" /> : a.type === 'video' ? <Video className="w-5 h-5" /> : a.type === 'audio' ? <Mic className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-sm font-medium text-white truncate">{a.name}</p>
                              <p className="text-[10px] uppercase text-muted-foreground">{a.type}{a.extractedText ? ` • ${a.extractedText.length.toLocaleString()} chars` : ''}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeArtifact(idx)} className="opacity-0 group-hover:opacity-100 hover:text-destructive"><X className="w-4 h-4" /></Button>
                          </div>
                          {(a.type === 'image' || a.type === 'video') && (
                            <Textarea value={a.userContext || ''} onChange={e => updateArtifactContext(idx, e.target.value)} placeholder="Add context…" className="bg-black/20 border-white/10 min-h-24 rounded-xl text-sm" />
                          )}
                          {a.extractedText && (
                            <div className="rounded-lg border p-3 text-xs leading-relaxed bg-accent/5 border-accent/15 text-accent/80 max-h-40 overflow-y-auto">
                              {a.extractedText.slice(0, 1000)}{a.extractedText.length > 1000 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Invite (static) */}
            {step === 3 && (
              <div className="space-y-12 text-center">
                <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-10 shadow-2xl"><Users className="w-12 h-12 text-accent" /></div>
                <h2 className="text-5xl font-bold text-white tracking-tight">Invite the family</h2>
                <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Remembrance is a shared journey."</p>
                <div className="bg-white/[0.02] p-12 rounded-[3rem] border border-white/10 space-y-10 shadow-2xl max-w-lg mx-auto">
                  <Label>Private Vault Link</Label>
                  <div className="flex gap-3">
                    <Input readOnly value={`echoes.app/invite/v${Date.now().toString(36)}`} className="bg-black/40 border-white/10 h-14 font-mono text-sm px-6 rounded-xl" />
                    <Button onClick={() => { navigator.clipboard.writeText(`echoes.app/invite/v${Date.now().toString(36)}`); toast({ title: "Link Copied" }); }} className="bg-accent text-accent-foreground px-10 font-bold h-14 rounded-xl shadow-xl hover:bg-accent/90">Copy</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold text-white tracking-tight">Final Look</h2>
                <div className="p-12 rounded-[3.5rem] bg-white/[0.02] border border-white/10 space-y-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                  <div className="flex items-center gap-8 relative z-10">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-primary/20 overflow-hidden border-2 border-primary/40">
                      {artifacts.find(a => a.type === 'image')?.dataUri ? (
                        <img src={artifacts.find(a => a.type === 'image')!.dataUri} className="object-cover w-full h-full" alt="" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mt-10" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-4xl font-bold text-white tracking-tight">{formData.name}</h3>
                      <p className="text-accent text-sm font-bold uppercase tracking-[0.3em]">{formData.relation} • {formData.birthYear} — {formData.passingYear}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-6 pt-8">
              {step > 1 && <Button variant="ghost" size="lg" className="flex-1 rounded-full h-18 text-muted-foreground font-bold uppercase tracking-widest text-xs" onClick={() => setStep(step-1)}>Back</Button>}
              <Button size="lg" className="flex-[2] bg-accent text-accent-foreground hover:bg-accent/90 rounded-full h-18 text-lg font-bold shadow-2xl transition-all hover:scale-[1.03] active:scale-95" onClick={handleNext} disabled={isProcessing}>
                {step === 4 ? (isProcessing ? 'Processing...' : isEditing ? 'Update their Echo' : 'Build their Echo') : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CreateProfile() {
  return <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>}>
    <CreateProfileForm />
  </Suspense>;
}
ENDNEWPAGE

echo "✅ CreateProfile page updated"

# 5. Update ProfileDetail page (speak/chat)
cat > src/app/profile/\[id\]/page.tsx << 'ENDPROFILED'
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, ArrowLeft, Share2, Calendar, MapPin, Sparkles, BookOpen, Quote, Volume2, Pencil, Trash2 } from "lucide-react";
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EchoOrb } from '@/components/echo-orb';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { getProfileById, deleteProfile } from '@/lib/storage';
import { converseWithPersona, speakWithBrowserTTS } from '@/lib/local-ai';
import { buildProfileEvidence } from '@/lib/local-ai';
import type { LovedOne } from '@/lib/mock-data';

export default function ProfileDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [person, setPerson] = useState<LovedOne | null>(null);
  const [activeTab, setActiveTab] = useState("story");
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([]);

  const recognitionRef = useRef<any>(null);

  // Load profile
  useEffect(() => {
    (async () => {
      const found = await getProfileById(id as string);
      if (found) {
        // ensure evidence exists
        if (!found.sourceEvidence) {
          found.sourceEvidence = buildProfileEvidence(found as any);
        }
        setPerson(found);
      } else {
        toast({ title: "Profile not found", variant: "destructive" });
        router.push('/');
      }
    })();
  }, [id, router, toast]);

  const handleAIResponse = useCallback(async (text: string) => {
    if (!person) return;
    setOrbState('thinking');
    try {
      const result = await converseWithPersona({
        personaId: person.id,
        personaContext: {
          name: person.name,
          summary: person.summary,
          traits: person.traits || [],
          phrases: person.phrases || [],
          sourceEvidence: person.sourceEvidence || [],
          voiceProfile: person.voiceProfile,
          voiceSampleDataUri: person.voiceSampleDataUri,
        },
        userInputText: text,
        conversationHistory: chatHistory,
      });

      setLastResponse(result.responseText);
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'model', content: result.responseText }
      ]);

      // Speak via browser TTS
      speakWithBrowserTTS(result.responseText, {
        onStart: () => setOrbState('speaking'),
        onEnd: () => setOrbState('idle'),
      });
    } catch (err) {
      console.error(err);
      setOrbState('idle');
      toast({ title: "Connection Interrupted", variant: "destructive" });
    }
  }, [person, chatHistory, toast]);

  // Web Speech setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setOrbState('listening');
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) handleAIResponse(transcript);
        };
        recognition.onerror = (event: any) => {
          console.error(event.error);
          setOrbState('idle');
          if (event.error === 'not-allowed') {
            toast({ title: "Microphone Access Denied", variant: "destructive" });
          }
        };
        recognition.onend = () => setOrbState(prev => (prev === 'listening' ? 'idle' : prev));
        recognitionRef.current = recognition;
      }
    }
    return () => { recognitionRef.current?.stop(); window.speechSynthesis.cancel(); };
  }, [handleAIResponse, toast]);

  const handleSpeak = () => {
    if (orbState === 'speaking') {
      window.speechSynthesis.cancel();
      setOrbState('idle');
      return;
    }
    if (orbState === 'listening') {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast({ title: "Speech Not Supported", description: "Your browser doesn't support voice recognition.", variant: "destructive" });
        return;
      }
      setOrbState('listening');
      recognitionRef.current.start();
    }
  };

  const handleDelete = async () => {
    if (!person) return;
    if (!confirm(`Delete ${person.name}'s Echo?`)) return;
    const deleted = await deleteProfile(person.id);
    if (deleted) {
      toast({ title: "Echo Deleted" });
      router.push('/');
    } else {
      toast({ title: "Delete Failed", variant: "destructive" });
    }
  };

  if (!person) return <div className="min-h-screen flex items-center justify-center"><div className="w-20 h-20 border-4 border-accent/20 border-t-accent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-24 px-8 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full bg-white/5 border border-white/5 hover:bg-accent/10 hover:text-accent">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-bold text-2xl tracking-tight text-white">{person.name}</h2>
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">{person.relation}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/profile/new?edit=${person.id}`)} className="rounded-full bg-white/5 border border-white/5 hover:text-accent"><Pencil className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDelete} className="rounded-full bg-white/5 border border-white/5 hover:text-destructive"><Trash2 className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" className="rounded-full bg-white/5 border border-white/5 hover:text-accent"><Share2 className="w-5 h-5" /></Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <div className="flex justify-center py-8 glass bg-white/[0.01]">
            <TabsList className="bg-white/5 rounded-full p-1.5 border border-white/5 h-14">
              <TabsTrigger value="story" className="rounded-full px-10 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-bold uppercase tracking-widest">
                <BookOpen className="w-4 h-4 mr-3" /> Their Story
              </TabsTrigger>
              <TabsTrigger value="speak" className="rounded-full px-10 h-full data-[state=active]:bg-accent data-[state=active]:text-accent-foreground transition-all text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-4 h-4 mr-3" /> Speak With Them
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="story" className="flex-1 max-w-7xl mx-auto w-full px-10 py-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Display the same story content as before (image, summary, traits, beliefs, phrases) */}
            <div className="grid lg:grid-cols-12 gap-20">
              <div className="lg:col-span-4 space-y-16">
                <div className="relative aspect-[3/4] rounded-[3.5rem] overflow-hidden border-2 border-primary shadow-[0_0_80px_rgba(0,0,0,0.6)] group">
                  <Image src={person.avatarUrl} alt={person.name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100" data-ai-hint="portrait elderly" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                </div>
                <div className="space-y-10 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5">
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent flex items-center gap-3"><Sparkles className="w-4 h-4" /> The Snapshot</h3>
                    <div className="space-y-5">
                      <div className="flex items-center gap-4 text-muted-foreground"><Calendar className="w-5 h-5 text-primary" /><span>{person.birthYear} — {person.passingYear}</span></div>
                      <div className="flex items-center gap-4 text-muted-foreground"><MapPin className="w-5 h-5 text-primary" /><span>{person.birthPlace}</span></div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Personality Traits</h3>
                    <div className="flex flex-wrap gap-2.5">{(person.traits || []).map(trait => <span key={trait} className="text-[10px] px-4 py-1.5 rounded-full bg-primary/20 text-white/70 border border-white/10 uppercase font-bold">{trait}</span>)}</div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-8 space-y-20">
                <section className="space-y-10 relative">
                  <Quote className="absolute -top-10 -left-12 w-24 h-24 text-accent/5 -z-10" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">AI Biography</h3>
                  <p className="text-2xl font-medium leading-relaxed text-white/90 italic first-letter:text-6xl first-letter:font-bold first-letter:mr-4 first-letter:float-left first-letter:text-accent">{person.summary}</p>
                </section>
                {person.beliefs?.length > 0 && (
                  <section className="space-y-10">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Core Values</h3>
                    <div className="grid gap-5">
                      {person.beliefs.map((belief, idx) => (
                        <div key={idx} className="p-8 bg-white/[0.02] rounded-[2rem] border border-white/5 flex gap-6 items-start group hover:bg-white/[0.04] transition-all duration-500">
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 text-xs font-bold">{idx+1}</div>
                          <p className="text-xl text-white/80 font-medium">{belief}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {person.phrases?.length > 0 && (
                  <section className="space-y-10">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Common Phrases</h3>
                    <div className="flex flex-wrap gap-5">
                      {person.phrases.map((phrase, idx) => (
                        <div key={idx} className="px-8 py-5 bg-primary/10 rounded-[2rem] border border-primary/20 italic text-white/60 text-lg hover:text-white transition-colors cursor-default">"{phrase}"</div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="speak" className="flex-1 flex flex-col items-center justify-center relative animate-in zoom-in-95 duration-1000 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-accent/5 rounded-full blur-[200px] opacity-40 animate-pulse-slow" /></div>
            <div className="z-10 flex flex-col items-center gap-12 max-w-3xl text-center px-10">
              <EchoOrb state={orbState} />
              <div className="h-48 flex items-center justify-center w-full">
                {orbState === 'idle' && <p className="text-muted-foreground/40 text-sm tracking-[0.4em] uppercase font-bold animate-pulse">Tap the microphone to speak</p>}
                {orbState === 'listening' && <div className="flex flex-col items-center gap-6"><p className="text-accent text-2xl font-bold tracking-[0.3em] uppercase"><span className="w-3 h-3 rounded-full bg-accent animate-ping" /> Listening</p></div>}
                {orbState === 'thinking' && <div className="flex flex-col items-center gap-6"><p className="text-muted-foreground italic text-2xl font-medium">Recalling memories...</p><div className="flex gap-2"><div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" /><div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" /><div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" /></div></div>}
                {orbState === 'speaking' && lastResponse && <div className="flex flex-col items-center gap-6"><p className="text-4xl text-white/95 font-medium italic leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-2xl">"{lastResponse}"</p><div className="flex items-center gap-3 text-accent/40"><Volume2 className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-[0.3em]">Speaking</span></div></div>}
              </div>
              <button onClick={handleSpeak} disabled={orbState === 'thinking'} className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 border-2 relative group",
                orbState === 'listening' ? "bg-accent border-accent text-accent-foreground scale-110 shadow-[0_0_100px_rgba(82,224,224,0.6)]" :
                orbState === 'speaking' ? "bg-accent/20 border-accent/40 text-accent hover:bg-accent/30" :
                "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:scale-110 hover:border-accent/30"
              )}>
                <div className={cn("absolute inset-0 rounded-full border border-accent animate-ping opacity-0", orbState === 'listening' && "opacity-40")} />
                <Mic className={cn("w-14 h-14 transition-all duration-700", orbState === 'listening' && "scale-110")} />
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
ENDPROFILED

echo "✅ ProfileDetail page updated"

# 6. Update Home page (grid version) and Dashboard

cat > src/app/page.tsx << 'ENDHOME'
"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Heart, User, Settings, Plus, RefreshCw } from "lucide-react";
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { getProfiles } from '@/lib/storage';
import type { LovedOne } from '@/lib/mock-data';

export default function Home() {
  const [profiles, setProfiles] = useState<LovedOne[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const userProfiles = await getProfiles();
      setProfiles(userProfiles);
    } catch (error) {
      console.error("Failed to load family vault:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    const handleSync = () => loadProfiles(false);
    window.addEventListener('storage', handleSync);
    window.addEventListener('profile-updated', handleSync);
    window.addEventListener('focus', handleSync);
    const interval = setInterval(handleSync, 5000);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('profile-updated', handleSync);
      window.removeEventListener('focus', handleSync);
      clearInterval(interval);
    };
  }, [loadProfiles]);

  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-accent selection:text-accent-foreground">
      <header className="px-8 h-24 flex items-center justify-between glass sticky top-0 z-50">
        <Link href="/" className="flex flex-col group">
          <h1 className="text-3xl font-bold tracking-tighter text-white transition-colors group-hover:text-accent">Echoes</h1>
          <p className="text-[9px] uppercase tracking-[0.4em] text-accent/80 font-bold">Their voice. Forever.</p>
        </Link>
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="sm" onClick={() => loadProfiles(true)} className="text-muted-foreground hover:text-accent gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Sync
          </Button>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-accent">
            <Settings className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary/20 border border-white/5 flex items-center justify-center text-accent">
            <User className="w-5 h-5" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-16 space-y-16">
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h2 className="text-5xl font-bold text-white tracking-tight">Family Vault</h2>
          <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Some people never truly leave."</p>
        </div>

        {isLoading && profiles.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1,2,3].map(i => <div key={i} className="h-[450px] rounded-[3rem] bg-white/[0.02] border border-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {profiles.map(person => (
              <Link key={person.id} href={`/profile/${person.id}`} className="group relative bg-card/20 border border-white/5 rounded-[3rem] p-10 transition-all hover:bg-card/40 hover:border-accent/30 hover:scale-[1.03] duration-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/5 rounded-full blur-[60px] group-hover:bg-accent/10 transition-colors duration-700" />
                <div className="flex flex-col items-center text-center space-y-8 relative z-10">
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-primary group-hover:border-accent transition-all duration-1000 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <Image src={person.avatarUrl} alt={person.name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-110 group-hover:scale-100" data-ai-hint="portrait elderly" />
                  </div>
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">{person.relation}</span>
                    <h3 className="text-3xl font-bold text-white tracking-tight">{person.name}</h3>
                    <p className="text-sm text-muted-foreground font-semibold tracking-widest uppercase">{person.birthYear} — {person.passingYear}</p>
                  </div>
                  <div className="flex gap-3 justify-center">{(person.traits||[]).slice(0,2).map(trait => <span key={trait} className="text-[9px] px-4 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 uppercase font-bold">{trait}</span>)}</div>
                </div>
              </Link>
            ))}
            <Link href="/profile/new" className="flex flex-col items-center justify-center p-12 rounded-[3rem] border-2 border-dashed border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-accent/20 transition-all group min-h-[450px] relative overflow-hidden">
              <div className="w-20 h-20 rounded-full bg-accent/5 flex items-center justify-center text-accent mb-8 group-hover:scale-110 group-hover:bg-accent/10 transition-all duration-500"><Plus className="w-10 h-10" /></div>
              <h3 className="text-2xl font-bold text-white">Add Someone</h3>
              <p className="text-muted-foreground mt-3 text-center max-w-[200px] text-sm italic font-medium">Begin preserving their story and spirit for eternity.</p>
            </Link>
          </div>
        )}
      </main>

      <footer className="py-20 px-8 flex flex-col items-center gap-6 text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"><Heart className="w-5 h-5 text-accent/40" /></div>
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.3em] max-w-sm mx-auto leading-relaxed font-bold">Echoes is a sacred space of remembrance.</p>
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.2em]">Private • Secure • Shared only with family</p>
        </div>
      </footer>
    </div>
  );
}
ENDHOME

echo "✅ Home page updated"

cat > src/app/dashboard/page.tsx << 'ENDDASH'
"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus, Settings, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { getProfiles } from '@/lib/storage';
import type { LovedOne } from '@/lib/mock-data';

export default function Dashboard() {
  const [profiles, setProfiles] = useState<LovedOne[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      setProfiles(await getProfiles());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    const handleSync = () => loadProfiles(false);
    window.addEventListener('storage', handleSync);
    window.addEventListener('profile-updated', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('profile-updated', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [loadProfiles]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl tracking-tighter text-accent">Echoes</Link>
          <div className="h-4 w-px bg-white/10" />
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-widest">Family Vault</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent"><Settings className="w-5 h-5" /></Button>
          <div className="w-8 h-8 rounded-full bg-primary border border-accent/20" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Family Archive</h1>
            <p className="text-muted-foreground">Manage and visit the living profiles of your family.</p>
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link href="/profile/new"><Plus className="w-4 h-4 mr-2" /> Create New Profile</Link>
          </Button>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
          <Input placeholder="Search family profiles..." className="pl-10 h-12 bg-white/5 border-white/10 focus:border-accent/50 focus:ring-accent/20" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {isLoading && profiles.length === 0 ? (
            [1,2,3,4].map(i => <div key={i} className="h-40 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />)
          ) : profiles.length === 0 ? (
            <div className="md:col-span-2 border border-dashed border-white/10 rounded-2xl p-10 text-center bg-white/[0.02]">
              <p className="text-muted-foreground">No family profiles yet.</p>
              <Button className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                <Link href="/profile/new"><Plus className="w-4 h-4 mr-2" /> Create New Profile</Link>
              </Button>
            </div>
          ) : profiles.map(person => (
            <Link key={person.id} href={`/profile/${person.id}`} className="group relative bg-white/5 border border-white/5 rounded-2xl p-6 overflow-hidden transition-all hover:bg-white/10 hover:border-accent/30">
              <div className="flex gap-6 items-start">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary group-hover:border-accent transition-colors">
                  <Image src={person.avatarUrl} alt={person.name} fill className="object-cover" data-ai-hint="portrait elderly" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent uppercase tracking-widest">{person.relation}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-all group-hover:translate-x-1" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{person.name}</h3>
                  <p className="text-sm text-muted-foreground">{person.birthYear} — {person.passingYear}</p>
                  <div className="flex gap-2 pt-2">{(person.traits||[]).map(trait => <span key={trait} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/40 text-white/70 border border-white/5 uppercase tracking-tighter">{trait}</span>)}</div>
                </div>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity"><div className="w-2 h-2 rounded-full bg-accent animate-pulse" /></div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
ENDDASH

echo "✅ Dashboard page updated"

# 7. Remove puter from package.json if present
if grep -q '"puter"' package.json; then
  node -e "const p=require('./package.json'); delete p.dependencies.puter; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n')"
  echo "🗑️  Removed 'puter' from package.json"
else
  echo "ℹ️  'puter' not found in package.json"
fi

# 8. (Optional) Remove lib/puter.ts if it still exists
[ -f src/lib/puter.ts ] && rm src/lib/puter.ts && echo "🗑️  Removed old lib/puter.ts"

echo ""
echo "✅ All files updated successfully!"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: npm uninstall puter && npm install"
echo "   2. Run: npm run dev"
echo "   3. Open http://localhost:9002"
echo "   4. Make sure Ollama is running on http://localhost:11434"
echo ""
echo "Now your app is 100% free and offline-capable!"