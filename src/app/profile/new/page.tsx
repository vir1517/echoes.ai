"use client";

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Users, Check, Loader2, Sparkles,
  Plus, X, AlertCircle, Mic
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PersonaArtifact } from '@/lib/mock-data';
import { buildKnowledgeChunks, cloneVoice, enrichArtifacts, speakPersona } from '@/lib/local-ai';
import { saveProfile, getProfileById } from '@/lib/storage';

function CreateProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const editId = searchParams.get('edit');
  const isEditing = Boolean(editId);

  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Weaving together their memories...");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', birthYear: '', passingYear: '', relation: '',
    birthPlace: '', personality: '', phrases: '',
  });

  const [memories, setMemories] = useState<{ type: string; content: string }[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [voiceArtifact, setVoiceArtifact] = useState<PersonaArtifact | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [speakerId, setSpeakerId] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const existing = await getProfileById(editId);
      if (!existing) { toast({ title: "Profile not found", variant: "destructive" }); router.push('/'); return; }
      setFormData({
        name: existing.name || '',
        birthYear: String(existing.birthYear || ''),
        passingYear: String(existing.passingYear || ''),
        relation: existing.relation || '',
        birthPlace: existing.birthPlace || '',
        personality: existing.summary || '',
        phrases: (existing.phrases || []).join(', '),
      });
      setMemories(((existing as any).memorySnippets || []).map((content: string) => ({ type: 'text', content })));
      const existingVoice = existing.artifacts?.find(a => a.type === 'audio') || null;
      if (existingVoice) setVoiceArtifact(existingVoice);
      if (existing.voiceSampleDataUri) setSpeakerId(existing.voiceSampleDataUri);
    })();
  }, [editId, router, toast]);

  useEffect(() => { setValidationError(null); }, [formData, memories, voiceArtifact]);

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setMemories(prev => [...prev, { type: 'text', content: newMemory.trim() }]);
    setNewMemory('');
  };
  const removeMemory = (index: number) => setMemories(prev => prev.filter((_, i) => i !== index));

  const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
    const channelCount = 1;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = channelCount * bytesPerSample;
    const dataSize = samples * blockAlign;
    const out = new ArrayBuffer(44 + dataSize);
    const view = new DataView(out);
    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeString(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeString(8, 'WAVE');
    writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); writeString(36, 'data'); view.setUint32(40, dataSize, true);
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
    return new Blob([out], { type: 'audio/wav' });
  };

  const trimVoiceSampleIfNeeded = async (audioFile: File): Promise<File> => {
    const audioContext = new AudioContext();
    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      if (decoded.duration <= 29.5) return audioFile;
      const maxFrames = Math.floor(decoded.sampleRate * 29.5);
      const clipped = audioContext.createBuffer(1, maxFrames, decoded.sampleRate);
      clipped.copyToChannel(decoded.getChannelData(0).slice(0, maxFrames), 0);
      const wavBlob = audioBufferToWavBlob(clipped);
      const trimmedName = audioFile.name.replace(/\.mp3$/i, '') + '-trimmed.wav';
      toast({ title: "Voice Sample Trimmed", description: "The first 29 seconds were used (Voicebox limit)." });
      return new File([wavBlob], trimmedName, { type: 'audio/wav' });
    } finally {
      await audioContext.close();
    }
  };

  const handleVoiceUpload = async (file: File) => {
    const isMp3 = file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');
    if (!isMp3) {
      toast({ title: "MP3 Required", description: "Voice cloning expects an .mp3 voice sample.", variant: "destructive" });
      return;
    }
    setUploadStatus(`Creating voice profile for ${formData.name || 'this Echo'}...`);
    try {
      const preparedFile = await trimVoiceSampleIfNeeded(file);
      const voiceboxId = await cloneVoice(preparedFile, formData.name || file.name);
      if (!voiceboxId) {
        toast({ title: "Voice Clone Failed", description: "Make sure the bridge and Voicebox are running.", variant: "destructive" });
        return;
      }
      setSpeakerId(voiceboxId);
      setVoiceArtifact({ type: 'audio', name: file.name, dataUri: '', size: file.size, mimeType: file.type });
      toast({ title: "Voice Cloned", description: "Voicebox profile linked to this Echo." });
    } catch (err) {
      console.error(err);
    } finally {
      setUploadStatus(null);
    }
  };

  const handleVoiceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleVoiceUpload(file);
    if (voiceInputRef.current) voiceInputRef.current.value = '';
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!formData.name.trim()) return "Please enter their full name.";
      if (!formData.birthYear) return "Please enter their birth year.";
      if (!formData.passingYear) return "Please enter the year they passed away.";
      if (!formData.relation) return "Please select your relationship to them.";
      if (!formData.personality.trim() || formData.personality.length < 10)
        return "Please provide a brief description of their personality.";
    }
    if (step === 2) {
      if (memories.length === 0)
        return "Please share at least one memory or story.";
    }
    return null;
  };

  const handleNext = async () => {
    const error = validateStep();
    if (error) { setValidationError(error); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (step < 4) { setStep(step + 1); return; }

    setIsProcessing(true);
    setProcessingStatus("Analysing memories with Puter AI…");
    try {
      const artifacts: PersonaArtifact[] = voiceArtifact ? [voiceArtifact] : [];

      const textDocs = [
        `Name: ${formData.name}`,
        `Relation: ${formData.relation}`,
        `Birth year: ${formData.birthYear}`,
        `Passing year: ${formData.passingYear}`,
        `Personality: ${formData.personality}`,
        `Phrases: ${formData.phrases}`,
        `Birthplace: ${formData.birthPlace}`,
        ...memories.map(m => `Memory: ${m.content}`),
      ];

      setProcessingStatus("Building a deep understanding of who they were…");
      const enrichedArtifacts = await enrichArtifacts(artifacts);

      const personaData = await speakPersona({
        lovedOneName: formData.name,
        textDocuments: textDocs,
        artifacts: enrichedArtifacts,
      });

      setProcessingStatus("Saving their Echo…");
      const knowledgeChunks = buildKnowledgeChunks({
        name: formData.name,
        relation: formData.relation,
        birthYear: parseInt(formData.birthYear) || 0,
        passingYear: parseInt(formData.passingYear) || 0,
        birthPlace: formData.birthPlace || 'Unknown',
        summary: personaData.overallSummary,
        phrases: personaData.speakingStyle.commonPhrases.length
          ? personaData.speakingStyle.commonPhrases
          : formData.phrases.split(',').map(s => s.trim()).filter(Boolean),
        beliefs: personaData.keyBeliefs,
        artifacts: enrichedArtifacts,
        memorySnippets: memories.map(m => m.content),
      });

      const newProfile = {
        id: editId || `profile-${Date.now()}`,
        name: formData.name,
        birthYear: parseInt(formData.birthYear) || 0,
        passingYear: parseInt(formData.passingYear) || 0,
        relation: formData.relation || 'Loved One',
        avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(formData.name)}/600/600`,
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
        artifacts: enrichedArtifacts,
        voiceSampleDataUri: speakerId || undefined,
        voiceSampleName: voiceArtifact?.name,
        voiceProfile: {
          hasReferenceAudio: !!speakerId,
          accent: 'US English',
          styleNotes: personaData.speakingStyle.cadenceDescription,
        },
        sourceEvidence: knowledgeChunks.map(c => `${c.sourceName}: ${c.text}`),
        knowledgeChunks,
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
      toast({ title: "Processing Error", description: "Puter AI may need a moment. Please try again.", variant: "destructive" });
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
          <h1 className="font-bold tracking-[0.1em] text-lg uppercase text-white/90">
            {isEditing ? 'Editing an Echo' : 'Creating an Echo'}
          </h1>
        </div>
        <div className="w-12" />
      </header>

      {/* Hidden voice file input */}
      <input
        type="file"
        ref={voiceInputRef}
        className="hidden"
        accept=".mp3,audio/mpeg"
        onChange={handleVoiceFileChange}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-10 py-20 space-y-12">
        {/* Step indicator */}
        <div className="flex items-center justify-between relative px-6">
          <div className="absolute top-5 left-0 right-0 h-px bg-white/10 -z-10 mx-16" />
          {steps.map(s => (
            <div key={s.id} className="flex flex-col items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step >= s.id
                  ? 'bg-accent text-accent-foreground scale-110 shadow-[0_0_20px_rgba(82,224,224,0.4)]'
                  : 'bg-white/5 text-muted-foreground'
              )}>
                {step > s.id ? <Check className="w-5 h-5" /> : s.id}
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-[0.2em]",
                step >= s.id ? 'text-white' : 'text-muted-foreground'
              )}>{s.title}</span>
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

            {/* ── Step 1: Identity ── */}
            {step === 1 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold text-white tracking-tight">
                  {isEditing ? 'Update their identity' : 'Who were they?'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Full Name *</Label>
                    <Input placeholder="Margaret Smith" value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Birth Year *</Label>
                    <Input type="number" placeholder="1945" value={formData.birthYear}
                      onChange={e => setFormData({ ...formData, birthYear: e.target.value })}
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Passing Year *</Label>
                    <Input type="number" placeholder="2020" value={formData.passingYear}
                      onChange={e => setFormData({ ...formData, passingYear: e.target.value })}
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Relationship *</Label>
                    <Select value={formData.relation} onValueChange={v => setFormData({ ...formData, relation: v })}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-16 rounded-2xl px-6">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
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
                    <Input placeholder="Dublin, Ireland" value={formData.birthPlace}
                      onChange={e => setFormData({ ...formData, birthPlace: e.target.value })}
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Their Personality *</Label>
                    <Textarea placeholder="Who were they? Describe their personality, values, habits…"
                      value={formData.personality}
                      onChange={e => setFormData({ ...formData, personality: e.target.value })}
                      className="bg-white/5 border-white/10 min-h-[160px] rounded-[2rem] text-xl p-8" />
                  </div>
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Signature Phrases</Label>
                    <Input placeholder="e.g. 'Right as rain', 'Every cloud has a silver lining'"
                      value={formData.phrases}
                      onChange={e => setFormData({ ...formData, phrases: e.target.value })}
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Memories + Voice ── */}
            {step === 2 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold text-white tracking-tight">
                  {isEditing ? 'Add more memories' : 'Share their memories'}
                </h2>

                {/* Memory snippets */}
                <div className="space-y-8">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Memory Snippets *</Label>
                  <div className="flex gap-3">
                    <Input placeholder="Add a memory or story…" value={newMemory}
                      onChange={e => setNewMemory(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addMemory()}
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6 text-lg" />
                    <Button onClick={addMemory} className="h-16 w-16 rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90">
                      <Plus className="w-8 h-8" />
                    </Button>
                  </div>
                  <div className="grid gap-4">
                    {memories.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl group">
                        <p className="text-lg text-white/90 italic">"{m.content}"</p>
                        <Button variant="ghost" size="icon" onClick={() => removeMemory(idx)}
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive">
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Voice upload */}
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Voice Sample (optional)</Label>
                  <button
                    onClick={() => voiceInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group w-full"
                  >
                    <Mic className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">
                      {voiceArtifact ? `✓ ${voiceArtifact.name}` : 'Upload Voice (.mp3)'}
                    </span>
                  </button>
                  {voiceArtifact && (
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                          <Mic className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{voiceArtifact.name}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            {speakerId ? '✓ Voicebox profile linked' : 'audio'}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon"
                        onClick={() => { setVoiceArtifact(null); setSpeakerId(null); }}
                        className="hover:text-destructive">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {uploadStatus && (
                    <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent font-medium animate-pulse">
                      {uploadStatus}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3: Invite ── */}
            {step === 3 && (
              <div className="space-y-12 text-center">
                <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Users className="w-12 h-12 text-accent" />
                </div>
                <h2 className="text-5xl font-bold">Invite the family</h2>
                <p className="text-muted-foreground italic">"Remembrance is a shared journey."</p>
                <div className="bg-white/[0.02] p-12 rounded-[3rem] border border-white/10 max-w-lg mx-auto">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Private Vault Link</Label>
                  <div className="flex gap-3 mt-4">
                    <Input readOnly value={`echoes.app/invite/v${Date.now().toString(36)}`}
                      className="bg-black/40 border-white/10 h-14 font-mono text-sm px-6 rounded-xl" />
                    <Button
                      onClick={() => { navigator.clipboard.writeText(`echoes.app/invite/v${Date.now().toString(36)}`); toast({ title: "Link Copied" }); }}
                      className="bg-accent text-accent-foreground h-14 rounded-xl shadow-xl">
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Review ── */}
            {step === 4 && (
              <div className="space-y-12">
                <h2 className="text-5xl font-bold">Final Look</h2>
                <div className="p-12 rounded-[3.5rem] bg-white/[0.02] border border-white/10 relative overflow-hidden">
                  <div className="flex items-center gap-8 relative z-10">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-primary/20 overflow-hidden border-2 border-primary/40 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white/30">
                        {formData.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-4xl font-bold">{formData.name}</h3>
                      <p className="text-accent text-sm font-bold uppercase tracking-[0.3em]">
                        {formData.relation} • {formData.birthYear} — {formData.passingYear}
                      </p>
                      <p className="text-white/40 text-xs mt-1">{memories.length} memories saved</p>
                      {speakerId && <p className="text-green-400 text-xs mt-1">🎙️ Voicebox profile linked</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-6 pt-8">
              {step > 1 && (
                <Button variant="ghost" size="lg"
                  className="flex-1 rounded-full h-18 text-muted-foreground font-bold uppercase tracking-widest text-xs"
                  onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button size="lg"
                className="flex-[2] bg-accent text-accent-foreground hover:bg-accent/90 rounded-full h-18 text-lg font-bold shadow-2xl transition-all hover:scale-[1.03] active:scale-95"
                onClick={handleNext}
                disabled={isProcessing}>
                {step === 4
                  ? (isProcessing ? 'Processing...' : isEditing ? 'Update their Echo' : 'Build their Echo')
                  : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CreateProfile() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <CreateProfileForm />
    </Suspense>
  );
}
