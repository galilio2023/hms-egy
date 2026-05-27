"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useInView } from "framer-motion";
import { useLocale } from "next-intl";

interface NumberTickerProps {
  value: number;
  className?: string;
  delay?: number;
}

export function NumberTicker({ value, className, delay = 0 }: NumberTickerProps) {
  const locale = useLocale();
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -50px 0px" });

  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 50,
    stiffness: 120,
  });

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        motionValue.set(value);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [motionValue, value, isInView, delay]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        const formatter = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
          useGrouping: true,
          maximumFractionDigits: 0,
        });
        ref.current.textContent = formatter.format(Math.round(latest));
      }
    });
  }, [springValue, locale]);

  return (
    <span
      ref={ref}
      className={className}
    >
      0
    </span>
  );
}
