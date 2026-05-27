"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className,
  size = 180,
  duration = 8,
  borderWidth = 1.5,
  colorFrom = "#0ea5e9", // Sky-500 (Teal-like Accent)
  colorTo = "#10b981",   // Emerald-500
}: BorderBeamProps) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden", className)}>
      <style jsx>{`
        @keyframes border-beam {
          0%, 100% { transform: translate(-50%, -50%) translate(0%, 0%); }
          25% { transform: translate(-50%, -50%) translate(100%, 0%); }
          50% { transform: translate(-50%, -50%) translate(100%, 100%); }
          75% { transform: translate(-50%, -50%) translate(0%, 100%); }
        }
      `}</style>
      {/* Light glow sliding along the border edges */}
      <div
        className="absolute rounded-full opacity-35 blur-[12px]"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${colorFrom} 0%, ${colorTo} 40%, transparent 100%)`,
          top: 0,
          left: 0,
          animation: `border-beam ${duration}s linear infinite`,
        }}
      />
      {/* Inner thin border contour */}
      <div 
        className="absolute inset-0 rounded-[inherit]"
        style={{
          border: `${borderWidth}px solid var(--color-border)`,
          opacity: 0.25,
        }}
      />
    </div>
  );
}
