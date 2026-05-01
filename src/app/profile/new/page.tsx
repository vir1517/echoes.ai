"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Users, Check, Loader2, Sparkles, Heart, Mic, Video, Image as ImageIcon, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function CreateProfile() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      setIsProcessing(true);
      setTimeout(() => router.push('/'), 4000);
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
        {/* Progress Timeline */}
        <div className="flex items-center justify-between relative px-4">
          <div className="absolute top-4 left-0 right-0 h-px bg-white/5 -z-10 mx-12" />
          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                step >= s.id ? 'bg-accent text-accent-foreground scale-110 shadow-[0_0_15px_rgba(255,191,0,0.3)]' : 'bg-white/5 text-muted-foreground'
              }`}>
                {step > s.id ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= s.id ? 'text-white' : 'text-muted-foreground'}`}>
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
                <p className="animate-pulse">Listening to their voice in recordings...</p>
                <p className="animate-pulse [animation-delay:1s]">Learning how they saw the world from your stories...</p>
                <p className="animate-pulse [animation-delay:2s]">Weaving together their memories...</p>
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
                    <Input placeholder="Margaret Smith" className="bg-white/5 border-white/5 h-14 text-lg rounded-xl" />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Birth Year</Label>
                    <Input type="number" placeholder="1945" className="bg-white/5 border-white/5 h-14 rounded-xl" />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Passing Year</Label>
                    <Input type="number" placeholder="2020" className="bg-white/5 border-white/5 h-14 rounded-xl" />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Relation</Label>
                    <Select>
                      <SelectTrigger className="bg-white/5 border-white/5 h-14 rounded-xl">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grandfather">Grandfather</SelectItem>
                        <SelectItem value="grandmother">Grandmother</SelectItem>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Birthplace</Label>
                    <Input placeholder="Dublin, Ireland" className="bg-white/5 border-white/5 h-14 rounded-xl" />
                  </div>
                </div>

                <div className="space-y-6 pt-6">
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Their Personality</Label>
                    <Textarea 
                      placeholder="He was quiet but funny. Very patient. Always had a story ready..." 
                      className="bg-white/5 border-white/5 min-h-[120px] rounded-xl text-lg p-6"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest font-bold opacity-60">Common Phrases</Label>
                    <Input placeholder="e.g. 'Right as rain', 'Good luck to ya'" className="bg-white/5 border-white/5 h-14 rounded-xl" />
                  </div>
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                      <Label className="text-sm font-bold">Regional Accent</Label>
                      <p className="text-xs text-muted-foreground">Did they have a strong dialect?</p>
                    </div>
                    <Switch />
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
                    <p className="text-xl font-bold">Drag and drop memories here</p>
                    <p className="text-sm text-muted-foreground italic">"Letters, voice notes, home movies, and portraits."</p>
                  </div>
                  <Button variant="outline" className="rounded-full border-white/10 mt-4">Browse Files</Button>
                </div>
                
                <div className="flex gap-4 p-6 bg-accent/5 rounded-2xl border border-accent/10">
                  <Heart className="w-6 h-6 text-accent shrink-0" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-accent">A gentle tip:</strong> Adding context to photos—like who was there or what the occasion was—helps the Echo remember more deeply.
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
                      <Input readOnly value="echoes.app/invite/f829-x291-k911" className="bg-black/20 border-white/5 h-12 font-mono text-sm" />
                      <Button className="bg-accent text-accent-foreground px-6 font-bold">Copy</Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Share this link privately. Anyone with it can add their own memories to this profile.
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
                    <div className="w-24 h-24 rounded-2xl bg-primary/20" />
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold text-white">Margaret Smith</h3>
                      <p className="text-accent text-sm font-bold uppercase tracking-widest">Mother • 1945 — 2020</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed italic border-l-2 border-accent/40 pl-6 py-2">
                    "She was a force of nature, always in the garden or at the easel. She taught us that beauty is found in the smallest details..."
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/20 rounded-xl">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Memories Shared</p>
                      <p className="font-bold">24 Photos & Videos</p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-xl">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Voice Quality</p>
                      <p className="font-bold text-accent">Excellent</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-12">
              {step > 1 && (
                <Button variant="ghost" size="lg" className="flex-1 rounded-full text-muted-foreground" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button size="lg" className="flex-[2] bg-accent text-accent-foreground hover:bg-accent/90 rounded-full h-16 text-lg font-bold shadow-xl transition-all hover:scale-[1.02]" onClick={handleNext}>
                {step === 4 ? 'Build their Echo' : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
