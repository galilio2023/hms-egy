"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth/client";
import { unlockWorkstationAction } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { initializeSyncEngineKey, purgeSyncEngineKey } from "@/lib/offline/sync-engine";

interface WorkstationContextType {
  isLocked: boolean;
  lockStation: () => void;
  unlockStation: (password: string) => Promise<boolean>;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export function WorkstationProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const { data: sessionData } = useSession();
  const locale = useLocale();
  const isRtl = locale === "ar";

  const isAuthenticated = !!sessionData?.user;

  const lockStation = useCallback(() => {
    setIsLocked(true);
    localStorage.setItem("workstation_locked", "true");
    purgeSyncEngineKey(); // Securely purge keys on lock
    toast.warning(
      isRtl ? "تم قفل محطة العمل نظراً لعدم النشاط" : "Workstation locked due to inactivity",
      { id: "workstation-lock-toast" }
    );
  }, [isRtl]);

  const { resetTimer } = useIdleTimeout(
    lockStation,
    AUTO_LOCK_TIMEOUT,
    isAuthenticated && !isLocked
  );

  // Check persistent lock state and initialize sync engine on mount/auth change
  useEffect(() => {
    const persistedLock = localStorage.getItem("workstation_locked") === "true";

    if (isAuthenticated) {
      if (persistedLock) {
        setIsLocked(true);
        purgeSyncEngineKey(); // Ensure keys are purged if we start in locked state
      } else if (!isLocked) {
        // Initialize sync engine if authenticated and not locked
        // We use session id as the secret for LSN encryption
        if (sessionData.session?.id) {
          initializeSyncEngineKey(sessionData.session.id);
        }
      }
    } else {
      setIsLocked(false);
      localStorage.removeItem("workstation_locked");
      purgeSyncEngineKey();
    }
  }, [isAuthenticated, sessionData?.session?.id]);

  const unlockStation = async (password: string): Promise<boolean> => {
    const result = await unlockWorkstationAction(password);
    if (result.success) {
      setIsLocked(false);
      localStorage.removeItem("workstation_locked");

      // Re-initialize sync engine after successful unlock
      if (sessionData?.session?.id) {
        initializeSyncEngineKey(sessionData.session.id);
      }

      resetTimer();
      toast.success(isRtl ? "تم إلغاء قفل الجلسة" : "Workstation unlocked successfully");
      return true;
    } else {
      toast.error(result.error || (isRtl ? "كلمة المرور غير صحيحة" : "Incorrect password"));
      return false;
    }
  };

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
