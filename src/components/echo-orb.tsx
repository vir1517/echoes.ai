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
      <div className="orb-glow" />
      <div className="orb-core" />
      
      {state === 'listening' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full border border-accent/30 animate-ping" />
        </div>
      )}
      
      {state === 'thinking' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
