
"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface VoiceVisualizerProps {
  isActive: boolean;
  className?: string;
}

export function VoiceVisualizer({ isActive, className }: VoiceVisualizerProps) {
  return (
    <div className={cn("flex items-center gap-1 h-12", className)}>
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 bg-accent rounded-full transition-all duration-300",
            isActive ? "animate-wave" : "h-2 opacity-30"
          )}
          style={{
            height: isActive ? `${Math.random() * 30 + 10}px` : '4px',
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.8 + Math.random()}s`
          }}
        />
      ))}
    </div>
  );
}
