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
 * - React 19 compatible callback ref with cleanup function.
 * - Equality checks to prevent unnecessary re-renders.
 * - Unmount guards to prevent state updates on unmounted components.
 *
 * @param debounceMs Delay in milliseconds for debouncing dimension updates.
 * @returns { ref, dimensions } A callback ref to attach to the element and the current dimensions.
 */
export function useResizeObserver(debounceMs: number = 100) {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Track mount status to prevent updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (!node) {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;

          // Immediate debounce reset to prevent multiple pending updates
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = setTimeout(() => {
            // Strict unmount guard
            if (!isMountedRef.current) return;

            setDimensions((prev) => {
              // Clinical-grade equality check: prevent repaints if dimensions haven't actually changed
              if (prev.width === width && prev.height === height) {
                return prev;
              }
              return { width, height };
            });
          }, debounceMs);
        }
      });

      observer.observe(node);

      // React 19: Return a cleanup function directly from the callback ref
      return () => {
        observer.disconnect();
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    },
    [debounceMs]
  );

  return { ref, dimensions };
}
