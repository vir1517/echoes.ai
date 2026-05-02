"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus, Settings, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { getProfiles } from '@/lib/storage';
import type { LovedOne } from '@/lib/mock-data';

export default function Dashboard() {
  const [profiles, setProfiles] = useState<LovedOne[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      setProfiles(await getProfiles());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    const handleSync = () => loadProfiles(false);
    window.addEventListener('storage', handleSync);
    window.addEventListener('profile-updated', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('profile-updated', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [loadProfiles]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl tracking-tighter text-accent">Echoes</Link>
          <div className="h-4 w-px bg-white/10" />
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-widest">Family Vault</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent"><Settings className="w-5 h-5" /></Button>
          <div className="w-8 h-8 rounded-full bg-primary border border-accent/20" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Family Archive</h1>
            <p className="text-muted-foreground">Manage and visit the living profiles of your family.</p>
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link href="/profile/new"><Plus className="w-4 h-4 mr-2" /> Create New Profile</Link>
          </Button>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
          <Input placeholder="Search family profiles..." className="pl-10 h-12 bg-white/5 border-white/10 focus:border-accent/50 focus:ring-accent/20" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {isLoading && profiles.length === 0 ? (
            [1,2,3,4].map(i => <div key={i} className="h-40 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />)
          ) : profiles.length === 0 ? (
            <div className="md:col-span-2 border border-dashed border-white/10 rounded-2xl p-10 text-center bg-white/[0.02]">
              <p className="text-muted-foreground">No family profiles yet.</p>
              <Button className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                <Link href="/profile/new"><Plus className="w-4 h-4 mr-2" /> Create New Profile</Link>
              </Button>
            </div>
          ) : profiles.map(person => (
            <Link key={person.id} href={`/profile/${person.id}`} className="group relative bg-white/5 border border-white/5 rounded-2xl p-6 overflow-hidden transition-all hover:bg-white/10 hover:border-accent/30">
              <div className="flex gap-6 items-start">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary group-hover:border-accent transition-colors">
                  <Image src={person.avatarUrl} alt={person.name} fill className="object-cover" data-ai-hint="portrait elderly" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent uppercase tracking-widest">{person.relation}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-all group-hover:translate-x-1" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{person.name}</h3>
                  <p className="text-sm text-muted-foreground">{person.birthYear} — {person.passingYear}</p>
                  <div className="flex gap-2 pt-2">{(person.traits||[]).map(trait => <span key={trait} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/40 text-white/70 border border-white/5 uppercase tracking-tighter">{trait}</span>)}</div>
                </div>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity"><div className="w-2 h-2 rounded-full bg-accent animate-pulse" /></div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
