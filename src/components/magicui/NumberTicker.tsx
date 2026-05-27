"use client";

import { useEffect, useRef, useMemo } from "react";
import { useMotionValue, useSpring, useInView } from "framer-motion";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  className?: string;
  delay?: number;
}

export function NumberTicker({ 
  value, 
  className, 
  delay = 0,
  useEasternArabic = false 
}: NumberTickerProps & { useEasternArabic?: boolean }) {
  const locale = useLocale();
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -50px 0px" });

  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 50,
    stiffness: 120,
  });

  const formatter = useMemo(() => {
    const numeralSystem = useEasternArabic ? "arab" : "latn";
    return new Intl.NumberFormat(`${locale === "ar" ? "ar-EG" : "en-US"}-u-nu-${numeralSystem}`, {
      useGrouping: true,
      maximumFractionDigits: 0,
    });
  }, [locale, useEasternArabic]);

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
        ref.current.textContent = formatter.format(Math.round(latest));
      }
    });
  }, [springValue, formatter]);

  return (
    <span className={cn("tabular-nums inline-block", className)}>
      <span
        ref={ref}
        aria-hidden="true"
      >
        0
      </span>
      <span className="sr-only" aria-live="polite">
        {value}
      </span>
    </span>
  );
}
