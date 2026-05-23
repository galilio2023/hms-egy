import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Cairo } from "next/font/google";
import { routing } from "@/i18n/routing";
import { WorkstationProvider } from "@/context/WorkstationContext";
import WorkstationLock from "@/components/layout/WorkstationLock";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Toaster } from "sonner";
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
  const messages = await getMessages();

  return (
    <html 
      lang={locale} 
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${cairo.variable} h-full`}
      suppressHydrationWarning
    >
      <body className={`${cairo.className} min-h-full antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <WorkstationProvider>
              {children}
              <WorkstationLock />
              <Toaster 
                position={locale === "ar" ? "top-left" : "top-right"} 
                richColors 
                closeButton
              />
            </WorkstationProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

