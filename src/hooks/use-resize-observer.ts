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
 * - Precision state: Stores raw dimensions to prevent canvas blurriness.
 * - Thrashing prevention: Only triggers updates when integer dimensions change.
 * - Stable callback ref to prevent redundant observer re-bindings.
 *
 * @param debounceMs Delay in milliseconds for debouncing dimension updates.
 * @returns { ref, dimensions } A callback ref to attach to the element and the current dimensions.
 */
export function useResizeObserver(debounceMs: number = 50) {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const prevDimensionsRef = useRef<Dimensions>({ width: 0, height: 0 });

  // Store debounceMs in a ref to keep the callback ref stable and prevent redundant re-bindings
  const debounceMsRef = useRef(debounceMs);
  useEffect(() => {
    debounceMsRef.current = debounceMs;
  }, [debounceMs]);

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
          // Use Math.floor only for the comparison to prevent layout thrashing
          const roundedWidth = Math.floor(entry.contentRect.width);
          const roundedHeight = Math.floor(entry.contentRect.height);

          // Store raw dimensions to ensure sub-pixel precision for heavy canvases (preventing blur)
          const rawWidth = entry.contentRect.width;
          const rawHeight = entry.contentRect.height;

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = setTimeout(() => {
            // Only update state if the rounded integer dimensions have actually changed
            if (
              prevDimensionsRef.current.width !== roundedWidth ||
              prevDimensionsRef.current.height !== roundedHeight
            ) {
              prevDimensionsRef.current = { width: roundedWidth, height: roundedHeight };
              setDimensions({ width: rawWidth, height: rawHeight });
            }
          }, debounceMsRef.current);
        }
      });

      observer.observe(node);
      observerRef.current = observer;
    },
    [cleanup] // debounceMs removed from dependencies to ensure stability
  );

  // Guarantee cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { ref, dimensions };
}
