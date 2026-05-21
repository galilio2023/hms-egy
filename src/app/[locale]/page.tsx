import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { auth } from "@/lib/auth";

import { redirect } from "next/navigation";

export default async function HomePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const session = await auth();

  // Redirect authenticated users to their respective dashboards
  if (session?.user) {
    if (session.activeHospitalId || (session.user.hospitalId && session.user.hospitalId !== "system-wide")) {
      const slug = session.activeHospitalId || session.user.hospitalId;
      redirect(`/${locale}/${slug}/appointments`);
    } else if (session.user.role === "SUPER_ADMIN") {
      redirect(`/${locale}/super-admin`);
    }
  }

  // Fallback translation hook for Server Components
  // (In RSCs, next-intl uses next-intl/server normally, but we can pass it if we configure it)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6 text-center">
      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>
      
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-blue-900 mb-4">HMS Egypt</h1>
        <p className="text-xl text-gray-600">Enterprise Hospital Management</p>
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
