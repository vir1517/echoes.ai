
"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Users, Check, Loader2, Sparkles, Heart, Mic, Video, Image as ImageIcon, FileText, Plus, X, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveProfileToPuter } from '@/lib/puter';
import { useToast } from "@/hooks/use-toast";
import { mediaToPersonaGeneration } from '@/ai/flows/media-to-persona-generation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function CreateProfile() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Weaving together their memories...");
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    birthYear: '',
    passingYear: '',
    relation: '',
    birthPlace: '',
    personality: '',
    phrases: '',
    hasAccent: false
  });

  const [memories, setMemories] = useState<{type: string, content: string}[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [artifacts, setArtifacts] = useState<{type: 'image' | 'video' | 'audio' | 'text', name: string, dataUri: string}[]>([]);

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setMemories([...memories, { type: 'text', content: newMemory }]);
    setNewMemory('');
  };

  const removeMemory = (index: number) => {
    setMemories(memories.filter((_, i) => i !== index));
  };

  // Helper to resize images on the client to reduce payload size
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;

          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      let type: 'image' | 'video' | 'audio' | 'text' = 'text';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      if (type === 'image') {
        const optimizedUri = await resizeImage(file);
        setArtifacts(prev => [...prev, { type, name: file.name, dataUri: optimizedUri }]);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          setArtifacts(prev => [...prev, {
            type,
            name: file.name,
            dataUri: event.target?.result as string
          }]);
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeArtifact = (index: number) => {
    setArtifacts(prev => prev.filter((_, i) => i !== index));
  };

  const validateStep = () => {
    setValidationError(null);
    if (step === 1) {
      if (!formData.name.trim()) return "Please enter their name.";
      if (!formData.birthYear) return "Please enter their birth year.";
      if (!formData.passingYear) return "Please enter the year they passed away.";
      if (!formData.relation) return "Please select your relationship.";
      if (!formData.personality.trim()) return "Please describe their personality so we can learn who they were.";
    }
    if (step === 2) {
      if (memories.length === 0 && artifacts.length === 0) {
        return "Please share at least one memory or upload an artifact to help build their Echo.";
      }
    }
    return null;
  };

  const handleNext = async () => {
    const error = validateStep();
    if (error) {
      setValidationError(error);
      return;
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      setIsProcessing(true);
      
      try {
        setProcessingStatus("Listening to their voice in recordings...");
        
        const textDocs = [
          `Name: ${formData.name}`,
          `Relation: They were the user's ${formData.relation}.`,
          `Personality: ${formData.personality}`,
          `Common Phrases Entered: ${formData.phrases}`,
          `Birthplace context: Born in ${formData.birthPlace}.`,
          ...memories.map(m => `Specific Memory: ${m.content}`)
        ];

        const imageDataUris = artifacts.filter(a => a.type === 'image').map(a => a.dataUri);
        const videoDataUris = artifacts.filter(a => a.type === 'video').map(a => a.dataUri);
        const audioDataUris = artifacts.filter(a => a.type === 'audio').map(a => a.dataUri);

        const personaData = await mediaToPersonaGeneration({
          lovedOneName: formData.name,
          textDocuments: textDocs,
          imageDataUris: imageDataUris.length > 0 ? imageDataUris : undefined,
          videoDataUris: videoDataUris.length > 0 ? videoDataUris : undefined,
          audioDataUris: audioDataUris.length > 0 ? audioDataUris : undefined,
        });

        setProcessingStatus("Finalizing their Echo...");

        const newProfile = {
          id: `profile-${Date.now()}`,
          name: formData.name,
          birthYear: parseInt(formData.birthYear) || 0,
          passingYear: parseInt(formData.passingYear) || 0,
          relation: formData.relation || 'Loved One',
          avatarUrl: imageDataUris[0] || `https://picsum.photos/seed/${formData.name || 'new'}/600/600`,
          traits: personaData.personalityTraits,
          summary: personaData.overallSummary,
          birthPlace: formData.birthPlace || 'Unknown',
          languages: ['English'],
          occupation: 'Family Member',
          phrases: personaData.speakingStyle.commonPhrases.length > 0 
            ? personaData.speakingStyle.commonPhrases 
            : (formData.phrases ? formData.phrases.split(',').map(p => p.trim()) : []),
          beliefs: personaData.keyBeliefs,
          events: [], 
          exampleDialogues: personaData.exampleDialogues,
          memorySnippets: memories.map(m => m.content)
        };

        const success = await saveProfileToPuter(newProfile);
        
        if (success) {
          toast({
            title: "Echo Created",
            description: "Their memory is now preserved in your family vault.",
          });
          router.push('/');
        } else {
          throw new Error("Persistence error.");
        }
      } catch (err) {
        console.error("Error creating profile:", err);
        toast({
          title: "Processing Error",
          description: "The archive was too large or the connection was interrupted. Try uploading fewer artifacts at once.",
          variant: "destructive"
        });
        setIsProcessing(false);
      }
    }
  };

  const steps = [
    { id: 1, title: 'Identity', label: 'Who were they?' },
    { id: 2, title: 'Memories', label: 'Share their life' },
    { id: 3, title: 'Invite', label: 'Invite family' },
    { id: 4, title: 'Review', label: 'Finalize' }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-24 px-8 flex items-center justify-between glass sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-white/5 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent animate-pulse" />
          <h1 className="font-bold tracking-[0.1em] text-lg uppercase text-white/90">Creating an Echo</h1>
        </div>
        <div className="w-12" />
      </header>

      {/* Hidden file input always at root for ref stability */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        onChange={handleFileUpload}
        accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-10 py-20 space-y-12">
        <div className="flex items-center justify-between relative px-6">
          <div className="absolute top-5 left-0 right-0 h-px bg-white/10 -z-10 mx-16" />
          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-700",
                step >= s.id ? 'bg-accent text-accent-foreground scale-110 shadow-[0_0_20px_rgba(82,224,224,0.4)]' : 'bg-white/5 text-muted-foreground'
              )}>
                {step > s.id ? <Check className="w-5 h-5" /> : s.id}
              </div>
              <div className="flex flex-col items-center">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-700",
                  step >= s.id ? 'text-white' : 'text-muted-foreground'
                )}>
                  {s.title}
                </span>
              </div>
            </div>
          ))}
        </div>

        {validationError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Required Information Missing</AlertTitle>
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
              <div className="space-y-3 text-muted-foreground italic text-lg font-medium">
                <p className="animate-pulse">{processingStatus}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            {step === 1 && (
              <div className="space-y-12">
                <div className="space-y-3">
                  <h2 className="text-5xl font-bold text-white tracking-tight">Who were they?</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Tell us about the person you love."</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Full Name *</Label>
                    <Input 
                      placeholder="Margaret Smith" 
                      className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6 focus:border-accent/50 focus:ring-accent/20"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Birth Year *</Label>
                    <Input 
                      type="number" 
                      placeholder="1945" 
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6"
                      value={formData.birthYear}
                      onChange={(e) => setFormData({...formData, birthYear: e.target.value})}
                    />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Passing Year *</Label>
                    <Input 
                      type="number" 
                      placeholder="2020" 
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6"
                      value={formData.passingYear}
                      onChange={(e) => setFormData({...formData, passingYear: e.target.value})}
                    />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Relationship *</Label>
                    <Select value={formData.relation} onValueChange={(val) => setFormData({...formData, relation: val})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-16 rounded-2xl px-6">
                        <SelectValue placeholder="Select connection" />
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
                    <Input 
                      placeholder="Dublin, Ireland" 
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6"
                      value={formData.birthPlace}
                      onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-8 pt-8 border-t border-white/5">
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Their Personality *</Label>
                    <Textarea 
                      placeholder="He was quiet but funny. Very patient. Always had a story ready..." 
                      className="bg-white/5 border-white/10 min-h-[160px] rounded-[2rem] text-xl p-8 italic font-medium leading-relaxed"
                      value={formData.personality}
                      onChange={(e) => setFormData({...formData, personality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Common Phrases</Label>
                    <Input 
                      placeholder="e.g. 'Right as rain', 'Good luck to ya'" 
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6"
                      value={formData.phrases}
                      onChange={(e) => setFormData({...formData, phrases: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-8 bg-white/5 rounded-[2.5rem] border border-white/10">
                    <div className="space-y-2">
                      <Label className="text-lg font-bold">Regional Accent</Label>
                      <p className="text-sm text-muted-foreground font-medium opacity-60">Did they have a strong dialect or unique cadence?</p>
                    </div>
                    <Switch checked={formData.hasAccent} onCheckedChange={(val) => setFormData({...formData, hasAccent: val})} className="scale-125 data-[state=checked]:bg-accent" />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-12">
                <div className="space-y-3">
                  <h2 className="text-5xl font-bold text-white tracking-tight">Share their memories</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"This is how we learn who they were."</p>
                </div>

                <div className="space-y-8">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Memory Snippets</Label>
                  <div className="flex gap-3">
                    <Input 
                      placeholder="Share a defining story or memory..." 
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6 text-lg"
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                    />
                    <Button onClick={addMemory} className="h-16 w-16 rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl transition-all active:scale-95">
                      <Plus className="w-8 h-8" />
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    {memories.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl group animate-in slide-in-from-right-4 duration-500">
                        <p className="text-lg text-white/90 italic font-medium leading-relaxed">"{m.content}"</p>
                        <Button variant="ghost" size="icon" onClick={() => removeMemory(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded-full">
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group shadow-lg">
                    <ImageIcon className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Photos</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group shadow-lg">
                    <Video className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Videos</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group shadow-lg">
                    <Mic className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Voice</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group shadow-lg">
                    <FileText className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Documents</span>
                  </button>
                </div>

                {artifacts.length > 0 && (
                  <div className="space-y-6">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Uploaded Artifacts</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {artifacts.map((a, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl group">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                            {a.type === 'image' && <ImageIcon className="w-5 h-5" />}
                            {a.type === 'video' && <Video className="w-5 h-5" />}
                            {a.type === 'audio' && <Mic className="w-5 h-5" />}
                            {a.type === 'text' && <FileText className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{a.name}</p>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.type}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeArtifact(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded-full">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-16 border-2 border-dashed border-white/10 rounded-[3rem] flex flex-col items-center justify-center text-center gap-8 group hover:border-accent/30 hover:bg-white/[0.01] transition-all duration-700 shadow-inner cursor-pointer"
                >
                  <Upload className="w-16 h-16 text-muted-foreground group-hover:text-accent transition-all duration-700 group-hover:scale-110" />
                  <div className="space-y-3">
                    <p className="text-2xl font-bold text-white tracking-tight">Add artifacts here</p>
                    <p className="text-muted-foreground italic text-lg font-medium opacity-60">"Letters, voice notes, home movies, and portraits."</p>
                  </div>
                  <Button variant="outline" className="rounded-full border-white/20 px-10 h-14 font-bold tracking-widest uppercase text-xs hover:bg-white/10">Browse Archive</Button>
                </div>
                
                <div className="flex gap-6 p-8 bg-accent/5 rounded-[2rem] border border-accent/20">
                  <Heart className="w-8 h-8 text-accent shrink-0" />
                  <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                    <strong className="text-accent">A gentle tip:</strong> Sharing artifacts helps the Echo remember more deeply. Every detail contributes to their digital spirit.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-12">
                <div className="space-y-3 text-center">
                  <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-10 shadow-[0_0_50px_rgba(82,224,224,0.2)]">
                    <Users className="w-12 h-12" />
                  </div>
                  <h2 className="text-5xl font-bold text-white tracking-tight">Invite the family</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Echoes are richer when we remember together."</p>
                </div>

                <div className="bg-white/[0.02] p-12 rounded-[3rem] border border-white/10 space-y-10 shadow-2xl">
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Private Invite Link</Label>
                    <div className="flex gap-3">
                      <Input readOnly value={`echoes.app/invite/v${Date.now().toString(36)}`} className="bg-black/40 border-white/10 h-14 font-mono text-sm px-6 rounded-xl" />
                      <Button className="bg-accent text-accent-foreground px-10 font-bold h-14 rounded-xl shadow-xl hover:bg-accent/90" onClick={() => {
                        navigator.clipboard.writeText(`echoes.app/invite/v${Date.now().toString(36)}`);
                        toast({ title: "Link Copied", description: "Share it privately with your family members." });
                      }}>Copy</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-12">
                <div className="space-y-3">
                  <h2 className="text-5xl font-bold text-white tracking-tight">One final look</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Everything is ready to begin."</p>
                </div>
                <div className="p-12 rounded-[3.5rem] bg-white/[0.02] border border-white/10 space-y-10 shadow-2xl overflow-hidden relative">
                  <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                  
                  <div className="flex items-center gap-8 relative z-10">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-primary/20 overflow-hidden relative border-2 border-primary/40 flex items-center justify-center">
                       {artifacts.find(a => a.type === 'image') ? (
                         <img src={artifacts.find(a => a.type === 'image')?.dataUri} className="object-cover w-full h-full" />
                       ) : (
                         <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                       )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-4xl font-bold text-white tracking-tight">{formData.name || 'Anonymous Loved One'}</h3>
                      <p className="text-accent text-sm font-bold uppercase tracking-[0.3em]">
                        {formData.relation || 'Family'} • {formData.birthYear || '—'} — {formData.passingYear || '—'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-6 relative z-10">
                    <p className="text-2xl text-white/90 leading-relaxed italic border-l-4 border-accent/40 pl-8 py-4 font-medium">
                      "{formData.personality || 'A beautiful life to be remembered...'}"
                    </p>
                  </div>
                  
                  <div className="pt-8 border-t border-white/5 relative z-10 flex gap-12">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent/60">Contributed Stories</span>
                      <p className="text-lg text-white/60 mt-1 font-medium">{memories.length} life snippets</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent/60">Artifacts</span>
                      <p className="text-lg text-white/60 mt-1 font-medium">{artifacts.length} preserved items</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-6 pt-8">
              {step > 1 && (
                <Button variant="ghost" size="lg" className="flex-1 rounded-full h-18 text-muted-foreground font-bold uppercase tracking-widest text-xs hover:bg-white/5" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button 
                size="lg" 
                className="flex-[2] bg-accent text-accent-foreground hover:bg-accent/90 rounded-full h-18 text-lg font-bold shadow-2xl transition-all hover:scale-[1.03] active:scale-95 shadow-accent/20" 
                onClick={handleNext}
                disabled={isProcessing}
              >
                {step === 4 ? (isProcessing ? 'Processing Memories...' : 'Build their Echo') : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
