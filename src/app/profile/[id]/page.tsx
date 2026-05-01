
"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MOCK_LOVED_ONES } from '@/lib/mock-data';
import { Button } from "@/components/ui/button";
import { Mic, Image as ImageIcon, FileText, Video, ArrowLeft, History, Heart } from "lucide-react";
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfileDetail() {
  const { id } = useParams();
  const person = MOCK_LOVED_ONES.find(p => p.id === id);

  if (!person) return <div>Profile not found</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="font-bold">{person.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" size="sm" className="border-white/10">
            <History className="w-4 h-4 mr-2" /> Logs
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" size="sm" asChild>
            <Link href={`/profile/${person.id}/chat`}>
              <Mic className="w-4 h-4 mr-2" /> Speak with {person.name.split(' ')[0]}
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-3 gap-12">
            {/* Sidebar info */}
            <div className="space-y-8">
              <div className="relative aspect-square rounded-3xl overflow-hidden border-2 border-primary shadow-2xl">
                <Image 
                  src={person.avatarUrl} 
                  alt={person.name} 
                  fill 
                  className="object-cover"
                  data-ai-hint="portrait elderly"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-accent uppercase tracking-widest">{person.relation}</span>
                  <h1 className="text-3xl font-bold">{person.name}</h1>
                  <p className="text-muted-foreground">{person.birthYear} — {person.passingYear}</p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground bg-white/5 p-4 rounded-xl border border-white/5 italic">
                  "{person.summary}"
                </p>
                <div className="flex flex-wrap gap-2">
                  {person.traits.map(trait => (
                    <span key={trait} className="px-3 py-1 rounded-full bg-primary text-xs font-medium">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-accent/5 border border-accent/20 space-y-4">
                <div className="flex items-center gap-2 text-accent">
                  <Heart className="w-5 h-5" />
                  <h4 className="font-bold">Echo Readiness</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Persona Fidelity</span>
                    <span className="text-accent font-bold">94%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[94%]" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  The AI model has processed 42 memories and 18 minutes of voice data to reconstruct this persona.
                </p>
              </div>
            </div>

            {/* Memory Bank */}
            <div className="md:col-span-2 space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Memory Bank</h2>
                <Button variant="ghost" className="text-accent text-sm hover:text-accent hover:bg-accent/10">Add Memory</Button>
              </div>

              <Tabs defaultValue="photos" className="w-full">
                <TabsList className="bg-white/5 w-full justify-start p-1 h-auto border border-white/5 mb-6">
                  <TabsTrigger value="photos" className="data-[state=active]:bg-primary"><ImageIcon className="w-4 h-4 mr-2" /> Photos</TabsTrigger>
                  <TabsTrigger value="videos" className="data-[state=active]:bg-primary"><Video className="w-4 h-4 mr-2" /> Videos</TabsTrigger>
                  <TabsTrigger value="documents" className="data-[state=active]:bg-primary"><FileText className="w-4 h-4 mr-2" /> Letters</TabsTrigger>
                </TabsList>
                
                <TabsContent value="photos" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="aspect-square relative rounded-xl overflow-hidden group border border-white/5 cursor-pointer">
                      <Image 
                        src={`https://picsum.photos/seed/mem-${i}/400/400`} 
                        alt="Memory" 
                        fill 
                        className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                        data-ai-hint="old photo"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <span className="text-[10px] text-white/80 font-medium">Summer 1974</span>
                      </div>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="videos" className="p-12 text-center border-2 border-dashed border-white/5 rounded-2xl text-muted-foreground">
                  No video recordings uploaded yet.
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/20 rounded flex items-center justify-center text-accent">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Handwritten Letter to Emily</p>
                          <p className="text-[10px] text-muted-foreground">Uploaded March 12, 2024 • 1.2MB</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
