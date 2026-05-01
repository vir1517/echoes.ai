
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { MOCK_LOVED_ONES, LovedOne } from '@/lib/mock-data';
import { Button } from "@/components/ui/button";
import { Mic, ArrowLeft, Share2, Calendar, MapPin, Sparkles, BookOpen, Quote, Heart } from "lucide-react";
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EchoOrb } from '@/components/echo-orb';
import { conversationalPersonaInteraction } from '@/ai/flows/conversational-persona-interaction';
import { useToast } from "@/hooks/use-toast";
import { getProfileById } from '@/lib/puter';
import { cn } from '@/lib/utils';

export default function ProfileDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [person, setPerson] = useState<LovedOne | null>(null);
  const [activeTab, setActiveTab] = useState("story");
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', content: string}[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const cloudProfile = await getProfileById(id as string);
        const mockProfile = MOCK_LOVED_ONES.find(p => p.id === id);
        const found = cloudProfile || mockProfile;
        
        if (found) {
          setPerson(found);
        } else {
          toast({ title: "Profile not found", variant: "destructive" });
          router.push('/');
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    }
    load();
  }, [id, router, toast]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleAIResponse(transcript);
      };

      recognitionRef.current.onend = () => {
        if (orbState === 'listening') setOrbState('idle');
      };

      recognitionRef.current.onerror = () => {
        setOrbState('idle');
      };
    }
  }, [orbState]);

  const handleAIResponse = async (userInput: string) => {
    if (!person) return;
    setOrbState('thinking');
    try {
      const newHistory = [...chatHistory, { role: 'user' as const, content: userInput }];
      const result = await conversationalPersonaInteraction({
        personaId: person.id,
        userInputText: userInput,
        conversationHistory: chatHistory
      });

      setChatHistory([...newHistory, { role: 'model' as const, content: result.responseText }]);
      setLastResponse(result.responseText);
      
      if (result.responseAudioDataUri) {
        const audio = new Audio(result.responseAudioDataUri);
        audioRef.current = audio;
        audio.onended = () => {
          setOrbState('idle');
          setLastResponse(null);
        };
        setOrbState('speaking');
        await audio.play();
      }
    } catch (error) {
      setOrbState('idle');
      toast({ title: "Memory stream disconnected", variant: "destructive" });
    }
  };

  const handleSpeak = () => {
    if (orbState === 'listening') {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast({ title: "Speech not supported", description: "Your browser doesn't support voice recognition.", variant: "destructive" });
        return;
      }
      setOrbState('listening');
      recognitionRef.current.start();
    }
  };

  if (!person) return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      <p className="text-muted-foreground animate-pulse">Entering the Vault...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-20 px-8 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="font-bold text-lg">{person.name}</h2>
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{person.relation}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-white">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <div className="flex justify-center py-6 glass bg-white/[0.02]">
            <TabsList className="bg-white/5 rounded-full p-1 border border-white/5 h-12">
              <TabsTrigger value="story" className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-white">
                <BookOpen className="w-4 h-4 mr-2" /> Their Story
              </TabsTrigger>
              <TabsTrigger value="speak" className="rounded-full px-8 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                <Sparkles className="w-4 h-4 mr-2" /> Speak With Them
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="story" className="flex-1 max-w-6xl mx-auto w-full px-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="grid md:grid-cols-3 gap-16">
              <div className="space-y-12">
                <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden border-2 border-primary shadow-2xl group">
                  <Image 
                    src={person.avatarUrl} 
                    alt={person.name} 
                    fill 
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100" 
                    data-ai-hint="portrait elderly"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                </div>
                
                <div className="space-y-8 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> Snapshot
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{person.birthYear} — {person.passingYear}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{person.birthPlace}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Personality</h3>
                    <div className="flex flex-wrap gap-2">
                      {(person.traits || []).map(trait => (
                        <span key={trait} className="text-[10px] px-3 py-1 rounded-full bg-primary/20 text-white/70 border border-white/5 uppercase tracking-tighter">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-16">
                <section className="space-y-8 relative">
                  <Quote className="absolute -top-6 -left-8 w-16 h-16 text-accent/10 -z-10" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Biography</h3>
                  <div className="space-y-6">
                    <p className="text-2xl font-medium leading-relaxed text-white/90 italic first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left">
                      {person.summary}
                    </p>
                  </div>
                </section>

                {person.beliefs && person.beliefs.length > 0 && (
                  <section className="space-y-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Core Beliefs</h3>
                    <div className="grid gap-4">
                      {person.beliefs.map((belief, idx) => (
                        <div key={idx} className="p-6 bg-white/5 rounded-2xl border border-white/5 flex gap-4 items-start group hover:bg-white/10 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 text-xs font-bold">
                            {idx + 1}
                          </div>
                          <p className="text-lg text-white/80">{belief}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {person.phrases && person.phrases.length > 0 && (
                  <section className="space-y-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Common Phrases</h3>
                    <div className="flex flex-wrap gap-4">
                      {person.phrases.map((phrase, idx) => (
                        <div key={idx} className="px-6 py-4 bg-primary/10 rounded-2xl border border-primary/20 italic text-white/70">
                          "{phrase}"
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-8 pb-12">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Memory Bank</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square relative rounded-3xl overflow-hidden border border-white/5 hover:scale-[1.05] transition-all duration-500 cursor-pointer group shadow-xl">
                        <Image 
                          src={`https://picsum.photos/seed/mem-${person.id}-${i}/400/400`} 
                          alt="Memory" 
                          fill 
                          className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700" 
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="speak" className="flex-1 flex flex-col items-center justify-center relative animate-in zoom-in-95 duration-1000">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-accent/5 rounded-full blur-[150px] opacity-40 animate-pulse-slow" />
            </div>

            <div className="z-10 flex flex-col items-center gap-16 max-w-2xl text-center px-8">
              <EchoOrb state={orbState} />
              
              <div className="h-40 flex items-center justify-center w-full">
                {orbState === 'idle' && (
                  <p className="text-muted-foreground/40 text-sm tracking-[0.3em] uppercase font-bold animate-pulse">Tap the heart to speak</p>
                )}
                {orbState === 'listening' && (
                  <p className="text-accent text-xl font-bold tracking-widest uppercase flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                    Listening
                  </p>
                )}
                {orbState === 'thinking' && (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-muted-foreground italic text-xl">Recalling memories...</p>
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
                {orbState === 'speaking' && lastResponse && (
                  <p className="text-3xl text-white/90 font-medium italic leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-xl">
                    "{lastResponse}"
                  </p>
                )}
              </div>

              <button 
                onClick={handleSpeak}
                disabled={orbState === 'thinking' || orbState === 'speaking'}
                className={cn(
                  "w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700 border-2 relative group",
                  orbState === 'listening' 
                    ? "bg-accent border-accent text-accent-foreground scale-110 shadow-[0_0_80px_rgba(82,224,224,0.5)]" 
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:scale-105"
                )}
              >
                <div className={cn(
                  "absolute inset-0 rounded-full border border-accent animate-ping opacity-0",
                  orbState === 'listening' && "opacity-40"
                )} />
                <Mic className={cn("w-12 h-12 transition-all duration-500", orbState === 'listening' && "scale-110")} />
              </button>
            </div>

            <div className="absolute bottom-12 left-0 right-0 text-center px-12">
              <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
                <Heart className="w-4 h-4 text-accent" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.25em] max-w-md mx-auto leading-loose font-bold">
                  Responses are woven from their own words, stories, and memories — not invented.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
