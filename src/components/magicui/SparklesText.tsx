"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SparklesTextProps {
  text: string;
  className?: string;
}

export function SparklesText({ text, className }: SparklesTextProps) {
  return (
    <span className={cn("relative inline-block overflow-hidden", className)}>
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-12 pointer-events-none"
        animate={{
          left: ["-100%", "200%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 2,
        }}
        style={{
          width: "50%",
        }}
      />
      <span className="relative z-10">{text}</span>
    </span>
  );
}
