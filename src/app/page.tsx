
"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Heart, Sparkles, User, Settings, Plus } from "lucide-react";
import Image from 'next/image';
import { LovedOne } from '@/lib/mock-data';
import { useEffect, useState, useCallback } from 'react';
import { getProfilesFromPuter } from '@/lib/puter';

export default function Home() {
  const [profiles, setProfiles] = useState<LovedOne[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfiles = useCallback(async () => {
    try {
      const userProfiles = await getProfilesFromPuter();
      setProfiles(userProfiles);
    } catch (error) {
      console.error("Failed to load family vault:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();

    // Listen for storage events (cross-tab sync) and custom sync events (same-tab)
    const handleSync = () => {
      loadProfiles();
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('profile-updated', handleSync);
    
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('profile-updated', handleSync);
    };
  }, [loadProfiles]);

  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-accent selection:text-accent-foreground">
      <header className="px-8 h-24 flex items-center justify-between glass sticky top-0 z-50">
        <Link href="/" className="flex flex-col group">
          <h1 className="text-3xl font-bold tracking-tighter text-white transition-colors group-hover:text-accent">Echoes</h1>
          <p className="text-[9px] uppercase tracking-[0.4em] text-accent/80 font-bold">Their voice. Forever.</p>
        </Link>
        <div className="flex items-center gap-6">
          <Button variant="ghost" className="text-muted-foreground hover:text-white hidden md:flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Our Ethos
          </Button>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-accent">
            <Settings className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary/20 border border-white/5 flex items-center justify-center text-accent">
            <User className="w-5 h-5" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-16 space-y-16">
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h2 className="text-5xl font-bold text-white tracking-tight">Family Vault</h2>
          <p className="text-muted-foreground text-xl italic font-medium opacity-60">"Some people never truly leave."</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[450px] rounded-[3rem] bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {profiles.map((person) => (
              <Link 
                key={person.id} 
                href={`/profile/${person.id}`}
                className="group relative bg-card/20 border border-white/5 rounded-[3rem] p-10 transition-all hover:bg-card/40 hover:border-accent/30 hover:scale-[1.03] duration-700 shadow-2xl overflow-hidden"
              >
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/5 rounded-full blur-[60px] group-hover:bg-accent/10 transition-colors duration-700" />
                
                <div className="flex flex-col items-center text-center space-y-8 relative z-10">
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-primary group-hover:border-accent transition-all duration-1000 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <Image 
                      src={person.avatarUrl} 
                      alt={person.name} 
                      fill 
                      className="object-cover grayscale group-hover:grayscale-0 transition-all duration-[2000ms] scale-110 group-hover:scale-100"
                      data-ai-hint="portrait elderly"
                    />
                  </div>
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">{person.relation}</span>
                    <h3 className="text-3xl font-bold text-white tracking-tight">{person.name}</h3>
                    <p className="text-sm text-muted-foreground font-semibold tracking-widest uppercase">
                      {person.birthYear} — {person.passingYear}
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    {(person.traits || []).slice(0, 2).map(trait => (
                      <span key={trait} className="text-[9px] px-4 py-1.5 rounded-full bg-white/5 text-white/40 border border-white/10 uppercase font-bold tracking-tighter">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}

            <Link 
              href="/profile/new"
              className="flex flex-col items-center justify-center p-12 rounded-[3rem] border-2 border-dashed border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-accent/20 transition-all group min-h-[450px] relative overflow-hidden"
            >
              <div className="w-20 h-20 rounded-full bg-accent/5 flex items-center justify-center text-accent mb-8 group-hover:scale-110 group-hover:bg-accent/10 transition-all duration-500">
                <Plus className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-white">Add Someone</h3>
              <p className="text-muted-foreground mt-3 text-center max-w-[200px] text-sm italic font-medium">
                Begin preserving their story and spirit for eternity.
              </p>
            </Link>
          </div>
        )}
      </main>

      <footer className="py-20 px-8 flex flex-col items-center gap-6 text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
          <Heart className="w-5 h-5 text-accent/40" />
        </div>
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.3em] max-w-sm mx-auto leading-relaxed font-bold">
            Echoes is a sacred space of remembrance.
          </p>
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.2em]">
            Private • Secure • Shared only with family
          </p>
        </div>
      </footer>
    </div>
  );
}
