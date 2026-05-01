
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Users, Calendar, Check, Loader2 } from "lucide-react";
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CreateProfile() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setIsProcessing(true);
      // Simulate persona generation
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between glass">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold">Create Profile</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 space-y-12">
        {/* Progress steps */}
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-accent text-accent-foreground' : 'bg-white/5 text-muted-foreground'}`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= s ? 'text-white' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Details' : s === 2 ? 'Archive' : 'Finalize'}
              </span>
            </div>
          ))}
          <div className="absolute top-[108px] left-[50%] -translate-x-1/2 w-48 h-px bg-white/10 -z-10" />
        </div>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-8 py-20 text-center">
            <Loader2 className="w-16 h-16 text-accent animate-spin" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Generative Processing...</h2>
              <p className="text-muted-foreground max-w-xs">Our AI is analyzing the uploaded media to reconstruct their personality and voice.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Identity Details</h2>
                  <p className="text-muted-foreground">Start with the basic information of your loved one.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="e.g. Margaret Smith" className="bg-white/5 border-white/10 h-12" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Birth Year</Label>
                      <Input type="number" placeholder="1945" className="bg-white/5 border-white/10 h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label>Passing Year</Label>
                      <Input type="number" placeholder="2020" className="bg-white/5 border-white/10 h-12" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Your Relation</Label>
                    <Input placeholder="e.g. Mother" className="bg-white/5 border-white/10 h-12" />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">The Memory Vault</h2>
                  <p className="text-muted-foreground">Upload the fuel for the persona. The more diverse, the more accurate the echo.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center gap-3 hover:bg-white/5 transition-colors cursor-pointer group">
                    <Upload className="w-8 h-8 text-muted-foreground group-hover:text-accent" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold">Voice & Video</p>
                      <p className="text-[10px] text-muted-foreground">Essential for voice synthesis</p>
                    </div>
                  </div>
                  <div className="p-6 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center gap-3 hover:bg-white/5 transition-colors cursor-pointer group">
                    <Upload className="w-8 h-8 text-muted-foreground group-hover:text-accent" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold">Photos & Documents</p>
                      <p className="text-[10px] text-muted-foreground">Essential for personality context</p>
                    </div>
                  </div>
                </div>
                <div className="bg-primary/20 p-4 rounded-xl border border-accent/20 flex gap-4">
                   <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent shrink-0">
                      <Users className="w-5 h-5" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-xs font-bold">Privacy Note</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Uploaded media is processed securely. Only invited family members will have access to this echo.
                      </p>
                   </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Final Narrative</h2>
                  <p className="text-muted-foreground">Briefly summarize their essence in your own words.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Short Bio</Label>
                    <Textarea 
                      placeholder="e.g. He was a quiet man who expressed his love through cooking and carpentry. He never forgot a birthday..." 
                      className="bg-white/5 border-white/10 min-h-[150px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Permissions</Label>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                       <span className="text-sm">Allow family members to invite others</span>
                       <div className="w-10 h-6 bg-accent rounded-full relative">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-accent-foreground rounded-full" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-8">
              {step > 1 && (
                <Button variant="outline" size="lg" className="flex-1 border-white/10" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button size="lg" className="flex-[2] bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleNext}>
                {step === 3 ? 'Generate Profile' : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
