"use client";

import { createContext, useContext, useState, useEffect, useRef, useTransition, useCallback } from "react";
import { unlockWorkstationAction } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useLocale } from "next-intl";

interface WorkstationContextType {
  isLocked: boolean;
  lockStation: () => void;
  unlockStation: (password: string) => Promise<boolean>;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

export function WorkstationProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(0);
  const locale = useLocale();
  const isRtl = locale === "ar";

  // Check persistent lock state on mount
  useEffect(() => {
    const persistedLock = localStorage.getItem("workstation_locked") === "true";
    if (persistedLock) {
      setIsLocked(true);
    }
  }, []);

  const lockStation = useCallback(() => {
    setIsLocked(true);
    localStorage.setItem("workstation_locked", "true");
    toast.warning(
      isRtl ? "تم قفل محطة العمل نظراً لعدم النشاط" : "Workstation locked due to inactivity",
      { id: "workstation-lock-toast" }
    );
  }, [isRtl]);

  const resetTimer = useCallback(() => {
    if (isLocked) return; // Don't reset if already locked

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      lockStation();
    }, AUTO_LOCK_TIMEOUT);
  }, [isLocked, lockStation]);

  const unlockStation = async (password: string): Promise<boolean> => {
    const result = await unlockWorkstationAction(password);
    if (result.success) {
      setIsLocked(false);
      localStorage.removeItem("workstation_locked");
      resetTimer();
      toast.success(isRtl ? "تم إلغاء قفل الجلسة" : "Workstation unlocked successfully");
      return true;
    } else {
      toast.error(result.error || (isRtl ? "كلمة المرور غير صحيحة" : "Incorrect password"));
      return false;
    }
  };

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > 5000) { // Throttle execution to once every 5 seconds to prevent UI thread saturation
      lastActivityRef.current = now;
      resetTimer();
    }
  }, [resetTimer]);

  // Monitor user activity to reset inactivity lock timer
  useEffect(() => {
    if (isLocked) return;

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    // Initialize timer on load
    resetTimer();

    // Bind event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isLocked, resetTimer, handleActivity]);

  return (
    <WorkstationContext.Provider value={{ isLocked, lockStation, unlockStation }}>
      {children}
    </WorkstationContext.Provider>
  );
}

export function useWorkstation() {
  const context = useContext(WorkstationContext);
  if (!context) {
    throw new Error("useWorkstation must be used within a WorkstationProvider");
  }
  return context;
}
