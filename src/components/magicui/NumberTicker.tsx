"use client";

import { useEffect, useRef, useMemo } from "react";
import { useMotionValue, useSpring, useInView, motion, useTransform } from "framer-motion";
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

  const rounded = useTransform(springValue, (latest) => formatter.format(Math.round(latest)));

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        motionValue.set(value);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [motionValue, value, isInView, delay]);

  return (
    <span className={cn("tabular-nums inline-block", className)}>
      <motion.span
        aria-hidden="true"
      >
        {rounded}
      </motion.span>
      <span className="sr-only" aria-live="polite">
        {value}
      </span>
    </span>
  );
}
