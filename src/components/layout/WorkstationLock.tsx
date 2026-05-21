"use client";

import { useState, useEffect } from "react";
import { useWorkstation } from "@/context/WorkstationContext";
import { useSession, signOut } from "@/lib/auth/client";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, UserMinus, ShieldAlert, Loader2, KeyRound } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

export default function WorkstationLock() {
  const { isLocked, unlockStation } = useWorkstation();
  const { data: sessionData, isPending: isSessionPending } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [password, setPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRtl = locale === "ar";
  const user = sessionData?.user as any;

  // Securely enforce password renewal for sessions marked as expired
  useEffect(() => {
    if (
      user?.isPasswordExpired &&
      !pathname.includes("/change-password") &&
      !pathname.includes("/login")
    ) {
      router.replace(`/${locale}/change-password`);
    }
  }, [user, pathname, locale, router]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setError(null);
    setIsUnlocking(true);

    try {
      const success = await unlockStation(password);
      if (success) {
        setPassword("");
      } else {
        setError(isRtl ? "كلمة المرور غير صحيحة." : "Incorrect password.");
      }
    } catch (err) {
      setError(isRtl ? "فشل التحقق من كلمة المرور." : "Validation failed.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSwitchUser = async () => {
    try {
      await signOut();
      localStorage.removeItem("workstation_locked");
      window.location.href = `/${locale}/login`; // Force redirect and reload state
    } catch (err) {
      console.error("Sign out failed during workstation switch:", err);
    }
  };

  if (!isLocked) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center p-4 overflow-hidden selection:bg-teal-500/20"
      >
        {/* Subtle Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ scale: 0.92, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 15 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-slate-950/40 border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />

          {/* Header icon / lock status */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-400 mb-4 shadow-lg shadow-rose-500/5">
              <Lock size={28} className="animate-pulse" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 font-cairo mb-1">
              {isRtl ? "محطة العمل مقفلة مؤقتاً" : "Workstation Locked"}
            </h1>
            <p className="text-slate-400 font-cairo text-sm">
              {isRtl ? "جلسة العمل قيد التشغيل وآمنة" : "Your active clinical session is secured"}
            </p>
          </div>

          {/* Current User Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 mb-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 border border-teal-500/20 flex items-center justify-center font-bold text-teal-400 font-cairo text-lg">
              {user?.name ? user.name[0] : <Loader2 className="animate-spin" />}
            </div>
            <div className="flex-1 overflow-hidden">
              <h2 className="font-bold text-slate-200 text-sm truncate font-cairo">
                {user?.name || (isRtl ? "جاري جلب بيانات الطبيب..." : "Retrieving provider info...")}
              </h2>
              <p className="text-xs text-teal-400 font-semibold uppercase tracking-wider mt-0.5 font-cairo">
                {user?.role === "ADMIN" ? (isRtl ? "مسؤول النظام" : "Administrator") : (user?.role || "")}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-cairo text-center"
            >
              {error}
            </motion.div>
          )}

          {/* Password Unlock Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 font-cairo uppercase tracking-wider">
                {isRtl ? "أدخل كلمة المرور لإلغاء القفل" : "Enter Password to Unlock"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-4 flex items-center text-slate-500">
                  <KeyRound size={16} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full py-3.5 ps-11 pe-4 bg-slate-900/50 hover:bg-slate-900/80 focus:bg-[#0c1220] border border-slate-800 focus:border-rose-500/60 text-slate-100 placeholder-slate-600 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-rose-500/50 text-sm font-sans"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={isUnlocking}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 transition-all duration-300 transform active:scale-[0.98] text-sm font-cairo flex items-center justify-center gap-2 cursor-pointer"
              >
                {isUnlocking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                    <span>{isRtl ? "جاري إلغاء القفل..." : "Unlocking..."}</span>
                  </>
                ) : (
                  <>
                    <Unlock size={16} />
                    <span>{isRtl ? "إلغاء قفل الشاشة" : "Unlock Station"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSwitchUser}
                className="w-full py-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-200 font-bold rounded-2xl transition-all duration-300 text-sm font-cairo flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <UserMinus size={16} />
                <span>{isRtl ? "تبديل المستخدم / الخروج" : "Switch User / Sign Out"}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
