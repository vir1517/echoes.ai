import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus, Heart } from "lucide-react";
import Image from 'next/image';
import { MOCK_LOVED_ONES } from '@/lib/mock-data';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="px-8 h-24 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tighter text-white">Echoes</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">Their voice. Forever.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-white">Our Story</Button>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-white/5" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12">
        <div className="space-y-12">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold text-white mb-4">Family Vault</h2>
            <p className="text-muted-foreground text-lg italic">"Some people never truly leave."</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {MOCK_LOVED_ONES.map((person) => (
              <Link 
                key={person.id} 
                href={`/profile/${person.id}`}
                className="group relative bg-card/40 border border-white/5 rounded-[2rem] p-8 transition-all hover:bg-card/60 hover:border-accent/20 hover:scale-[1.02] duration-500"
              >
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-primary group-hover:border-accent transition-colors duration-500 shadow-2xl">
                    <Image 
                      src={person.avatarUrl} 
                      alt={person.name} 
                      fill 
                      className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
                      data-ai-hint="portrait elderly"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{person.relation}</span>
                    <h3 className="text-2xl font-bold text-white">{person.name}</h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      {person.birthYear} — {person.passingYear}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {person.traits.slice(0, 2).map(trait => (
                      <span key={trait} className="text-[9px] px-3 py-1 rounded-full bg-primary/20 text-white/50 border border-white/5 uppercase tracking-tighter">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}

            <Link 
              href="/profile/new"
              className="flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-accent/20 transition-all group min-h-[400px]"
            >
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-accent mb-6 group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Add Someone</h3>
              <p className="text-sm text-muted-foreground mt-2 text-center max-w-[200px]">Begin preserving their story and spirit.</p>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-12 px-8 flex flex-col items-center gap-4 text-center">
        <Heart className="w-5 h-5 text-accent/40" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest max-w-xs leading-loose">
          Echoes is a space of remembrance. Every profile is private, secure, and shared only with family.
        </p>
      </footer>
    </div>
  );
}
