"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/actions/auth";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Lock, Mail, Loader2, Stethoscope, HeartPulse, Globe } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isRtl = locale === "ar";

  const handleToggleLocale = () => {
    const nextLocale = locale === "ar" ? "en" : "ar";
    router.replace(`/${nextLocale}/login`);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await loginAction(null, formData);
      if (result.success) {
        toast.success(isRtl ? "تم تسجيل الدخول بنجاح" : "Logged in successfully", {
          position: isRtl ? "bottom-left" : "bottom-right",
        });
        
        // Redirect to dashboard layout or setup route
        router.push(`/${locale}${result.redirectTo || "/"}`);
        router.refresh();
      } else {
        setError(result.error || "خطأ أثناء تسجيل الدخول");
        toast.error(result.error || "خطأ أثناء تسجيل الدخول");
      }
    });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#090d16] text-slate-100 overflow-hidden px-4 selection:bg-teal-500/30">
      
      {/* ── BREATHTAKING AMBIENT BACKGROUND ────────────────── */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-teal-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-amber-900/5 blur-[100px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Floating Decorative Medical Elements (Premium Micro-animations) */}
      <motion.div 
        animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[15%] text-teal-500/20 hidden md:block"
      >
        <Stethoscope size={44} />
      </motion.div>
      <motion.div 
        animate={{ y: [0, 15, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-[15%] text-emerald-500/20 hidden md:block"
      >
        <HeartPulse size={48} />
      </motion.div>

      {/* ── TOP NAV / LANGUAGE TOGGLE ─────────────────────── */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 rounded-xl border border-teal-500/20 shadow-lg shadow-teal-500/5">
            <Activity className="h-6 w-6 text-teal-400 animate-pulse" />
          </div>
          <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-400 tracking-wide font-cairo">
            {isRtl ? "مستشفيات مصر" : "HMS Egypt"}
          </span>
        </div>

        <button
          onClick={handleToggleLocale}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 hover:bg-teal-900/30 border border-slate-800 hover:border-teal-500/30 text-slate-300 hover:text-teal-400 rounded-xl transition-all duration-300 backdrop-blur-md text-sm shadow-md"
        >
          <Globe size={16} />
          <span className="font-medium font-cairo">{locale === "ar" ? "English" : "عربي"}</span>
        </button>
      </div>

      {/* ── LUXURY AUTHENTICATION CONTAINER ────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        {/* Core Glassmorphic Card */}
        <div className="bg-slate-950/40 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
          
          {/* Card Top Ambient Light */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight font-cairo mb-2">
              {t("auth.login")}
            </h1>
            <p className="text-slate-400 font-cairo text-sm">
              {isRtl ? "نظام إدارة المستشفى الذكي والموثق" : "Intelligent Clinical Management Platform"}
            </p>
          </div>

          {/* Error Message Alert Card */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl font-cairo text-center leading-relaxed"
            >
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 font-cairo uppercase tracking-wider">
                {t("auth.email")}
              </label>
              <div className="relative">
                <span className={`absolute inset-y-0 ${isRtl ? "right-4" : "left-4"} flex items-center text-slate-500`}>
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@hospital.com.eg"
                  className={`w-full py-3.5 ${isRtl ? "pr-11 pl-4" : "pl-11 pr-4"} bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800/80 focus:border-teal-500 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans text-sm`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-400 font-cairo uppercase tracking-wider">
                  {t("auth.password")}
                </label>
              </div>
              <div className="relative">
                <span className={`absolute inset-y-0 ${isRtl ? "right-4" : "left-4"} flex items-center text-slate-500`}>
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className={`w-full py-3.5 ${isRtl ? "pr-11 pl-4" : "pl-11 pr-4"} bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800/80 focus:border-teal-500 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans text-sm`}
                />
              </div>
            </div>

            {/* Remember & Lock workstation note */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-cairo">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="rounded bg-slate-900 border-slate-800 text-teal-600 focus:ring-0 cursor-pointer h-4 w-4"
                />
                <label htmlFor="remember" className="cursor-pointer">
                  {isRtl ? "تذكرني في هذه المحطة" : "Remember on this station"}
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="relative w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-2xl shadow-xl shadow-teal-500/10 hover:shadow-teal-500/20 transition-all duration-300 transform active:scale-[0.98] focus:outline-none disabled:opacity-50 disabled:pointer-events-none text-sm font-cairo flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>{isRtl ? "جاري التحقق..." : "Authenticating..."}</span>
                </>
              ) : (
                <span>{t("auth.login")}</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer info links */}
        <p className="text-center mt-6 text-slate-500 text-xs font-cairo leading-relaxed">
          {isRtl ? (
            <>
              يتوافق هذا النظام بالكامل مع معايير وزارة الصحة المصرية (MOH)<br />
              وهيئة الضرائب المصرية (ETA). جميع المعاملات مشفرة ومؤمنة بالكامل.
            </>
          ) : (
            <>
              Fully compliant with Egyptian Ministry of Health (MOH) & ETA standards.<br />
              All patient information and transactions are encrypted and audited.
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
