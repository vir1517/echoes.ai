"use client";

import { useState, useRef, useEffect } from 'react';
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

  // Clear validation error when user changes data
  useEffect(() => {
    setValidationError(null);
  }, [formData, memories, artifacts]);

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setMemories([...memories, { type: 'text', content: newMemory }]);
    setNewMemory('');
  };

  const removeMemory = (index: number) => {
    setMemories(memories.filter((_, i) => i !== index));
  };

  /**
   * Resizes an image on the client to reduce payload size.
   */
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800; // Efficient size for AI analysis

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
          if (!ctx) {
            return resolve(e.target?.result as string);
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
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

      try {
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
      } catch (err) {
        console.error("Upload error:", err);
        toast({ title: "Upload Failed", description: `Could not process ${file.name}.`, variant: "destructive" });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeArtifact = (index: number) => {
    setArtifacts(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Validates the current step before allowing progression.
   */
  const validateStep = () => {
    if (step === 1) {
      if (!formData.name.trim()) return "Please enter their full name.";
      if (!formData.birthYear) return "Please enter their birth year.";
      if (!formData.passingYear) return "Please enter the year they passed away.";
      if (!formData.relation) return "Please select your relationship to them.";
      if (!formData.personality.trim() || formData.personality.length < 10) {
        return "Please provide a brief description of their personality (at least 10 characters).";
      }
    }
    if (step === 2) {
      if (memories.length === 0 && artifacts.length === 0) {
        return "Please share at least one memory or upload an artifact to build their Echo.";
      }
    }
    return null;
  };

  const handleNext = async () => {
    const error = validateStep();
    if (error) {
      setValidationError(error);
      // Scroll to error
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
          `Common Phrases: ${formData.phrases}`,
          `Born in: ${formData.birthPlace}.`,
          ...memories.map(m => `Memory: ${m.content}`)
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
          throw new Error("Could not persist profile.");
        }
      } catch (err) {
        console.error("Error creating profile:", err);
        toast({
          title: "Processing Error",
          description: "The connection to the archive was interrupted. Please try again.",
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

      {/* Hidden file input for artifact uploading */}
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
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-700",
                step >= s.id ? 'text-white' : 'text-muted-foreground'
              )}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {validationError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive animate-in fade-in slide-in-from-top-2">
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
                <div className="space-y-3">
                  <h2 className="text-5xl font-bold text-white tracking-tight">Who were they?</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Every persona begins with a name and a story."</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-5 md:col-span-2">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Full Name *</Label>
                    <Input 
                      placeholder="Margaret Smith" 
                      className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6 focus:border-accent/50"
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
                      placeholder="e.g. Dublin, Ireland" 
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
                      placeholder="Share a bit about who they were. What was their spirit like?" 
                      className="bg-white/5 border-white/10 min-h-[160px] rounded-[2rem] text-xl p-8 italic"
                      value={formData.personality}
                      onChange={(e) => setFormData({...formData, personality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Signature Phrases</Label>
                    <Input 
                      placeholder="e.g. 'Right as rain', 'Good luck to ya'" 
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6"
                      value={formData.phrases}
                      onChange={(e) => setFormData({...formData, phrases: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-12">
                <div className="space-y-3">
                  <h2 className="text-5xl font-bold text-white tracking-tight">Share their memories</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Provide artifacts to help the Echo learn their voice and story."</p>
                </div>

                <div className="space-y-8">
                  <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Memory Snippets</Label>
                  <div className="flex gap-3">
                    <Input 
                      placeholder="Add a story, a habit, or a defining moment..." 
                      className="bg-white/5 border-white/10 h-16 rounded-2xl px-6 text-lg"
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                    />
                    <Button onClick={addMemory} className="h-16 w-16 rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 transition-all active:scale-95">
                      <Plus className="w-8 h-8" />
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    {memories.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl group animate-in slide-in-from-right-4">
                        <p className="text-lg text-white/90 italic">"{m.content}"</p>
                        <Button variant="ghost" size="icon" onClick={() => removeMemory(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive">
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group">
                    <ImageIcon className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Photos</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group">
                    <Video className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Videos</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group">
                    <Mic className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Voice</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-5 group">
                    <FileText className="w-10 h-10 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Docs</span>
                  </button>
                </div>

                {artifacts.length > 0 && (
                  <div className="space-y-6">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Artifacts Collection</Label>
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
                          <Button variant="ghost" size="icon" onClick={() => removeArtifact(idx)} className="opacity-0 group-hover:opacity-100 hover:text-destructive">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-12">
                <div className="space-y-3 text-center">
                  <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-10 shadow-2xl">
                    <Users className="w-12 h-12" />
                  </div>
                  <h2 className="text-5xl font-bold text-white tracking-tight">Invite the family</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Remembrance is a shared journey."</p>
                </div>

                <div className="bg-white/[0.02] p-12 rounded-[3rem] border border-white/10 space-y-10 shadow-2xl">
                  <div className="space-y-5">
                    <Label className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent/80">Private Vault Link</Label>
                    <div className="flex gap-3">
                      <Input readOnly value={`echoes.app/invite/v${Date.now().toString(36)}`} className="bg-black/40 border-white/10 h-14 font-mono text-sm px-6 rounded-xl" />
                      <Button className="bg-accent text-accent-foreground px-10 font-bold h-14 rounded-xl shadow-xl hover:bg-accent/90" onClick={() => {
                        navigator.clipboard.writeText(`echoes.app/invite/v${Date.now().toString(36)}`);
                        toast({ title: "Link Copied", description: "Share it with trusted family members." });
                      }}>Copy</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-12">
                <div className="space-y-3">
                  <h2 className="text-5xl font-bold text-white tracking-tight">Final Look</h2>
                  <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Confirm the identity of this Echo."</p>
                </div>
                <div className="p-12 rounded-[3.5rem] bg-white/[0.02] border border-white/10 space-y-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                  
                  <div className="flex items-center gap-8 relative z-10">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-primary/20 overflow-hidden border-2 border-primary/40 flex items-center justify-center">
                       {artifacts.find(a => a.type === 'image') ? (
                         <img src={artifacts.find(a => a.type === 'image')?.dataUri} className="object-cover w-full h-full" />
                       ) : (
                         <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                       )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-4xl font-bold text-white tracking-tight">{formData.name}</h3>
                      <p className="text-accent text-sm font-bold uppercase tracking-[0.3em]">
                        {formData.relation} • {formData.birthYear} — {formData.passingYear}
                      </p>
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
                {step === 4 ? (isProcessing ? 'Processing...' : 'Build their Echo') : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
