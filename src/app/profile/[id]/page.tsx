"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, ArrowLeft, Share2, Calendar, MapPin, Sparkles, BookOpen, Quote, Volume2, Pencil, Trash2, StopCircle } from "lucide-react";
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EchoOrb } from '@/components/echo-orb';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { getProfileById, deleteProfile } from '@/lib/storage';
import { converseWithPersona, deleteVoiceboxProfile, speakWithBrowserTTS, initAudioContext, buildKnowledgeChunks, buildProfileEvidence, warmVoiceAndLanguageModels } from '@/lib/local-ai';
import type { LovedOne } from '@/lib/mock-data';

export default function ProfileDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [person, setPerson] = useState<LovedOne | null>(null);
  const [activeTab, setActiveTab] = useState("story");
  const [orbState, setOrbState] = useState<'idle'|'listening'|'thinking'|'speaking'>('idle');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{role:'user'|'model';content:string}[]>([]);
  const [transcript, setTranscript] = useState<{who:'you'|'them';text:string}[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const found = await getProfileById(id as string);
      if (found) {
        if (!found.knowledgeChunks?.length)
          found.knowledgeChunks = buildKnowledgeChunks({ ...found, memorySnippets: (found as any).memorySnippets || [] });
        if (!found.sourceEvidence)
          found.sourceEvidence = buildProfileEvidence(found as any);
        setPerson(found);
      } else {
        toast({ title: "Profile not found", variant: "destructive" });
        router.push('/');
      }
    })();
  }, [id, router, toast]);

  useEffect(() => { warmVoiceAndLanguageModels(); }, []);

  const handleAIResponse = useCallback(async (text: string) => {
    if (!person) return;
    setOrbState('thinking');
    setTranscript(prev => [...prev, { who: 'you', text }]);
    try {
      const result = await converseWithPersona({
        personaId: person.id,
        personaContext: {
          name: person.name, summary: person.summary,
          traits: person.traits || [], phrases: person.phrases || [],
          sourceEvidence: person.sourceEvidence || [],
          voiceProfile: person.voiceProfile,
          voiceSampleDataUri: person.voiceSampleDataUri,
          knowledgeChunks: person.knowledgeChunks || [],
        },
        userInputText: text,
        conversationHistory: chatHistory,
      });
      setLastResponse(result.responseText);
      setTranscript(prev => [...prev, { who: 'them', text: result.responseText }]);
      setChatHistory(prev => [...prev,
        { role: 'user', content: text },
        { role: 'model', content: result.responseText }
      ]);
      await speakWithBrowserTTS(result.responseText, person.voiceSampleDataUri, {
        onStart: () => setOrbState('speaking'),
        onEnd: () => setOrbState('idle'),
      });
    } catch (err) {
      console.error(err);
      setOrbState('idle');
      toast({ title: "Connection interrupted", variant: "destructive" });
    }
  }, [person, chatHistory, toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = 'en-US';
    r.onstart = () => setOrbState('listening');
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; if (t) handleAIResponse(t); };
    r.onerror = (e: any) => { setOrbState('idle'); if (e.error === 'not-allowed') toast({ title: "Microphone denied", variant: "destructive" }); };
    r.onend = () => setOrbState(p => p === 'listening' ? 'idle' : p);
    recognitionRef.current = r;
    return () => { r.stop(); window.speechSynthesis?.cancel(); };
  }, [handleAIResponse, toast]);

  const handleSpeak = () => {
    initAudioContext();
    if (orbState === 'speaking') { window.speechSynthesis?.cancel(); setOrbState('idle'); return; }
    if (orbState === 'listening') { recognitionRef.current?.stop(); return; }
    if (!recognitionRef.current) { toast({ title: "Voice not supported", variant: "destructive" }); return; }
    setOrbState('listening');
    recognitionRef.current.start();
  };

  const handleDelete = async () => {
    if (!person || !confirm(`Remove ${person.name}'s Echo?`)) return;
    if (person.voiceSampleDataUri) {
      const ok = await deleteVoiceboxProfile(person.voiceSampleDataUri);
      if (!ok) { toast({ title: "Voice delete failed", variant: "destructive" }); return; }
    }
    const ok = await deleteProfile(person.id);
    if (ok) { toast({ title: "Echo removed" }); router.push('/'); }
    else toast({ title: "Delete failed", variant: "destructive" });
  };

  if (!person) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[40vw] h-[40vw] rounded-full opacity-30"
          style={{background:'radial-gradient(circle, hsla(175,60%,55%,0.05) 0%, transparent 70%)'}} />
      </div>

      {/* header */}
      <header className="glass sticky top-0 z-50 h-18 px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}
            className="rounded-full bg-white/5 border border-white/8 hover:bg-accent/10 hover:text-accent w-9 h-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg text-white/90 leading-tight" style={{fontFamily:'Cormorant Garamond, serif', fontWeight:300}}>
              {person.name}
            </h2>
            <span className="text-[9px] uppercase tracking-[0.35em] text-accent/60">{person.relation}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/profile/new?edit=${person.id}`)}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/8 hover:text-accent"><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/8 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon"
            className="w-8 h-8 rounded-full bg-white/5 border border-white/8 hover:text-accent"><Share2 className="w-3.5 h-3.5" /></Button>
        </div>
      </header>

      {/* tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex justify-center pt-6 pb-2">
          <TabsList className="bg-white/5 rounded-full p-1 border border-white/8 h-11 gap-1">
            <TabsTrigger value="story"
              className="rounded-full px-8 h-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-xs font-light uppercase tracking-[0.2em] transition-all gap-2">
              <BookOpen className="w-3.5 h-3.5" />Story
            </TabsTrigger>
            <TabsTrigger value="speak"
              className="rounded-full px-8 h-full data-[state=active]:bg-accent data-[state=active]:text-accent-foreground text-xs font-light uppercase tracking-[0.2em] transition-all gap-2">
              <Sparkles className="w-3.5 h-3.5" />Speak
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── STORY TAB ── */}
        <TabsContent value="story" className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-12 gap-16">

            {/* left col */}
            <div className="lg:col-span-4 space-y-8">
              {/* portrait */}
              <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl group aspect-[3/4]">
                <Image src={person.avatarUrl} alt={person.name} fill
                  className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              </div>

              {/* snapshot */}
              <div className="space-y-5 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-[9px] uppercase tracking-[0.4em] text-accent/60">The Snapshot</p>
                <div className="space-y-3 text-sm text-muted-foreground font-light">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-white/20 shrink-0" />
                    <span>{person.birthYear} — {person.passingYear}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-white/20 shrink-0" />
                    <span>{person.birthPlace}</span>
                  </div>
                </div>
                {/* traits */}
                <div className="pt-2 flex flex-wrap gap-2">
                  {(person.traits || []).map(t => (
                    <span key={t} className="text-[9px] px-3 py-1 rounded-full border border-white/8 text-white/30 uppercase tracking-wider font-light">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* right col */}
            <div className="lg:col-span-8 space-y-14">
              {/* biography */}
              <section className="space-y-6 relative">
                <Quote className="absolute -top-6 -left-8 w-16 h-16 text-accent/5" />
                <p className="text-[9px] uppercase tracking-[0.4em] text-accent/60">Biography</p>
                <p className="text-xl leading-relaxed text-white/75 font-light"
                  style={{fontFamily:'Cormorant Garamond, serif'}}>
                  {person.summary}
                </p>
              </section>

              {/* beliefs */}
              {person.beliefs?.length > 0 && (
                <section className="space-y-6">
                  <p className="text-[9px] uppercase tracking-[0.4em] text-accent/60">Core Values</p>
                  <div className="grid gap-3">
                    {person.beliefs.map((b, i) => (
                      <div key={i} className="flex gap-4 items-start p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                        <span className="text-xs text-accent/40 font-light mt-0.5 shrink-0">{String(i+1).padStart(2,'0')}</span>
                        <p className="text-base text-white/65 font-light leading-relaxed">{b}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* phrases */}
              {person.phrases?.length > 0 && (
                <section className="space-y-6">
                  <p className="text-[9px] uppercase tracking-[0.4em] text-accent/60">Common Phrases</p>
                  <div className="flex flex-wrap gap-3">
                    {person.phrases.map((p, i) => (
                      <div key={i} className="px-5 py-3 rounded-xl border border-white/8 text-white/45 font-light italic text-sm hover:text-white/70 transition-colors cursor-default"
                        style={{fontFamily:'Cormorant Garamond, serif'}}>
                        "{p}"
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── SPEAK TAB ── */}
        <TabsContent value="speak" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 py-8 gap-6">

            {/* conversation transcript */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide min-h-0">
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 opacity-40">
                  <p className="text-sm font-light text-muted-foreground">Press the microphone and speak</p>
                  <p className="text-xs font-light text-muted-foreground/60">
                    {person.name} is listening...
                  </p>
                </div>
              ) : (
                transcript.map((line, i) => (
                  <div key={i} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500",
                    line.who === 'you' ? "justify-end" : "justify-start")}>
                    {line.who === 'them' && (
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10 shrink-0 mt-1">
                        <Image src={person.avatarUrl} alt="" width={28} height={28} className="object-cover grayscale" />
                      </div>
                    )}
                    <div className={cn("max-w-[75%] px-4 py-3 rounded-2xl text-sm font-light leading-relaxed",
                      line.who === 'you'
                        ? "bg-white/8 text-white/70 rounded-tr-sm"
                        : "bg-accent/8 border border-accent/10 text-white/80 rounded-tl-sm"
                    )}
                      style={line.who === 'them' ? {fontFamily:'Cormorant Garamond, serif', fontSize:'1rem'} : {}}>
                      {line.text}
                    </div>
                  </div>
                ))
              )}

              {/* live state indicator */}
              {orbState === 'thinking' && (
                <div className="flex gap-3 justify-start animate-in fade-in duration-300">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10 shrink-0">
                    <Image src={person.avatarUrl} alt="" width={28} height={28} className="object-cover grayscale" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-accent/8 border border-accent/10">
                    <div className="flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* orb + mic */}
            <div className="flex flex-col items-center gap-6 pt-4 border-t border-white/5">
              <EchoOrb state={orbState} className="scale-75 -my-4" />

              {/* status text */}
              <div className="h-6 flex items-center justify-center">
                {orbState === 'idle' && (
                  <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/30 font-light animate-pulse">
                    tap to speak
                  </p>
                )}
                {orbState === 'listening' && (
                  <div className="flex items-center gap-2 text-accent">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping-slow" />
                    <span className="text-[10px] uppercase tracking-[0.4em] font-light">Listening</span>
                  </div>
                )}
                {orbState === 'thinking' && (
                  <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/50 font-light">Recalling...</p>
                )}
                {orbState === 'speaking' && (
                  <div className="flex items-center gap-2 text-accent/60">
                    <Volume2 className="w-3 h-3" />
                    <span className="text-[10px] uppercase tracking-[0.4em] font-light">Speaking</span>
                  </div>
                )}
              </div>

              {/* mic button */}
              <button onClick={handleSpeak} disabled={orbState === 'thinking'}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 border relative",
                  orbState === 'listening'
                    ? "bg-accent border-accent text-accent-foreground scale-110 shadow-[0_0_40px_hsla(175,60%,55%,0.4)]"
                    : orbState === 'speaking'
                    ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white hover:scale-105"
                )}>
                {orbState === 'listening' && (
                  <div className="absolute inset-0 rounded-full border border-accent/40 animate-ping-slow" />
                )}
                {orbState === 'speaking'
                  ? <StopCircle className="w-6 h-6" />
                  : <Mic className={cn("w-6 h-6", orbState === 'listening' && "scale-110")} />
                }
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
