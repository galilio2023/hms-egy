import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Cairo } from "next/font/google";
import { routing } from "@/i18n/routing";
import { WorkstationProvider } from "@/context/WorkstationContext";
import WorkstationLock from "@/components/layout/WorkstationLock";
import "../globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cairo",
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html 
      lang={locale} 
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${cairo.variable} h-full`}
    >
      <body className={`${cairo.className} min-h-full antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <WorkstationProvider>
            {children}
            <WorkstationLock />
          </WorkstationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
