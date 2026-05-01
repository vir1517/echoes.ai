
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Users, Check, Loader2, Sparkles, Heart, Mic, Video, Image as ImageIcon, FileText, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveProfileToPuter } from '@/lib/puter';
import { useToast } from "@/hooks/use-toast";
import { mediaToPersonaGeneration } from '@/ai/flows/media-to-persona-generation';
import { cn } from '@/lib/utils';

export default function CreateProfile() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Weaving together their memories...");
  
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

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setMemories([...memories, { type: 'text', content: newMemory }]);
    setNewMemory('');
  };

  const removeMemory = (index: number) => {
    setMemories(memories.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      setIsProcessing(true);
      
      try {
        setProcessingStatus("Listening to their voice in recordings...");
        
        const textDocs = [
          `Personality: ${formData.personality}`,
          `Relation: They were the user's ${formData.relation}.`,
          `Common Phrases: ${formData.phrases}`,
          ...memories.map(m => m.content)
        ];

        const personaData = await mediaToPersonaGeneration({
          lovedOneName: formData.name,
          textDocuments: textDocs
        });

        setProcessingStatus("Finalizing their Echo...");

        const newProfile = {
          id: `profile-${Date.now()}`,
          name: formData.name,
          birthYear: parseInt(formData.birthYear) || 0,
          passingYear: parseInt(formData.passingYear) || 0,
          relation: formData.relation || 'Loved One',
          avatarUrl: `https://picsum.photos/seed/${formData.name || 'new'}/400/400`,
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
          throw new Error("Puter save failed");
        }
      } catch (err) {
        console.error("Error creating profile:", err);
        toast({
          title: "Processing Error",
          description: "We encountered a hiccup while learning about them. Please try again.",
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
      <header className="h-20 px-8 flex items-center justify-between glass sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h1 className="font-bold tracking-tight">Creating an Echo</h1>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-8 py-16 space-y-16">
        <div className="flex items-center justify-between relative px-4">
          <div className="absolute top-4 left-0 right-0 h-px bg-white/5 -z-10 mx-12" />
          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500",
                step >= s.id ? 'bg-accent text-accent-foreground scale-110 shadow-[0_0_15px_rgba(82,224,224,0.3)]' : 'bg-white/5 text-muted-foreground'
              )}>
                {step > s.id ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <div className="flex flex-col items-center">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  step >= s.id ? 'text-white' : 'text-muted-foreground'
                )}>
                  {s.title}
                </span>
              </div>
            </div>
          ))}
        </div>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-12 py-20 text-center animate-in fade-in duration-1000">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-3xl animate-pulse" />
              <Loader2 className="w-20 h-20 text-accent animate-spin relative" />
            </div>
            <div className="space-y-4 max-w-md">
              <h2 className="text-3xl font-bold">Building their Echo</h2>
              <div className="space-y-2 text-muted-foreground italic">
                <p className="animate-pulse">{processingStatus}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {step === 1 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold text-white">Who were they?</h2>
                  <p className="text-muted-foreground text-lg italic">"Tell us about the person you love."</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4 md:col-span-2">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Full Name</Label>
                    <Input 
                      placeholder="Margaret Smith" 
                      className="bg-white/5 border-white/5 h-14 text-lg rounded-xl"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Birth Year</Label>
                    <Input 
                      type="number" 
                      placeholder="1945" 
                      className="bg-white/5 border-white/5 h-14 rounded-xl"
                      value={formData.birthYear}
                      onChange={(e) => setFormData({...formData, birthYear: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Passing Year</Label>
                    <Input 
                      type="number" 
                      placeholder="2020" 
                      className="bg-white/5 border-white/5 h-14 rounded-xl"
                      value={formData.passingYear}
                      onChange={(e) => setFormData({...formData, passingYear: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Relation</Label>
                    <Select onValueChange={(val) => setFormData({...formData, relation: val})}>
                      <SelectTrigger className="bg-white/5 border-white/5 h-14 rounded-xl">
                        <SelectValue placeholder="Select relationship" />
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
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Birthplace</Label>
                    <Input 
                      placeholder="Dublin, Ireland" 
                      className="bg-white/5 border-white/5 h-14 rounded-xl"
                      value={formData.birthPlace}
                      onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-6 pt-6">
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Their Personality</Label>
                    <Textarea 
                      placeholder="He was quiet but funny. Very patient. Always had a story ready..." 
                      className="bg-white/5 border-white/5 min-h-[120px] rounded-xl text-lg p-6"
                      value={formData.personality}
                      onChange={(e) => setFormData({...formData, personality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Common Phrases</Label>
                    <Input 
                      placeholder="e.g. 'Right as rain', 'Good luck to ya'" 
                      className="bg-white/5 border-white/5 h-14 rounded-xl"
                      value={formData.phrases}
                      onChange={(e) => setFormData({...formData, phrases: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                      <Label className="text-sm font-bold">Regional Accent</Label>
                      <p className="text-xs text-muted-foreground">Did they have a strong dialect?</p>
                    </div>
                    <Switch checked={formData.hasAccent} onCheckedChange={(val) => setFormData({...formData, hasAccent: val})} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold text-white">Share their memories</h2>
                  <p className="text-muted-foreground text-lg italic">"This is how we learn who they were."</p>
                </div>

                <div className="space-y-6">
                  <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Memory Snippets</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Share a story or memory..." 
                      className="bg-white/5 border-white/5 h-14 rounded-xl"
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                    />
                    <Button onClick={addMemory} className="h-14 w-14 rounded-xl bg-accent text-accent-foreground">
                      <Plus className="w-6 h-6" />
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {memories.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl group">
                        <p className="text-sm text-white/80 italic">"{m.content}"</p>
                        <Button variant="ghost" size="icon" onClick={() => removeMemory(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-4">
                    <ImageIcon className="w-8 h-8 text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Photos</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-4">
                    <Video className="w-8 h-8 text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Videos</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-4">
                    <Mic className="w-8 h-8 text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Voice</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-8 rounded-[2rem] bg-primary/10 border border-white/5 hover:bg-primary/20 transition-all gap-4">
                    <FileText className="w-8 h-8 text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Writing</span>
                  </button>
                </div>

                <div className="p-12 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-6 group hover:border-accent/20 transition-all">
                  <Upload className="w-12 h-12 text-muted-foreground group-hover:text-accent transition-colors" />
                  <div className="space-y-2">
                    <p className="text-xl font-bold">Drag and drop artifacts here</p>
                    <p className="text-sm text-muted-foreground italic">"Letters, voice notes, home movies, and portraits."</p>
                  </div>
                  <Button variant="outline" className="rounded-full border-white/10 mt-4">Browse Files</Button>
                </div>
                
                <div className="flex gap-4 p-6 bg-accent/5 rounded-2xl border border-accent/10">
                  <Heart className="w-6 h-6 text-accent shrink-0" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-accent">A gentle tip:</strong> Adding context to artifacts helps the Echo remember more deeply.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-10">
                <div className="space-y-2 text-center">
                  <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-6">
                    <Users className="w-10 h-10" />
                  </div>
                  <h2 className="text-4xl font-bold text-white">Invite the family</h2>
                  <p className="text-muted-foreground text-lg italic">"Echoes are richer when we remember together."</p>
                </div>

                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 space-y-6">
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Secret Invite Link</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={`echoes.app/invite/v${Date.now().toString(36)}`} className="bg-black/20 border-white/5 h-12 font-mono text-sm" />
                      <Button className="bg-accent text-accent-foreground px-6 font-bold" onClick={() => {
                        navigator.clipboard.writeText("echoes.app/invite/share");
                        toast({ title: "Link Copied", description: "Share it with your family members." });
                      }}>Copy</Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Share this link privately. Anyone with it can contribute their own memories.
                  </p>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-10">
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold text-white">One final look</h2>
                  <p className="text-muted-foreground text-lg italic">"Everything is ready to begin."</p>
                </div>
                <div className="p-8 rounded-[2rem] bg-white/5 border border-white/5 space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-primary/20 overflow-hidden relative">
                       <ImageIcon className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/30" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold text-white">{formData.name || 'Anonymous Loved One'}</h3>
                      <p className="text-accent text-sm font-bold uppercase tracking-widest">
                        {formData.relation || 'Family'} • {formData.birthYear || '—'} — {formData.passingYear || '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed italic border-l-2 border-accent/40 pl-6 py-2">
                    "{formData.personality || 'A life to be remembered...'}"
                  </p>
                  {memories.length > 0 && (
                    <div className="pt-4 border-t border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shared Artifacts</span>
                      <p className="text-sm text-white/60 mt-1">{memories.length} memory snippets recorded.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-12">
              {step > 1 && (
                <Button variant="ghost" size="lg" className="flex-1 rounded-full text-muted-foreground" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button 
                size="lg" 
                className="flex-[2] bg-accent text-accent-foreground hover:bg-accent/90 rounded-full h-16 text-lg font-bold shadow-xl transition-all hover:scale-[1.02]" 
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
