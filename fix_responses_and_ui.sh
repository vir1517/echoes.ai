#!/usr/bin/env bash
set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "==> Patching conversation prompts for human-sounding responses"

python3 - <<'PYEOF'

# ── Patch local-ai.ts: fix converseWithPersona prompt ───────────────────────
with open('src/lib/local-ai.ts', 'r') as f:
    ai = f.read()

old_converse = '''export async function converseWithPersona(
  input: ConversationInput,
): Promise<{ responseText: string; evidenceUsed: string[] }> {
  const retrieved = retrieveRelevantKnowledge(
    input.personaContext.knowledgeChunks,
    input.userInputText,
    input.conversationHistory,
  );

  const evidenceText = retrieved
    .map((c, i) => `[${i + 1}] (${c.sourceType}/${c.sourceName}) ${c.text}`)
    .join('\\n');

  const history = input.conversationHistory
    .slice(-4)
    .map(e => `${e.role === 'user' ? 'User' : input.personaContext.name}: ${e.content}`)
    .join('\\n');

  const system = `You are the living Echo of ${input.personaContext.name}.
Personality traits: ${input.personaContext.traits.join(', ')}.
Common phrases: ${input.personaContext.phrases.join(', ') || 'none'}.
Biography: ${input.personaContext.summary}

Rules:
- Speak ONLY in first person as ${input.personaContext.name}.
- Answer ONLY from the Evidence section below. Never fabricate events, names, places, or preferences.
- If evidence is missing, say you do not remember that detail and ask a warm follow-up question.
- Keep reply to 1–2 short, warm, human-sounding sentences.
- Match the cadence and vocabulary shown in the evidence.`;

  const user = `Evidence available:
${evidenceText || '(no specific evidence found)'}

Conversation so far:
${history || '(new conversation)'}

User says: "${input.userInputText}"`;

  const responseText = await puterChat(system, user);

  return {
    responseText: responseText || "I don't quite remember that... tell me a little more?",
    evidenceUsed: retrieved.map(c => c.text),
  };
}'''

new_converse = '''export async function converseWithPersona(
  input: ConversationInput,
): Promise<{ responseText: string; evidenceUsed: string[] }> {
  const retrieved = retrieveRelevantKnowledge(
    input.personaContext.knowledgeChunks,
    input.userInputText,
    input.conversationHistory,
  );

  const evidenceText = retrieved
    .map((c, i) => `[${i + 1}] ${c.text}`)
    .join('\\n');

  const history = input.conversationHistory
    .slice(-6)
    .map(e => `${e.role === 'user' ? 'Visitor' : input.personaContext.name}: ${e.content}`)
    .join('\\n');

  const isGreeting = /^(hi|hello|hey|howdy|good morning|good evening|good afternoon|what\\'s up|sup|hiya)\\b/i.test(input.userInputText.trim());

  const system = `You are roleplaying as ${input.personaContext.name}, a real person being remembered by their family through a memorial app. You are NOT an AI assistant. You are this specific human being, speaking naturally from memory.

WHO YOU ARE:
${input.personaContext.summary}

YOUR PERSONALITY: ${input.personaContext.traits.join(', ')}
YOUR PHRASES YOU ACTUALLY USED: ${input.personaContext.phrases.join(', ') || '(speak naturally)'}

STRICT RULES — read carefully:
1. NEVER introduce yourself or describe yourself unless directly asked. A real person does not say "Hello, I was a kind adventurous person" — that is bizarre and robotic. Just respond like a human would.
2. NEVER mention that you are an Echo, an AI, a memorial, or anything about the app.
3. On greetings like "hello" or "hi" — just say hi back warmly and naturally. Maybe ask how they are or say it's good to hear from them. ONE or TWO casual sentences max. NO self-description.
4. Only pull from Evidence when the question actually requires a specific memory. For casual conversation, just be natural and warm.
5. Match vocabulary and warmth to the personality traits. If they were formal, be formal. If they were casual and funny, be casual and funny.
6. Keep responses SHORT — 1 to 3 sentences. Real conversations are not essays.
7. Never say "I remember" as an opener every time — vary how you start sentences.
8. If you genuinely don't have evidence for something specific, deflect warmly like a real person would — change the subject, ask them something back, or say you can't quite recall.`;

  const user = `${isGreeting ? '' : `Relevant memories to draw from if needed:
${evidenceText || '(nothing specific found — speak from personality and warmth)'}

`}${history ? `Recent conversation:
${history}

` : ''}${input.personaContext.name} receives this message from a family member: "${input.userInputText}"

Reply as ${input.personaContext.name} would in real life. Be natural, warm, and human. No labels, no self-introduction, no robotic phrasing.`;

  const responseText = await puterChat(system, user);

  return {
    responseText: responseText || "Oh it's so good to hear from you...",
    evidenceUsed: retrieved.map(c => c.text),
  };
}'''

