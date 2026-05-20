"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useParams } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const toggleLanguage = () => {
    const nextLocale = locale === "ar" ? "en" : "ar";
    router.replace(
      // @ts-expect-error -- next-intl types for params can be tricky
      { pathname, params },
      { locale: nextLocale }
    );
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1 text-sm font-medium border rounded-md hover:bg-gray-50 transition"
    >
      <span>{locale === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}
