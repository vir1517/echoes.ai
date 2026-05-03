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
import { speakPersona, cloneVoice } from '@/lib/local-ai';
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
  const [speakerId, setSpeakerId] = useState<string | null>(null); // Voicebox profile id

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

  const handleVoiceUpload = async (audioFile: File): Promise<string | null> => {
    try {
      const isMp3 = audioFile.type === 'audio/mpeg' || audioFile.name.toLowerCase().endsWith('.mp3');
      if (!isMp3) {
        toast({ title: "MP3 Required", description: "Voice cloning currently expects an .mp3 voice sample.", variant: "destructive" });
        return null;
      }

      setUploadStatus(`Creating Voicebox voice for ${formData.name || 'this profile'}...`);
      const voiceboxProfileId = await cloneVoice(audioFile, formData.name || audioFile.name);
      if (!voiceboxProfileId) {
        toast({ title: "Voice Clone Failed", description: "Could not create the Voicebox profile. Make sure the bridge and Voicebox are running.", variant: "destructive" });
        return null;
      }

      toast({ title: "Voice Cloned", description: "Voicebox profile created and linked to this Echo." });
      return voiceboxProfileId;
    } catch (err) {
      console.error(err);
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
        const dataUri = type === 'audio'
          ? ''
          : type === 'image'
            ? await resizeImage(file)
            : await readAsDataUri(file);
        let extractedText = '';
        if (type === 'text') {
          extractedText = await extractTextFromFile(file);
        }

        if (type === 'audio') {
          const voicePath = await handleVoiceUpload(file);
          if (voicePath) setSpeakerId(voicePath);
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
      if (!formData.personality.trim() || formData.personality.length < 10) return "Please provide a brief description of their personality.";
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
      const personaData = await speakPersona({
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
          accent: 'US English',
          styleNotes: personaData.speakingStyle.cadenceDescription,
        },
        sourceEvidence: [],
      };

      const success = await saveProfile(newProfile);
      if (success) {
        toast({ title: isEditing ? "Echo Updated" : "Echo Created", description: "Their memory is now preserved." });
        router.push(isEditing ? `/profile/${editId}` : '/');
      } else {
        throw new Error("Could not save profile.");
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Processing Error", description: "The AI service may be offline.", variant: "destructive" });
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
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
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
                      <div key={idx} className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl group">
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
                <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mx-auto"><Users className="w-12 h-12 text-accent" /></div>
                <h2 className="text-5xl font-bold">Invite the family</h2>
                <p className="text-muted-foreground italic">"Remembrance is a shared journey."</p>
                <div className="bg-white/[0.02] p-12 rounded-[3rem] border border-white/10 max-w-lg mx-auto">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Private Vault Link</Label>
                  <div className="flex gap-3 mt-4">
                    <Input readOnly value={`echoes.app/invite/v${Date.now().toString(36)}`} className="bg-black/40 border-white/10 h-14 font-mono text-sm px-6 rounded-xl" />
                    <Button onClick={() => { navigator.clipboard.writeText(`echoes.app/invite/v${Date.now().toString(36)}`); toast({ title: "Link Copied" }); }} className="bg-accent text-accent-foreground h-14 rounded-xl shadow-xl">Copy</Button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold">Final Look</h2>
                <div className="p-12 rounded-[3.5rem] bg-white/[0.02] border border-white/10 relative overflow-hidden">
                  <div className="flex items-center gap-8 relative z-10">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-primary/20 overflow-hidden border-2 border-primary/40">
                      {artifacts.find(a => a.type === 'image')?.dataUri ? (
                        <img src={artifacts.find(a => a.type === 'image')!.dataUri} className="object-cover w-full h-full" alt="" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mt-10" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-4xl font-bold">{formData.name}</h3>
                      <p className="text-accent text-sm font-bold uppercase tracking-[0.3em]">{formData.relation} • {formData.birthYear} — {formData.passingYear}</p>
                      {speakerId && <p className="text-green-400 text-xs mt-1">Voicebox profile linked</p>}
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
