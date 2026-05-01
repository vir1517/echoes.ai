
"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface EchoOrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  className?: string;
}

export function EchoOrb({ state, className }: EchoOrbProps) {
  return (
    <div className={cn(
      "orb-container", 
      state === 'speaking' && "orb-active",
      state === 'thinking' && "orb-thinking",
      state === 'listening' && "orb-listening",
      className
    )}>
      <div className="orb-glow transition-all duration-1000" />
      <div className="orb-core transition-all duration-1000" />
      
      {state === 'listening' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 rounded-full border-2 border-accent/20 animate-ping [animation-duration:3s]" />
          <div className="w-64 h-64 rounded-full border border-accent/10 animate-ping [animation-duration:2s]" />
        </div>
      )}
      
      {state === 'thinking' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full rounded-full border-4 border-dashed border-accent/20 animate-spin [animation-duration:10s]" />
        </div>
      )}

      {state === 'speaking' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-80 h-80 rounded-full bg-accent/5 blur-3xl animate-pulse" />
        </div>
      )}
    </div>
  );
}
