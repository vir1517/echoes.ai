"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { MOCK_LOVED_ONES, LovedOne } from '@/lib/mock-data';
import { Button } from "@/components/ui/button";
import { Mic, ArrowLeft, Share2, Calendar, MapPin, Sparkles, BookOpen, Quote, Volume2, Heart } from "lucide-react";
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
          setPerson(found as LovedOne);
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

  // Initialize Web Speech API with better error handling and lifecycle management
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setOrbState('listening');
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            handleAIResponse(transcript);
          } else {
            setOrbState('idle');
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          setOrbState('idle');
          if (event.error === 'not-allowed') {
            toast({ 
              title: "Microphone Access Denied", 
              description: "Please enable microphone permissions to speak.", 
              variant: "destructive" 
            });
          } else if (event.error !== 'no-speech') {
            toast({ 
              title: "Recognition Error", 
              description: `Something went wrong: ${event.error}`, 
              variant: "destructive" 
            });
          }
        };

        recognition.onend = () => {
          // Only reset if we aren't processing a result
          setOrbState(prev => (prev === 'listening' ? 'idle' : prev));
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [toast]);

  const handleAIResponse = async (userInput: string) => {
    if (!person) return;
    
    setOrbState('thinking');
    
    try {
      const result = await conversationalPersonaInteraction({
        personaId: person.id,
        personaContext: {
          name: person.name,
          summary: person.summary,
          traits: person.traits || [],
          phrases: person.phrases || [],
        },
        userInputText: userInput,
        conversationHistory: chatHistory
      });

      const newHistory = [
        ...chatHistory, 
        { role: 'user' as const, content: userInput },
        { role: 'model' as const, content: result.responseText }
      ];
      setChatHistory(newHistory);
      setLastResponse(result.responseText);
      
      if (result.responseAudioDataUri) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(result.responseAudioDataUri);
        audioRef.current = audio;
        
        audio.onplay = () => {
          setOrbState('speaking');
        };

        audio.onended = () => {
          setOrbState('idle');
        };

        await audio.play();
      } else {
        setOrbState('idle');
      }
    } catch (error) {
      console.error("AI Response Error:", error);
      setOrbState('idle');
      toast({ 
        title: "Connection Interrupted", 
        description: "The memory stream was lost. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleSpeak = () => {
    if (orbState === 'listening') {
      try { recognitionRef.current?.stop(); } catch (e) {}
    } else {
      if (!recognitionRef.current) {
        toast({ 
          title: "Speech Not Supported", 
          description: "Your browser doesn't support voice recognition. Try Chrome or Safari.", 
          variant: "destructive" 
        });
        return;
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
      }

      setLastResponse(null);
      setOrbState('listening');
      
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setOrbState('idle');
      }
    }
  };

  if (!person) return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-8 bg-background">
      <div className="relative">
        <div className="absolute inset-0 bg-accent/20 rounded-full blur-3xl animate-pulse" />
        <div className="w-20 h-20 border-4 border-accent/20 border-t-accent rounded-full animate-spin relative" />
      </div>
      <p className="text-muted-foreground font-bold tracking-[0.3em] uppercase animate-pulse">Entering the Vault</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-24 px-8 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full bg-white/5 border border-white/5 hover:bg-accent/10 hover:text-accent transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="font-bold text-2xl tracking-tight text-white">{person.name}</h2>
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">{person.relation}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white/5 border border-white/5 hover:text-accent transition-all">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <div className="flex justify-center py-8 glass bg-white/[0.01]">
            <TabsList className="bg-white/5 rounded-full p-1.5 border border-white/5 h-14">
              <TabsTrigger value="story" className="rounded-full px-10 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs font-bold uppercase tracking-widest">
                <BookOpen className="w-4 h-4 mr-3" /> Their Story
              </TabsTrigger>
              <TabsTrigger value="speak" className="rounded-full px-10 h-full data-[state=active]:bg-accent data-[state=active]:text-accent-foreground transition-all text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-4 h-4 mr-3" /> Speak With Them
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="story" className="flex-1 max-w-7xl mx-auto w-full px-10 py-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="grid lg:grid-cols-12 gap-20">
              <div className="lg:col-span-4 space-y-16">
                <div className="relative aspect-[3/4] rounded-[3.5rem] overflow-hidden border-2 border-primary shadow-[0_0_80px_rgba(0,0,0,0.6)] group">
                  <Image 
                    src={person.avatarUrl} 
                    alt={person.name} 
                    fill 
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-[2000ms] scale-105 group-hover:scale-100" 
                    data-ai-hint="portrait elderly"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                </div>
                
                <div className="space-y-10 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5">
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent flex items-center gap-3">
                      <Sparkles className="w-4 h-4" /> The Snapshot
                    </h3>
                    <div className="space-y-5">
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="text-sm font-semibold tracking-wide">{person.birthYear} — {person.passingYear}</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <MapPin className="w-5 h-5 text-primary" />
                        <span className="text-sm font-semibold tracking-wide">{person.birthPlace}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Personality Traits</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {(person.traits || []).map(trait => (
                        <span key={trait} className="text-[10px] px-4 py-1.5 rounded-full bg-primary/20 text-white/70 border border-white/10 uppercase font-bold tracking-tighter">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-20">
                <section className="space-y-10 relative">
                  <Quote className="absolute -top-10 -left-12 w-24 h-24 text-accent/5 -z-10" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">AI Biography</h3>
                  <div className="space-y-8">
                    <p className="text-2xl font-medium leading-relaxed text-white/90 italic first-letter:text-6xl first-letter:font-bold first-letter:mr-4 first-letter:float-left first-letter:text-accent">
                      {person.summary}
                    </p>
                  </div>
                </section>

                {person.beliefs && person.beliefs.length > 0 && (
                  <section className="space-y-10">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Core Values</h3>
                    <div className="grid gap-5">
                      {person.beliefs.map((belief, idx) => (
                        <div key={idx} className="p-8 bg-white/[0.02] rounded-[2rem] border border-white/5 flex gap-6 items-start group hover:bg-white/[0.04] transition-all duration-500">
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 text-xs font-bold">
                            {idx + 1}
                          </div>
                          <p className="text-xl text-white/80 font-medium">{belief}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {person.phrases && person.phrases.length > 0 && (
                  <section className="space-y-10">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Common Phrases</h3>
                    <div className="flex flex-wrap gap-5">
                      {person.phrases.map((phrase, idx) => (
                        <div key={idx} className="px-8 py-5 bg-primary/10 rounded-[2rem] border border-primary/20 italic text-white/60 text-lg hover:text-white transition-colors cursor-default">
                          "{phrase}"
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-10 pb-20">
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Memory Bank</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square relative rounded-[2.5rem] overflow-hidden border border-white/5 hover:scale-[1.05] transition-all duration-700 cursor-pointer group shadow-2xl">
                        <Image 
                          src={`https://picsum.photos/seed/mem-${person.id}-${i}/600/600`} 
                          alt="Memory" 
                          fill 
                          className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" 
                          data-ai-hint="old photo"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="speak" className="flex-1 flex flex-col items-center justify-center relative animate-in zoom-in-95 duration-[1500ms] overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-accent/5 rounded-full blur-[200px] opacity-40 animate-pulse-slow" />
            </div>

            <div className="z-10 flex flex-col items-center gap-20 max-w-3xl text-center px-10">
              <EchoOrb state={orbState} />
              
              <div className="h-48 flex items-center justify-center w-full">
                {orbState === 'idle' && (
                  <p className="text-muted-foreground/40 text-sm tracking-[0.4em] uppercase font-bold animate-pulse">Tap the microphone to speak</p>
                )}
                {orbState === 'listening' && (
                  <div className="flex flex-col items-center gap-6">
                    <p className="text-accent text-2xl font-bold tracking-[0.3em] uppercase flex items-center gap-4">
                      <span className="w-3 h-3 rounded-full bg-accent animate-ping" />
                      Listening
                    </p>
                  </div>
                )}
                {orbState === 'thinking' && (
                  <div className="flex flex-col items-center gap-6">
                    <p className="text-muted-foreground italic text-2xl font-medium">Recalling memories...</p>
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
                {orbState === 'speaking' && lastResponse && (
                  <div className="flex flex-col items-center gap-6">
                    <p className="text-4xl text-white/95 font-medium italic leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-[1500ms] max-w-2xl">
                      "{lastResponse}"
                    </p>
                    <div className="flex items-center gap-3 text-accent/40">
                      <Volume2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Speaking</span>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleSpeak}
                disabled={orbState === 'thinking' || orbState === 'speaking'}
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 border-2 relative group",
                  orbState === 'listening' 
                    ? "bg-accent border-accent text-accent-foreground scale-110 shadow-[0_0_100px_rgba(82,224,224,0.6)]" 
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:scale-110 hover:border-accent/30"
                )}
              >
                <div className={cn(
                  "absolute inset-0 rounded-full border border-accent animate-ping opacity-0",
                  orbState === 'listening' && "opacity-40"
                )} />
                <Mic className={cn("w-14 h-14 transition-all duration-700", orbState === 'listening' && "scale-110")} />
              </button>
            </div>

            <div className="absolute bottom-16 left-0 right-0 text-center px-12">
              <div className="flex flex-col items-center gap-4 opacity-40 hover:opacity-100 transition-opacity duration-1000">
                <Heart className="w-5 h-5 text-accent" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] max-w-md mx-auto leading-loose font-bold">
                  Responses are woven from their own words and memories.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
