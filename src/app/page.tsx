"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Settings, User, Mic, Heart } from "lucide-react";
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
    return () => {
      window.removeEventListener('storage', h);
      window.removeEventListener('profile-updated', h);
      window.removeEventListener('focus', h);
      clearInterval(t);
    };
  }, [loadProfiles]);

  return (
    <div className="min-h-screen bg-background">

      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-15%] left-[-5%] w-[55vw] h-[55vw] rounded-full"
          style={{ background: 'radial-gradient(circle, hsla(175,60%,55%,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[45vw] h-[45vw] rounded-full"
          style={{ background: 'radial-gradient(circle, hsla(270,40%,40%,0.07) 0%, transparent 70%)' }} />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-background/70 h-16 px-6 flex items-center justify-between">
        <Link href="/" className="flex flex-col leading-none">
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: '1.4rem' }}
            className="text-white/90 tracking-wide">Echoes</span>
          <span className="text-[9px] uppercase tracking-[0.45em] text-accent/50 font-light">Living Memory</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => loadProfiles(true)}
            className="text-muted-foreground hover:text-accent gap-1.5 text-xs font-light h-8">
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </Button>
          <div className="w-px h-4 bg-white/10" />
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent w-8 h-8">
            <Settings className="w-4 h-4" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">

        <div className="mb-16">
          <p className="text-[10px] uppercase tracking-[0.4em] text-accent/60 mb-4 font-light">Family Vault</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', lineHeight: 1.08 }}
            className="text-white/90 mb-5">
            Some people<br /><em>never truly leave.</em>
          </h1>
          <p className="text-muted-foreground text-sm font-light leading-relaxed max-w-xs">
            Preserve the voice, wisdom, and warmth of those who shaped you — forever.
          </p>
        </div>

        {isLoading && profiles.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-72 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {profiles.map((person, idx) => (
              <Link
                key={person.id}
                href={`/profile/${person.id}`}
                style={{ animationDelay: `${idx * 60}ms` }}
                className="group block rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-accent/20 transition-all duration-400 hover:-translate-y-0.5 overflow-hidden"
              >
                <div style={{ height: '13rem', overflow: 'hidden', position: 'relative', background: 'rgba(255,255,255,0.05)' }}>
                  <img
                    src={person.avatarUrl}
                    alt={person.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'grayscale(1)', transition: 'filter 0.7s, transform 0.7s', transform: 'scale(1.05)' }}
                    onMouseEnter={e => { (e.target as HTMLImageElement).style.filter = 'grayscale(0)'; (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { (e.target as HTMLImageElement).style.filter = 'grayscale(1)'; (e.target as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, hsl(220 15% 6%) 0%, transparent 60%)' }} />
                  <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem' }}>
                    <span className="text-[9px] uppercase tracking-[0.3em] text-accent/80 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-accent/10 font-light">
                      {person.relation}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2.5">
                  <div>
                    <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: '1.35rem' }}
                      className="text-white/90 leading-tight">{person.name}</h3>
                    <p className="text-[11px] text-muted-foreground font-light mt-0.5 tracking-widest">
                      {person.birthYear} — {person.passingYear}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(person.traits || []).slice(0, 3).map(trait => (
                      <span key={trait}
                        className="text-[9px] px-2 py-0.5 rounded-full border border-white/10 text-white/30 uppercase tracking-wider font-light">
                        {trait}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Mic className="w-3 h-3 text-accent/60" />
                    <span className="text-[10px] uppercase tracking-[0.25em] text-accent/60 font-light">Speak with them</span>
                  </div>
                </div>
              </Link>
            ))}

            <Link
              href="/profile/new"
              className="group flex flex-col items-center justify-center min-h-72 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.04] hover:border-accent/25 transition-all duration-400"
            >
              <div className="w-12 h-12 rounded-full bg-accent/8 border border-accent/15 flex items-center justify-center text-accent mb-4 group-hover:scale-110 group-hover:bg-accent/15 transition-all duration-300">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-white/50 text-sm font-light">Add someone</p>
              <p className="text-muted-foreground/60 text-xs mt-1 font-light">Begin preserving their story</p>
            </Link>

          </div>
        )}

        {!isLoading && profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/8 border border-accent/15 flex items-center justify-center text-accent mb-6">
              <Heart className="w-7 h-7" />
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: '2rem' }}
              className="text-white/80 mb-3">No echoes yet</h2>
            <p className="text-muted-foreground text-sm font-light mb-8 max-w-xs leading-relaxed">
              Create the first profile to begin preserving someone's voice and memories.
            </p>
            <Link href="/profile/new">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 h-11 text-sm font-light gap-2">
                <Plus className="w-4 h-4" /> Create first Echo
              </Button>
            </Link>
          </div>
        )}
      </main>

      <footer className="py-12 px-6 text-center border-t border-white/5 mt-16">
        <p className="text-[10px] text-muted-foreground/30 uppercase tracking-[0.4em] font-light">
          Private · Secure · Shared only with family
        </p>
      </footer>
    </div>
  );
}