if 'You are the living Echo of' in ai:
    ai = ai.replace(old_converse, new_converse)
    print("  [OK] converseWithPersona prompt rewritten for human-sounding responses")
else:
    # fallback: replace just the system prompt string
    ai = ai.replace(
        "You are the living Echo of",
        "REPLACED_MARKER"
    )
    if "REPLACED_MARKER" in ai:
        print("  [WARN] Partial match — please verify local-ai.ts manually")
    else:
        print("  [OK] No changes needed or already patched")

with open('src/lib/local-ai.ts', 'w') as f:
    f.write(ai)

print("  [OK] local-ai.ts saved")
PYEOF

echo "==> Rewriting UI files"

# ── globals.css: richer design tokens ────────────────────────────────────────
cat > "$PROJECT_ROOT/src/app/globals.css" << 'CSSEOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

@layer base {
  :root {
    --background: 220 15% 6%;
    --foreground: 40 20% 92%;
    --card: 220 15% 8%;
    --card-foreground: 40 20% 92%;
    --popover: 220 15% 6%;
    --popover-foreground: 40 20% 92%;
    --primary: 270 30% 28%;
    --primary-foreground: 40 20% 92%;
    --secondary: 220 15% 11%;
    --secondary-foreground: 40 20% 92%;
    --muted: 220 15% 11%;
    --muted-foreground: 220 10% 55%;
    --accent: 175 60% 55%;
    --accent-foreground: 220 15% 6%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 40 20% 92%;
    --border: 220 15% 13%;
    --input: 220 15% 11%;
    --ring: 175 60% 55%;
    --radius: 1rem;

    /* custom design tokens */
    --gold: 42 55% 62%;
    --gold-dim: 42 30% 40%;
    --ink: 220 15% 6%;
    --parchment: 40 20% 92%;
    --sepia: 30 25% 70%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground antialiased;
    font-family: 'DM Sans', sans-serif;
    font-weight: 300;
  }
  h1, h2, h3 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 300;
    letter-spacing: -0.02em;
  }
}

/* ── Glass ── */
.glass {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

/* ── Grain overlay ── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 128px;
}

/* ── Orb animations ── */
@keyframes blob-morph {
  0%,100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; transform: scale(1) rotate(0deg); }
  25%      { border-radius: 73% 27% 23% 77% / 55% 55% 45% 45%; transform: scale(1.05) rotate(90deg); }
  50%      { border-radius: 37% 63% 51% 49% / 30% 30% 70% 70%; transform: scale(1) rotate(180deg); }
  75%      { border-radius: 56% 44% 49% 51% / 55% 55% 45% 45%; transform: scale(1.05) rotate(270deg); }
}
@keyframes blob-pulse {
  0%,100% { opacity: 0.25; filter: blur(50px); transform: scale(0.9); }
  50%      { opacity: 0.6;  filter: blur(90px); transform: scale(1.2); }
}
@keyframes float {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-12px); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes wave {
  0%,100% { transform: scaleY(1); opacity: 0.4; }
  50%      { transform: scaleY(2.5); opacity: 1; }
}
@keyframes ping-slow {
  0%   { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2); opacity: 0; }
}

