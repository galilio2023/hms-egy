import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names safely, combining clsx and tailwind-merge for Tailwind CSS v4.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Barrel exports for all utility modules in src/lib/utils
export * from "./egypt";
export * from "./formatting";
export * from "./constants";
export * from "./clinical-codes";
export * from "./clinical-search-engine";
export * from "./errors";
export * from "./hospital";
export * from "./plans";
export * from "./ratelimit";
export * from "./security";
