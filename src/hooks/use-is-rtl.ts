import { useLocale } from "next-intl";

/**
 * Hook to determine if the current locale is Right-to-Left (RTL).
 */
export function useIsRtl() {
  const locale = useLocale();
  return locale === "ar";
}
