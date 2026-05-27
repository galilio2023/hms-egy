"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/actions/auth";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Activity, 
  Lock, 
  Mail, 
  Loader2, 
  Stethoscope, 
  HeartPulse, 
  Globe, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  TrendingUp, 
  Users, 
  Building2 
} from "lucide-react";
import { toast } from "sonner";
import { BorderBeam } from "@/components/magicui/BorderBeam";
import { NumberTicker } from "@/components/magicui/NumberTicker";
import { cn } from "@/lib/utils";

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
        toast.success(t("auth.loginSuccess"), {
          position: isRtl ? "bottom-left" : "bottom-right",
        });
        
        // Redirect to dashboard layout or setup route
        router.push(`/${locale}${result.redirectTo || "/"}`);
        router.refresh();
      } else {
        setError(result.error || t("auth.loginErrorDefault"));
        toast.error(result.error || t("auth.loginErrorDefault"));
      }
    });
  };

  return (
    <div className={cn(
      "relative min-h-screen bg-[#050811] text-slate-100 overflow-hidden flex w-screen selection:bg-teal-500/30"
    )}>
      
      {/* ── LEFT PANEL: LUXURY AUTHENTICATION FORM ────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 md:p-12 relative z-10 min-h-screen">
        
        {/* Ambient background lights in the login section */}
        <div className="absolute top-[-20%] start-[-10%] w-[500px] h-[500px] rounded-full bg-teal-950/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] end-[-10%] w-[400px] h-[400px] rounded-full bg-emerald-950/10 blur-[120px] pointer-events-none" />

        {/* Top Header Bar */}
        <div className="flex justify-between items-center z-20 w-full max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 rounded-xl border border-teal-500/20 shadow-lg shadow-teal-500/5">
              <Activity className="h-5.5 w-5.5 text-teal-400 animate-pulse" />
            </div>
            <span className="font-bold text-base bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-400 tracking-wide font-cairo">
              {t("common.title")}
            </span>
          </div>

          <button
            onClick={handleToggleLocale}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 hover:bg-teal-900/30 border border-slate-800 hover:border-teal-500/30 text-slate-300 hover:text-teal-400 rounded-xl transition-all duration-300 backdrop-blur-md text-xs shadow-md cursor-pointer"
          >
            <Globe size={14} />
            <span className="font-medium font-cairo">{locale === "ar" ? "English" : "عربي"}</span>
          </button>
        </div>

        {/* Main Authentication Card */}
        <div className="flex-1 flex items-center justify-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            <div className="bg-slate-950/40 backdrop-blur-2xl border border-slate-900 rounded-3xl p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
              {/* Dynamic subtle border beam on the login card */}
              <BorderBeam colorFrom="#0d9488" colorTo="#059669" borderWidth={1.5} duration={12} />

              {/* Heading */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight font-cairo mb-2">
                  {t("auth.login")}
                </h1>
                <p className="text-slate-400 font-cairo text-sm">
                  {t("auth.loginSubtitle")}
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
                    <span className="absolute inset-y-0 start-4 flex items-center text-slate-500">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="name@hospital.com.eg"
                      className="w-full py-3.5 ps-11 pe-4 bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800 focus:border-teal-500 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans text-sm"
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
                    <span className="absolute inset-y-0 start-4 flex items-center text-slate-500">
                      <Lock size={18} />
                    </span>
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="••••••••"
                      className="w-full py-3.5 ps-11 pe-4 bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800 focus:border-teal-500 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans text-sm"
                    />
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs text-slate-400 font-cairo">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      name="remember"
                      className="rounded bg-slate-900 border-slate-800 text-teal-600 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                    <label htmlFor="remember" className="cursor-pointer select-none">
                      {t("auth.rememberMe")}
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
                      <span>{t("auth.authenticating")}</span>
                    </>
                  ) : (
                    <span>{t("auth.login")}</span>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>

        {/* Egyptian MOH/ETA Compliance Footer */}
        <div className="w-full max-w-lg mx-auto mt-6">
          <p 
            className="text-center text-slate-500 text-[10px] md:text-xs font-cairo leading-relaxed"
            dangerouslySetInnerHTML={{ __html: t("auth.complianceFooter") }}
          />
        </div>
      </div>

      {/* ── RIGHT PANEL: PREMIUM BRAND SHOWCASE (50% Width) ────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#090d16] relative overflow-hidden flex-col justify-between p-12 border-s border-slate-900/50">
        
        {/* Animated Background Mesh & Grids */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,#0f766e15_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,#04785710_0%,transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

        {/* Floating Decorative Medical Icons (Micro-animations) */}
        <motion.div 
          animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-24 end-24 text-teal-500/15"
        >
          <Stethoscope size={64} />
        </motion.div>
        <motion.div 
          animate={{ y: [0, 15, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-24 start-24 text-emerald-500/15"
        >
          <HeartPulse size={72} />
        </motion.div>

        {/* Top Header Label */}
        <div className="relative flex items-center gap-2.5 text-xs font-bold text-accent tracking-wider uppercase bg-accent/10 border border-accent/25 px-3 py-1.5 rounded-full w-fit">
          <Sparkles className="h-3.5 w-3.5 animate-spin-slow" />
          <span>{isRtl ? "نظام موحد وآمن بالكامل" : "Fully Integrated & Secure Enterprise"}</span>
        </div>

        {/* Core Showcase Card & Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto">
          
          <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight font-cairo mb-4 text-start">
            {isRtl 
              ? "الجيل القادم من الأنظمة الطبية المتكاملة" 
              : "The Next Generation of Digital Healthcare"}
          </h2>
          
          <p className="text-slate-400 text-sm md:text-base leading-relaxed text-start font-cairo mb-12">
            {isRtl 
              ? "نظام ذكي متكامل لتسهيل رعاية المرضى وإدارة غرف العمليات والصيدليات، متوافق مع متطلبات وزارة الصحة المصرية ومنظومة الفاتورة الإلكترونية لمصلحة الضرائب."
              : "A secure, modern system tailored for high-acuity surgical scheduling, smart nursing handovers, and compliance with the Egyptian Ministry of Health & Tax Authority (ETA)."}
          </p>

          {/* Luxury Micro-animated Statistics Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Stat Card 1 */}
            <div className="relative bg-slate-950/30 backdrop-blur-xl border border-slate-900/60 p-4.5 rounded-2xl overflow-hidden group">
              <BorderBeam colorFrom="#0ea5e9" colorTo="#22d3ee" size={100} duration={8} />
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Building2 size={20} />
                </div>
                <div className="text-start">
                  <span className="text-xl font-black text-white leading-none">
                    <NumberTicker value={50} />+
                  </span>
                  <p className="text-[10px] font-medium text-slate-400 font-cairo mt-1">
                    {isRtl ? "مستشفيات نشطة" : "Active Hospitals"}
                  </p>
                </div>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="relative bg-slate-950/30 backdrop-blur-xl border border-slate-900/60 p-4.5 rounded-2xl overflow-hidden group">
              <BorderBeam colorFrom="#10b981" colorTo="#34d399" size={100} duration={8} />
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div className="text-start">
                  <span className="text-xl font-black text-white leading-none">
                    <NumberTicker value={99} />.9%
                  </span>
                  <p className="text-[10px] font-medium text-slate-400 font-cairo mt-1">
                    {isRtl ? "معدل تشغيل النظام" : "Uptime Guarantee"}
                  </p>
                </div>
              </div>
            </div>

            {/* Stat Card 3 */}
            <div className="relative bg-slate-950/30 backdrop-blur-xl border border-slate-900/60 p-4.5 rounded-2xl overflow-hidden group">
              <BorderBeam colorFrom="#f59e0b" colorTo="#fbbf24" size={100} duration={8} />
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Users size={20} />
                </div>
                <div className="text-start">
                  <span className="text-xl font-black text-white leading-none">
                    <NumberTicker value={125000} />+
                  </span>
                  <p className="text-[10px] font-medium text-slate-400 font-cairo mt-1">
                    {isRtl ? "سجل طبي مسجل" : "Registered PHI Records"}
                  </p>
                </div>
              </div>
            </div>

            {/* Stat Card 4 */}
            <div className="relative bg-slate-950/30 backdrop-blur-xl border border-slate-900/60 p-4.5 rounded-2xl overflow-hidden group">
              <BorderBeam colorFrom="#8b5cf6" colorTo="#a78bfa" size={100} duration={8} />
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Cpu size={20} />
                </div>
                <div className="text-start">
                  <span className="text-xl font-black text-white leading-none">
                    <NumberTicker value={4800} />+
                  </span>
                  <p className="text-[10px] font-medium text-slate-400 font-cairo mt-1">
                    {isRtl ? "طبيب ممارس يومياً" : "Daily Active Clinicians"}
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Hospital Branding Tag */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium relative z-10 border-t border-slate-900 pt-6">
          <span>&copy; {new Date().getFullYear()} HMS EGYPT.</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {isRtl ? "خادم القاهرة النشط" : "Active Cairo Node"}
          </span>
        </div>

      </div>

    </div>
  );
}
