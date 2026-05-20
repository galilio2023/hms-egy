import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export default function HomePage() {
  const t = useTranslations("common");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6 text-center">
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <LanguageSwitcher />
      </div>
      
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-blue-900 mb-4">{t("title")}</h1>
        <p className="text-xl text-gray-600">{t("welcome")}</p>
        <p className="mt-2 font-semibold text-blue-700">{t("hospitalName")}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg w-full">
        <Link 
          href="/login" 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
        >
          تسجيل الدخول / Login
        </Link>
        <button className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition">
          معرفة المزيد / Learn More
        </button>
      </div>

      <footer className="mt-16 text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} HMS Egypt. All rights reserved.
      </footer>
    </div>
  );
}