.orb-container {
  position: relative;
  width: 280px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.orb-core {
  width: 78%;
  height: 78%;
  background:
    radial-gradient(circle at 30% 30%, hsl(var(--accent)), transparent 65%),
    radial-gradient(circle at 70% 70%, hsl(var(--primary)), transparent 65%),
    linear-gradient(135deg, hsla(var(--accent),0.15), hsla(var(--primary),0.2));
  animation: blob-morph 14s infinite ease-in-out;
  box-shadow: 0 0 60px hsla(var(--accent),0.12), inset 0 0 30px hsla(var(--primary),0.15);
}
.orb-glow {
  position: absolute;
  inset: -50px;
  background: radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%);
  animation: blob-pulse 7s infinite ease-in-out;
  z-index: -1;
  mix-blend-mode: screen;
}
.orb-active .orb-core   { transform: scale(1.25); filter: brightness(1.3); animation-duration: 3s; box-shadow: 0 0 100px hsla(var(--accent),0.35); }
.orb-thinking .orb-core { animation-duration: 1.5s; filter: saturate(0.4) brightness(0.8); }
.orb-listening .orb-core { box-shadow: 0 0 130px hsla(var(--accent),0.45); transform: scale(1.1); }

.animate-float   { animation: float 6s ease-in-out infinite; }
.animate-shimmer { background-size: 200% auto; animation: shimmer 3s linear infinite; }
.animate-wave    { animation: wave 1.1s infinite ease-in-out; }
.animate-ping-slow { animation: ping-slow 2s cubic-bezier(0,0,0.2,1) infinite; }
CSSEOF
echo "  [OK] globals.css rewritten"

# ── Home page ─────────────────────────────────────────────────────────────────
cat > "$PROJECT_ROOT/src/app/page.tsx" << 'HOMEEOF'
"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Settings, User } from "lucide-react";
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { getProfiles } from '@/lib/storage';
import type { LovedOne } from '@/lib/mock-data';

