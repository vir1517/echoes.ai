
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Mic, Heart, Users, ShieldCheck } from "lucide-react";
import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 lg:px-12 h-20 flex items-center justify-between border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center border border-accent/20">
            <span className="text-accent font-bold text-xl">E</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">Echoes</span>
        </Link>
        <nav className="hidden md:flex gap-8">
          <Link href="#features" className="text-sm font-medium hover:text-accent transition-colors">How it works</Link>
          <Link href="/dashboard" className="text-sm font-medium hover:text-accent transition-colors">Profiles</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-sm">Sign In</Button>
          <Button className="bg-primary hover:bg-primary/80 text-white">Get Started</Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -z-10" />
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
              Conversations that <span className="text-accent">Live Forever</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Echoes helps you create interactive, voice-driven memory profiles of loved ones. Preserve their voice, their stories, and their spirit for generations to come.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="h-14 px-8 text-lg bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                <Link href="/dashboard">Enter the Archive</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 hover:bg-white/5">
                Watch the Story
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 bg-black/20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4 text-center p-6 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-12 h-12 bg-primary/40 rounded-xl flex items-center justify-center mx-auto text-accent">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Family Archive</h3>
                <p className="text-muted-foreground">Upload photos, letters, diaries, and videos to build a rich historical profile.</p>
              </div>
              <div className="space-y-4 text-center p-6 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-12 h-12 bg-primary/40 rounded-xl flex items-center justify-center mx-auto text-accent">
                  <Heart className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Soul Processing</h3>
                <p className="text-muted-foreground">Our AI understands their humor, beliefs, and unique personality from your media.</p>
              </div>
              <div className="space-y-4 text-center p-6 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-12 h-12 bg-primary/40 rounded-xl flex items-center justify-center mx-auto text-accent">
                  <Mic className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Voice Synthesis</h3>
                <p className="text-muted-foreground">Hear them speak again with a reconstructed voice that captures every nuance.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground">
        <p>© 2024 Echoes Memory Platforms. Dedicated to the stories that make us who we are.</p>
      </footer>
    </div>
  );
}
