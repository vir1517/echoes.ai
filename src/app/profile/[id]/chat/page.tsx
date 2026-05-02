
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LovedOne } from '@/lib/mock-data';
import { Button } from "@/components/ui/button";
import { Mic, X, MoreVertical, Volume2, Info } from "lucide-react";
import Image from 'next/image';
import { VoiceVisualizer } from '@/components/voice-visualizer';
import { useToast } from "@/hooks/use-toast";
import { converseWithPersona, speakWithBrowserTTS, unlockClonedVoiceAudio } from '@/lib/local-ai';
import { getProfileById } from '@/lib/storage';

export default function EchoConversation() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [person, setPerson] = useState<LovedOne | null>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', content: string}[]>([]);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadProfile() {
      const profile = await getProfileById(id as string);
      setPerson(profile as LovedOne | null);
    }
    loadProfile();
  }, [id]);

  useEffect(() => {
    // Initial greeting simulation
    const timer = setTimeout(() => {
      setLastResponse(`Hello there... it's so good to hear from you.`);
      setIsPlaying(true);
      // In a real app, we might trigger a TTS generation here for the initial greeting
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!person) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading Echo...</div>;

  const handleMicClick = async () => {
    unlockClonedVoiceAudio();
    if (isListening) {
      setIsListening(false);
      // Mock finishing the sentence for the demo
      setIsThinking(true);
      
      try {
        const mockUserInput = "Tell me about that summer you spent in the mountains.";
        const result = await converseWithPersona({
          personaId: person.id,
          personaContext: {
            name: person.name,
            summary: person.summary,
            traits: person.traits || [],
            phrases: person.phrases || [],
            sourceEvidence: person.sourceEvidence || [],
            voiceProfile: person.voiceProfile,
            voiceSampleDataUri: person.voiceSampleDataUri,
          },
          userInputText: mockUserInput,
          conversationHistory: chatHistory
        });

        setChatHistory(prev => [...prev, 
          { role: 'user', content: mockUserInput },
          { role: 'model', content: result.responseText }
        ]);

        setLastResponse(result.responseText);
        
        await speakWithBrowserTTS(result.responseText, person.voiceSampleDataUri, {
          onStart: () => setIsPlaying(true),
          onEnd: () => {
            setIsPlaying(false);
            setLastResponse(null);
          },
          expectClonedVoice: Boolean(person.voiceProfile?.hasReferenceAudio),
        });
      } catch (error) {
        toast({
          title: "Interaction Error",
          description: "Could not connect to the memory stream. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsThinking(false);
      }
    } else {
      setIsListening(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl aspect-square bg-primary/10 rounded-full blur-[100px] animate-pulse-slow" />
      </div>

      <header className="w-full max-w-4xl flex items-center justify-between z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/5 border border-white/5">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-1">Live Echo Session</span>
          <h2 className="font-bold text-lg">{person.name}</h2>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full bg-white/5 border border-white/5">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 w-full flex flex-col items-center justify-center gap-12 z-10">
        {/* Profile Visualization */}
        <div className="relative group">
          <div className={`absolute -inset-4 bg-accent/20 rounded-full blur-2xl transition-all duration-1000 ${isPlaying ? 'opacity-100 scale-110' : 'opacity-0 scale-100'}`} />
          <div className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-4 ${isPlaying ? 'border-accent shadow-[0_0_50px_rgba(82,224,224,0.3)]' : 'border-primary'} transition-all duration-700`}>
            <Image 
              src={person.avatarUrl} 
              alt={person.name} 
              fill 
              className={`object-cover ${isPlaying ? 'scale-105' : 'scale-100'} transition-transform duration-1000`}
              data-ai-hint="portrait elderly"
            />
          </div>
          {isPlaying && (
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl">
              <Volume2 className="w-3 h-3" />
              Speaking
            </div>
          )}
        </div>

        {/* Dynamic Transcription / Thinking / Active Visuals */}
        <div className="h-24 w-full max-w-2xl flex flex-col items-center justify-center text-center px-6">
          {isThinking ? (
            <div className="space-y-4 flex flex-col items-center">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-accent rounded-full animate-bounce" />
              </div>
              <p className="text-muted-foreground text-sm tracking-wide">Recalling memories...</p>
            </div>
          ) : isPlaying || lastResponse ? (
            <p className="text-xl md:text-2xl font-medium leading-tight text-white/90 italic animate-in fade-in slide-in-from-bottom-2 duration-700">
              "{lastResponse}"
            </p>
          ) : isListening ? (
            <div className="space-y-4 flex flex-col items-center">
              <VoiceVisualizer isActive={true} />
              <p className="text-accent text-sm font-bold uppercase tracking-widest animate-pulse">Listening</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground text-sm flex items-center gap-2">
                <Info className="w-4 h-4" /> Tap the microphone to speak
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full flex justify-center p-8 z-10">
        <button 
          onClick={handleMicClick}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95
            ${isListening 
              ? 'bg-accent text-accent-foreground shadow-[0_0_30px_rgba(82,224,224,0.5)]' 
              : 'bg-primary text-white border border-accent/20 hover:bg-primary/80'}
          `}
        >
          <div className={`absolute inset-0 rounded-full border-2 border-accent animate-ping ${isListening ? 'opacity-100' : 'opacity-0'}`} />
          <Mic className={`w-8 h-8 ${isListening ? 'animate-pulse' : ''}`} />
        </button>
      </footer>
    </div>
  );
}
