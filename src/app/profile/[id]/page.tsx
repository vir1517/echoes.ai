"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { MOCK_LOVED_ONES } from '@/lib/mock-data';
import { Button } from "@/components/ui/button";
import { Mic, ArrowLeft, History, Heart, Share2, Calendar, MapPin, Sparkles, BookOpen } from "lucide-react";
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EchoOrb } from '@/components/echo-orb';
import { conversationalPersonaInteraction } from '@/ai/flows/conversational-persona-interaction';
import { useToast } from "@/hooks/use-toast";

export default function ProfileDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const person = MOCK_LOVED_ONES.find(p => p.id === id);

  const [activeTab, setActiveTab] = useState("story");
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!person) return <div>Profile not found</div>;

  const handleSpeak = async () => {
    if (orbState === 'listening') {
      setOrbState('thinking');
      try {
        const result = await conversationalPersonaInteraction({
          personaId: person.id,
          userInputText: "Tell me about your childhood",
          conversationHistory: []
        });

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
    } else {
      setOrbState('listening');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-1000 ${activeTab === 'speak' ? 'bg-background' : 'bg-background'}`}>
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
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-white">
            <History className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <div className="flex justify-center py-6 bg-background">
            <TabsList className="bg-white/5 rounded-full p-1 border border-white/5 h-12">
              <TabsTrigger value="story" className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-white">
                <BookOpen className="w-4 h-4 mr-2" /> Their Story
              </TabsTrigger>
              <TabsTrigger value="speak" className="rounded-full px-8 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                <Mic className="w-4 h-4 mr-2" /> Speak With Them
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="story" className="flex-1 max-w-7xl mx-auto w-full px-8 py-8 animate-in fade-in duration-700">
            <div className="grid md:grid-cols-3 gap-16">
              {/* Sidebar Info */}
              <div className="space-y-12">
                <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden border-2 border-primary shadow-2xl group">
                  <Image 
                    src={person.avatarUrl} 
                    alt={person.name} 
                    fill 
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
                    data-ai-hint="portrait elderly"
                  />
                </div>
                
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Snapshot</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-sm">{person.birthYear} — {person.passingYear}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-sm">Born in {person.birthPlace}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm">{person.occupation}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Common Phrases</h3>
                    <div className="flex flex-wrap gap-2">
                      {person.phrases.map(phrase => (
                        <span key={phrase} className="px-4 py-2 rounded-xl bg-primary/10 border border-white/5 text-sm italic">
                          "{phrase}"
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="md:col-span-2 space-y-16">
                <section className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Biography</h3>
                  <p className="text-2xl font-medium leading-relaxed text-white/90 italic">
                    {person.summary}
                  </p>
                </section>

                <section className="space-y-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Life Timeline</h3>
                  <div className="space-y-8 relative">
                    <div className="absolute top-0 bottom-0 left-4 w-px bg-white/5" />
                    {person.events.map((event, i) => (
                      <div key={i} className="flex gap-8 relative">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 border-4 border-background z-10">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                        </div>
                        <div className="space-y-1 pt-1">
                          <span className="text-xs font-bold text-accent">{event.year}</span>
                          <h4 className="font-bold text-xl">{event.title}</h4>
                          <p className="text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent">Memory Bank</h3>
                    <Button variant="link" className="text-accent text-xs p-0">View All</Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square relative rounded-3xl overflow-hidden border border-white/5 hover:scale-[1.05] transition-all duration-500 cursor-pointer group">
                        <Image 
                          src={`https://picsum.photos/seed/mem-${i+10}/400/400`} 
                          alt="Memory" 
                          fill 
                          className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                          data-ai-hint="old family photo"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="speak" className="flex-1 flex flex-col items-center justify-center relative bg-background animate-in zoom-in-95 duration-1000">
            {/* Sacred Minimal Interface */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-accent/5 rounded-full blur-[150px] opacity-40" />
            </div>

            <div className="z-10 flex flex-col items-center gap-16 max-w-md text-center">
              <EchoOrb state={orbState} />
              
              <div className="h-32 flex items-center justify-center">
                {orbState === 'idle' && (
                  <p className="text-muted-foreground/60 text-sm tracking-widest uppercase font-medium">Tap to begin speaking</p>
                )}
                {orbState === 'listening' && (
                  <p className="text-accent text-lg font-bold animate-pulse tracking-widest uppercase">Listening...</p>
                )}
                {orbState === 'thinking' && (
                  <p className="text-muted-foreground italic text-lg animate-pulse">Recalling memories...</p>
                )}
                {orbState === 'speaking' && lastResponse && (
                  <p className="text-2xl text-white/90 font-medium italic leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    "{lastResponse}"
                  </p>
                )}
              </div>

              <button 
                onClick={handleSpeak}
                disabled={orbState === 'thinking' || orbState === 'speaking'}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 border-2",
                  orbState === 'listening' ? "bg-accent border-accent text-accent-foreground scale-110 shadow-[0_0_50px_rgba(255,191,0,0.4)]" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                )}
              >
                <Mic className={cn("w-10 h-10", orbState === 'listening' && "animate-pulse")} />
              </button>
            </div>

            <div className="absolute bottom-12 left-0 right-0 text-center px-8">
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                Responses are woven from their own words, stories, and memories — not invented.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
