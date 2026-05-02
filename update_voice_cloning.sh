#!/usr/bin/env bash
set -e

echo "🔊 Setting up voice cloning..."

# 1. Make sure the TTS server directory exists
mkdir -p tts-server

# 2. Create the updated CreateProfile page (with voice cloning on upload)
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
  const [speakerId, setSpeakerId] = useState<string | null>(null);

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
      if (existing.voiceSampleDataUri) setSpeakerId(existing.voiceSampleDataUri);
    })();
  }, [editId, router, toast]);

  useEffect(() => { setValidationError(null); }, [formData, memories, artifacts]);

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setMemories(prev => [...prev, { type: 'text', content: newMemory.trim() }]);
    setNewMemory('');
  };

  const removeMemory = (index: number) => setMemories(prev => prev.filter((_, i) => i !== index));

  const resizeImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const maxDim = 800;
        if (w > h && w > maxDim) { h *= maxDim / w; w = maxDim; }
        else if (h > maxDim) { w *= maxDim / h; h = maxDim; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
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
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item: any) => item.str || '').join(' '));
      }
      return pages.join('\n').trim();
    }
    if (ext === 'docx') {
      const mammoth = await import('mammoth/mammoth.browser');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value.trim();
    }
    return `[Unsupported file type: ${file.name}]`;
  };

  const cloneVoice = async (audioFile: File): Promise<string | null> => {
    try {
      const form = new FormData();
      form.append('file', audioFile);
      const res = await fetch('http://localhost:5001/upload_voice', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.speaker_id || null;
    } catch {
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      setUploadStatus(`Processing ${file.name}...`);
      let type: 'image' | 'video' | 'audio' | 'text' = 'text';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      try {
        if (type === 'audio') {
          setUploadStatus(`Cloning voice from ${file.name}...`);
          const sid = await cloneVoice(file);
          if (sid) {
            setSpeakerId(sid);
            toast({ title: "Voice Cloned", description: "The AI will speak using this voice." });
          } else {
            toast({ title: "Cloning Failed", description: "Voice cloning server not available. Will use browser default.", variant: "destructive" });
          }
        }

        const dataUri = type === 'image' ? await resizeImage(file) : await readAsDataUri(file);
        let extractedText = '';
        if (type === 'text' || type === 'audio') {
          extractedText = await extractTextFromFile(file);
        }
        setArtifacts(prev => [...prev, {
          type,
          name: file.name,
          dataUri,
          extractedText: extractedText || undefined,
          size: file.size,
          mimeType: file.type,
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

  const validateStep = (): string | null => {
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
      const personaData = await generatePersona({
        lovedOneName: formData.name,
        textDocuments: textDocs,
        artifacts,
        imageDataUris: imageUris.length ? imageUris : undefined,
      });

      const newProfile = {
        id: editId || `profile-${Date.now()}`,
        name: formData.name,
        birthYear: parseInt(formData.birthYear) || 0,
        passingYear: parseInt(formData.passingYear) || 0,
        relation: formData.relation || 'Loved One',
        avatarUrl: imageUris[0] || `https://picsum.photos/seed/${encodeURIComponent(formData.name)}/600/600`,
        traits: personaData.personalityTraits,
        summary: personaData.overallSummary,
        birthPlace: formData.birthPlace || 'Unknown',
        languages: ['English'],
        occupation: 'Family Member',
        phrases: personaData.speakingStyle.commonPhrases.length
          ? personaData.speakingStyle.commonPhrases
          : formData.phrases.split(',').map(s => s.trim()).filter(Boolean),
        beliefs: personaData.keyBeliefs,
        events: [],
        exampleDialogues: personaData.exampleDialogues,
        memorySnippets: memories.map(m => m.content),
        artifacts,
        voiceSampleDataUri: speakerId || undefined,
        voiceSampleName: artifacts.find(a => a.type === 'audio')?.name,
        voiceProfile: {
          hasReferenceAudio: !!speakerId,
          accent: speakerId ? 'Cloned voice' : 'US English',
          styleNotes: personaData.speakingStyle.cadenceDescription,
        },
        sourceEvidence: [],
      };

      const success = await saveProfile(newProfile);
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
            {step === 1 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold text-white tracking-tight">{isEditing ? 'Update their identity' : 'Who were they?'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Full Name *</Label>
                    <Input placeholder="Margaret Smith" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Birth Year *</Label>
                    <Input type="number" placeholder="1945" value={formData.birthYear} onChange={e => setFormData({...formData, birthYear: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Passing Year *</Label>
                    <Input type="number" placeholder="2020" value={formData.passingYear} onChange={e => setFormData({...formData, passingYear: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Relationship *</Label>
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
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Birthplace</Label>
                    <Input placeholder="Dublin, Ireland" value={formData.birthPlace} onChange={e => setFormData({...formData, birthPlace: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Their Personality *</Label>
                    <Textarea placeholder="Who were they?" value={formData.personality} onChange={e => setFormData({...formData, personality: e.target.value})} className="bg-white/5 border-white/10 min-h-[160px] rounded-[2rem] text-xl p-8" />
                  </div>
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Signature Phrases</Label>
                    <Input placeholder="e.g. 'Right as rain'" value={formData.phrases} onChange={e => setFormData({...formData, phrases: e.target.value})} className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold text-white tracking-tight">{isEditing ? 'Add more memories' : 'Share their memories'}</h2>
                <div className="space-y-8">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Memory Snippets</Label>
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
                {speakerId && (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400 font-medium flex items-center gap-2">
                    <Mic className="w-4 h-4" /> Voice cloned successfully! (ID: {speakerId.slice(0, 8)}...)
                  </div>
                )}
                {artifacts.length > 0 && (
                  <div className="space-y-6">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Artifacts Collection</Label>
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

            {step === 3 && (
              <div className="space-y-12 text-center">
                <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-10 shadow-2xl"><Users className="w-12 h-12 text-accent" /></div>
                <h2 className="text-5xl font-bold text-white tracking-tight">Invite the family</h2>
                <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Remembrance is a shared journey."</p>
                <div className="bg-white/[0.02] p-12 rounded-[3rem] border border-white/10 space-y-10 shadow-2xl max-w-lg mx-auto">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Private Vault Link</Label>
                  <div className="flex gap-3">
                    <Input readOnly value={`echoes.app/invite/v${Date.now().toString(36)}`} className="bg-black/40 border-white/10 h-14 font-mono text-sm px-6 rounded-xl" />
                    <Button onClick={() => { navigator.clipboard.writeText(`echoes.app/invite/v${Date.now().toString(36)}`); toast({ title: "Link Copied" }); }} className="bg-accent text-accent-foreground px-10 font-bold h-14 rounded-xl shadow-xl hover:bg-accent/90">Copy</Button>
                  </div>
                </div>
              </div>
            )}

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
                      {speakerId && <p className="text-green-400 text-xs mt-1">🎙️ Voice cloned</p>}
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

# 3. Create the TTS server script
cat > tts-server/server.py << 'ENDPYSERVER'
from flask import Flask, request, send_file, jsonify
import io, os, uuid, tempfile

app = Flask(__name__)

from TTS.api import TTS
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False, gpu=False)

speakers = {}

@app.route('/upload_voice', methods=['POST'])
def upload_voice():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    speaker_id = str(uuid.uuid4())
    path = os.path.join(tempfile.gettempdir(), f"{speaker_id}.wav")
    file.save(path)
    speakers[speaker_id] = path
    return jsonify({"speaker_id": speaker_id})

@app.route('/tts', methods=['POST'])
def synthesize():
    data = request.get_json()
    text = data.get('text')
    speaker_id = data.get('speaker_id')
    language = data.get('language', 'en')
    if not text or not speaker_id:
        return jsonify({"error": "Missing text or speaker_id"}), 400
    speaker_path = speakers.get(speaker_id)
    if not speaker_path or not os.path.exists(speaker_path):
        return jsonify({"error": "Speaker not found"}), 404
    wav = tts.tts(text=text, speaker_wav=speaker_path, language=language)
    out = io.BytesIO()
    tts.save_wav(wav, out)
    out.seek(0)
    return send_file(out, mimetype='audio/wav')

if __name__ == '__main__':
    print("🚀 TTS server running on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
ENDPYSERVER

echo "✅ TTS server script created"

# 4. Update local-ai.ts with cloning support and fixed exports
cat > src/lib/local-ai.ts << 'ENDLOCALAI'
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

// Try to get cloned voice audio from local TTS server
async function fetchClonedAudio(text: string, speakerId: string): Promise<HTMLAudioElement | null> {
  try {
    const res = await fetch('http://localhost:5001/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker_id: speakerId, language: 'en' })
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.preload = 'auto';
    return audio;
  } catch {
    return null;
  }
}

// Exported TTS function that tries cloned voice first, then falls back to browser TTS
export async function speakResponse(
  text: string,
  speakerId?: string,
  options?: { onStart?: () => void; onEnd?: () => void }
) {
  if (speakerId) {
    console.log('[TTS] Trying cloned voice...');
    const audio = await fetchClonedAudio(text, speakerId);
    if (audio) {
      audio.onplay = () => options?.onStart?.();
      audio.onended = () => options?.onEnd?.();
      audio.onerror = () => {
        console.warn('[TTS] Cloned audio playback error, falling back to browser TTS.');
        speakWithBrowserTTS(text, options);
      };
      audio.play().catch(() => speakWithBrowserTTS(text, options));
      return;
    }
    console.warn('[TTS] Cloned voice server unreachable, using browser TTS.');
  }
  speakWithBrowserTTS(text, options);
}

// Browser fallback
function speakWithBrowserTTS(text: string, options?: { onStart?: () => void; onEnd?: () => void }) {
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
  utterance.onstart = () => options?.onStart?.();
  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = () => options?.onEnd?.();
  window.speechSynthesis.speak(utterance);
  // safety timeout
  setTimeout(() => {
    if (window.speechSynthesis.speaking) return;
    options?.onEnd?.();
  }, 3000);
}

// Backward compatibility alias
export const speakWithBrowserTTS = speakResponse;
ENDLOCALAI

echo "✅ local-ai.ts updated"

# 5. Update ProfileDetail page to use the new speakResponse
cat > src/app/profile/\[id\]/page.tsx << 'ENDPROFILE'
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
import { converseWithPersona, speakResponse } from '@/lib/local-ai';
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

  useEffect(() => {
    (async () => {
      const found = await getProfileById(id as string);
      if (found) {
        if (!found.sourceEvidence) found.sourceEvidence = buildProfileEvidence(found as any);
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

      await speakResponse(result.responseText, person.voiceSampleDataUri, {
        onStart: () => setOrbState('speaking'),
        onEnd: () => setOrbState('idle'),
      });
    } catch (err) {
      console.error(err);
      setOrbState('idle');
      toast({ title: "Connection Interrupted", variant: "destructive" });
    }
  }, [person, chatHistory, toast]);

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
          if (event.error === 'not-allowed') toast({ title: "Microphone Access Denied", variant: "destructive" });
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
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full bg-white/5 border border-white/5 hover:bg-accent/10 hover:text-accent"><ArrowLeft className="w-5 h-5" /></Button>
          <div><h2 className="font-bold text-2xl tracking-tight text-white">{person.name}</h2><span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">{person.relation}</span></div>
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
              <TabsTrigger value="story" className="rounded-full px-10 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-bold uppercase tracking-widest"><BookOpen className="w-4 h-4 mr-3" /> Their Story</TabsTrigger>
              <TabsTrigger value="speak" className="rounded-full px-10 h-full data-[state=active]:bg-accent data-[state=active]:text-accent-foreground transition-all text-xs font-bold uppercase tracking-widest"><Sparkles className="w-4 h-4 mr-3" /> Speak With Them</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="story" className="flex-1 max-w-7xl mx-auto w-full px-10 py-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="grid lg:grid-cols-12 gap-20">
              <div className="lg:col-span-4 space-y-16">
                <div className="relative aspect-[3/4] rounded-[3.5rem] overflow-hidden border-2 border-primary shadow-[0_0_80px_rgba(0,0,0,0.6)] group">
                  <Image src={person.avatarUrl} alt={person.name} fill className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100" data-ai-hint="portrait elderly" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                </div>
                <div className="space-y-10 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5">
                  <div className="space-y-6"><h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent flex items-center gap-3"><Sparkles className="w-4 h-4" /> The Snapshot</h3><div className="space-y-5"><div className="flex items-center gap-4 text-muted-foreground"><Calendar className="w-5 h-5 text-primary" /><span>{person.birthYear} — {person.passingYear}</span></div><div className="flex items-center gap-4 text-muted-foreground"><MapPin className="w-5 h-5 text-primary" /><span>{person.birthPlace}</span></div></div></div>
                  <div className="space-y-6"><h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Personality Traits</h3><div className="flex flex-wrap gap-2.5">{(person.traits || []).map(trait => <span key={trait} className="text-[10px] px-4 py-1.5 rounded-full bg-primary/20 text-white/70 border border-white/10 uppercase font-bold">{trait}</span>)}</div></div>
                </div>
              </div>
              <div className="lg:col-span-8 space-y-20">
                <section className="space-y-10 relative"><Quote className="absolute -top-10 -left-12 w-24 h-24 text-accent/5 -z-10" /><h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">AI Biography</h3><p className="text-2xl font-medium leading-relaxed text-white/90 italic first-letter:text-6xl first-letter:font-bold first-letter:mr-4 first-letter:float-left first-letter:text-accent">{person.summary}</p></section>
                {person.beliefs?.length > 0 && (
                  <section className="space-y-10"><h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Core Values</h3><div className="grid gap-5">{person.beliefs.map((belief, idx) => (<div key={idx} className="p-8 bg-white/[0.02] rounded-[2rem] border border-white/5 flex gap-6 items-start group hover:bg-white/[0.04] transition-all duration-500"><div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 text-xs font-bold">{idx+1}</div><p className="text-xl text-white/80 font-medium">{belief}</p></div>))}</div></section>
                )}
                {person.phrases?.length > 0 && (
                  <section className="space-y-10"><h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Common Phrases</h3><div className="flex flex-wrap gap-5">{person.phrases.map((phrase, idx) => (<div key={idx} className="px-8 py-5 bg-primary/10 rounded-[2rem] border border-primary/20 italic text-white/60 text-lg hover:text-white transition-colors cursor-default">"{phrase}"</div>))}</div></section>
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
ENDPROFILE

echo "✅ ProfileDetail page updated"
echo ""
echo "🔊 Voice cloning files set up successfully!"
echo "   Next steps:"
echo "   1. Start the TTS server:  cd tts-server && python3 -m venv venv && source venv/bin/activate && pip install TTS flask && python server.py"
echo "   2. Restart Next.js: npm run dev"
echo "   3. Upload an MP3 in the 'Voice' section when creating a profile."
