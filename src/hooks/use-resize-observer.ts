import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Dimensions interface representing width and height.
 */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * useResizeObserver Hook
 *
 * A robust hook to observe element dimensions using ResizeObserver.
 * Features:
 * - Debounced updates to prevent layout thrashing and performance issues.
 * - Backward compatible cleanup (React 18 & 19).
 * - Sub-pixel thrashing prevention using Math.floor.
 * - Equality checks using refs to prevent unnecessary re-renders.
 *
 * @param debounceMs Delay in milliseconds for debouncing dimension updates.
 * @returns { ref, dimensions } A callback ref to attach to the element and the current dimensions.
 */
export function useResizeObserver(debounceMs: number = 100) {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const prevDimensionsRef = useRef<Dimensions>({ width: 0, height: 0 });

  // Centralized cleanup to support React 18 & 19 safely
  const cleanup = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      cleanup();

      if (!node) return;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          // Math.floor prevents sub-pixel layout thrashing on low-end hardware
          const width = Math.floor(entry.contentRect.width);
          const height = Math.floor(entry.contentRect.height);

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = setTimeout(() => {
            // Strict equality check against ref to avoid state-update stale closures
            if (
              prevDimensionsRef.current.width !== width ||
              prevDimensionsRef.current.height !== height
            ) {
              prevDimensionsRef.current = { width, height };
              setDimensions({ width, height });
            }
          }, debounceMs);
        }
      });

      observer.observe(node);
      observerRef.current = observer;
    },
    [debounceMs, cleanup]
  );

  // Guarantee cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { ref, dimensions };
}