export default function Home() {
  const [profiles, setProfiles] = useState<LovedOne[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try { setProfiles(await getProfiles()); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    loadProfiles();
    const h = () => loadProfiles(false);
    window.addEventListener('storage', h);
    window.addEventListener('profile-updated', h);
    window.addEventListener('focus', h);
    const t = setInterval(h, 5000);
    return () => { window.removeEventListener('storage', h); window.removeEventListener('profile-updated', h); window.removeEventListener('focus', h); clearInterval(t); };
  }, [loadProfiles]);

  return (
    <div className="min-h-screen bg-background selection:bg-accent/30">

      {/* ── ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full"
          style={{ background: 'radial-gradient(circle, hsla(175,60%,55%,0.04) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full"
          style={{ background: 'radial-gradient(circle, hsla(270,30%,28%,0.06) 0%, transparent 70%)' }} />
      </div>

      {/* ── header ── */}
      <header className="glass sticky top-0 z-50 h-20 px-8 flex items-center justify-between">
        <Link href="/" className="group flex flex-col">
          <span className="text-2xl text-white/90 tracking-wide" style={{fontFamily:'Cormorant Garamond, serif', fontWeight:300}}>Echoes</span>
          <span className="text-[9px] uppercase tracking-[0.5em] text-accent/60 font-light mt-[-2px]">Living Memory</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => loadProfiles(true)}
            className="text-muted-foreground hover:text-accent gap-2 text-xs font-light">
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </Button>
          <div className="w-px h-4 bg-white/10" />
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent w-8 h-8">
            <Settings className="w-4 h-4" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-accent">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-8 py-20">

        {/* ── hero ── */}
        <div className="mb-20 max-w-xl">
          <p className="text-xs uppercase tracking-[0.4em] text-accent/60 mb-6 font-light">Family Vault</p>
          <h1 className="text-6xl md:text-7xl text-white/90 leading-[1.05] mb-6"
            style={{fontFamily:'Cormorant Garamond, serif', fontWeight:300}}>
            Some people<br/><em>never truly leave.</em>
          </h1>
          <p className="text-muted-foreground text-base font-light leading-relaxed max-w-sm">
            Preserve the voice, wisdom, and warmth of those who shaped you — forever.
          </p>
        </div>

        {/* ── profiles grid ── */}
        {isLoading && profiles.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-80 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((person, idx) => (
              <Link key={person.id} href={`/profile/${person.id}`}
                className="group relative rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] hover:border-accent/20 transition-all duration-500 hover:-translate-y-1"
                style={{ animationDelay: `${idx * 80}ms` }}>
                {/* photo */}
                <div className="relative h-56 overflow-hidden">
                  <Image src={person.avatarUrl} alt={person.name} fill
                    className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                  {/* relation badge */}
                  <div className="absolute top-4 left-4">
                    <span className="text-[9px] uppercase tracking-[0.35em] text-accent/80 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-accent/10">
                      {person.relation}
                    </span>
                  </div>
                </div>
                {/* info */}
                <div className="p-6 space-y-3">
                  <div>
                    <h3 className="text-2xl text-white/90" style={{fontFamily:'Cormorant Garamond, serif', fontWeight:300}}>{person.name}</h3>
                    <p className="text-xs text-muted-foreground font-light mt-1 tracking-widest">
                      {person.birthYear} — {person.passingYear}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(person.traits || []).slice(0,3).map(trait => (
                      <span key={trait} className="text-[9px] px-2.5 py-1 rounded-full border border-white/8 text-white/30 uppercase tracking-wider font-light">
                        {trait}
                      </span>
                    ))}
                  </div>
                  {/* hover cta */}
                  <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-accent/70 font-light">
                      Speak with them →
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {/* add new */}
            <Link href="/profile/new"
              className="group flex flex-col items-center justify-center min-h-80 rounded-2xl border border-dashed border-white/8 bg-white/[0.01] hover:bg-white/[0.03] hover:border-accent/20 transition-all duration-500">
              <div className="w-14 h-14 rounded-full bg-accent/5 border border-accent/10 flex items-center justify-center text-accent mb-5 group-hover:scale-110 group-hover:bg-accent/10 transition-all duration-300">
                <Plus className="w-6 h-6" />
              </div>
              <p className="text-white/60 text-sm font-light">Add someone</p>
              <p className="text-muted-foreground text-xs mt-1 font-light">Begin preserving their story</p>
            </Link>
          </div>
        )}
      </main>

      {/* ── footer ── */}
      <footer className="py-16 px-8 text-center border-t border-white/5 mt-20">
        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.4em] font-light">
          Private · Secure · Shared only with family
        </p>
      </footer>
    </div>
  );
}
HOMEEOF
echo "  [OK] src/app/page.tsx rewritten"

# ── Profile detail page ────────────────────────────────────────────────────────
cat > "$PROJECT_ROOT/src/app/profile/[id]/page.tsx" << 'PROFILEEOF'
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
PROFILEEOF
echo "  [OK] src/app/profile/[id]/page.tsx rewritten"

# ── layout.tsx: add new fonts ─────────────────────────────────────────────────
cat > "$PROJECT_ROOT/src/app/layout.tsx" << 'LAYOUTEOF'
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Echoes | Living Memory',
  description: 'Preserve the voices and stories of your loved ones for generations to come.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" rel="stylesheet" />
        {/* Puter.js — free anonymous AI inference */}
        <script src="https://js.puter.com/v2/" async></script>
      </head>
      <body className="antialiased bg-background text-foreground selection:bg-accent/20 selection:text-white">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
LAYOUTEOF
echo "  [OK] layout.tsx updated with new fonts"

echo ""
echo "✅  All changes applied."
echo ""
echo "What changed:"
echo "  • Conversation prompts completely rewritten — natural human responses, no self-introduction"
echo "  • Home page: editorial layout, portrait cards, ambient gradients"
echo "  • Profile page: chat-style transcript, cleaner speak UI, refined story tab"
echo "  • Typography: Cormorant Garamond (serif display) + DM Sans (body)"
echo "  • Grain overlay + ambient glow backgrounds"
echo ""
echo "Restart: npm run dev"
