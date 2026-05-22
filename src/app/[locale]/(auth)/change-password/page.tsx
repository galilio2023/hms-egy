"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isRtl = locale === "ar";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const oldPassword = formData.get("oldPassword")?.toString();
    const newPassword = formData.get("newPassword")?.toString();
    const confirmPassword = formData.get("confirmPassword")?.toString();

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError(t("auth.errorFieldsRequired"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("auth.errorPasswordLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.errorPasswordMismatch"));
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction(oldPassword, newPassword);
      if (result.success) {
        toast.success(t("auth.changePasswordSuccess"));
        router.push(`/${locale}`);
        router.refresh();
      } else {
        setError(result.error || t("auth.errorGenericUpdate"));
      }
    });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#090d16] text-slate-100 overflow-hidden px-4">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] start-[-10%] w-[600px] h-[600px] rounded-full bg-teal-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] end-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-slate-950/40 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 text-teal-400 mb-4">
              <ShieldAlert size={28} />
            </div>
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 font-cairo mb-2">
              {t("auth.forcedPasswordTitle")}
            </h1>
            <p className="text-slate-400 font-cairo text-sm leading-relaxed">
              {t("auth.forcedPasswordSubtitle")}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl font-cairo text-center"
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Old Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 font-cairo uppercase tracking-wider">
                {t("auth.currentPassword")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-4 flex items-center text-slate-500">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  name="oldPassword"
                  required
                  placeholder="••••••••"
                  className="w-full py-3.5 ps-11 pe-4 bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800/80 focus:border-teal-500 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 font-cairo uppercase tracking-wider">
                {t("auth.newPassword")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-4 flex items-center text-slate-500">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  name="newPassword"
                  required
                  placeholder="••••••••"
                  className="w-full py-3.5 ps-11 pe-4 bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800/80 focus:border-teal-500 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 font-cairo uppercase tracking-wider">
                {t("auth.confirmNewPassword")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-4 flex items-center text-slate-500">
                  <CheckCircle2 size={18} />
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  placeholder="••••••••"
                  className="w-full py-3.5 ps-11 pe-4 bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800/80 focus:border-teal-500 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-2xl shadow-xl shadow-teal-500/10 hover:shadow-teal-500/20 transition-all duration-300 transform active:scale-[0.98] text-sm font-cairo flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>{t("auth.updatingPassword")}</span>
                </>
              ) : (
                <span>{t("auth.updateAndProceed")}</span>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
