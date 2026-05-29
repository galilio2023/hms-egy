"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Custom hook to track user inactivity and trigger a callback.
 *
 * @param onIdle Callback to trigger when the idle timeout is reached.
 * @param timeout Duration of inactivity in milliseconds (default: 15 minutes).
 * @param enabled Whether the idle tracking is active.
 */
export function useIdleTimeout(
  onIdle: () => void,
  timeout: number = 15 * 60 * 1000,
  enabled: boolean = true
) {
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);

  // Keep callback reference up to date without re-triggering effects
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }

    if (enabled) {
      timeoutId.current = setTimeout(() => {
        onIdleRef.current();
      }, timeout);
    }
  }, [enabled, timeout]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current = null;
      }
      return;
    }

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Initial timer set
    resetTimer();

    // Attach listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);

  return { resetTimer };
}
