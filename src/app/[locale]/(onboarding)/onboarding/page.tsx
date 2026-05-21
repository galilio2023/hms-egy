import { HospitalOnboardingForm } from "@/components/forms/HospitalOnboardingForm";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("common");
  return {
    title: `Onboarding | ${t("title")}`,
  };
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-blue-900 sm:text-5xl">
            Welcome to HMS Egypt
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Let&apos;s set up your hospital&apos;s digital infrastructure.
          </p>
          <div className="mt-2 h-1 w-32 bg-blue-600 mx-auto rounded-full" />
        </div>

        <HospitalOnboardingForm />
        
        <p className="mt-8 text-center text-gray-500 text-sm">
          Need help? Contact our Egyptian support team at support@hms-egypt.com
        </p>
      </div>
    </div>
  );
}
