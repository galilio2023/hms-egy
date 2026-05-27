"use client";

import { useEffect } from "react";

/**
 * Client-only service worker loader.
 * Automatically registers the PWA service worker upon page mount.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("HMS Egypt PWA ServiceWorker registered successfully:", registration.scope);
          })
          .catch((error) => {
            console.error("HMS Egypt PWA ServiceWorker registration failed:", error);
          });
      };

      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register);
        return () => window.removeEventListener("load", register);
      }
    }
  }, []);

  return null;
}
