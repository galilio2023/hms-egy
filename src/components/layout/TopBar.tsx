"use client";

import React, { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/lib/auth/client";
import { useTheme } from "next-themes";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Sun, Moon, Search, Clock, ShieldCheck, Hospital, ChevronDown, User, Activity, Menu, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onSearchClick?: () => void;
  onMobileMenuClick?: () => void;
}

export function TopBar({ onSearchClick, onMobileMenuClick }: TopBarProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [cairoTime, setCairoTime] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const user = session?.user as unknown as import("@/types/auth-api.types").User;
  const userRole = user?.role || "DOCTOR";
  const hospitalName = isRtl ? "مستشفى مصر التخصصي" : "Egypt Specialist Hospital";

  // Prevent hydration mismatch for client-only components
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dynamic clock synced with Africa/Cairo time zone
  useEffect(() => {
    const updateClock = () => {
      const formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        timeZone: "Africa/Cairo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCairoTime(formatter.format(new Date()));
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [locale]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "ADMIN": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "SURGEON": return "bg-accent/10 text-accent border-accent/20";
      case "ANESTHESIOLOGIST": return "bg-sky-500/10 text-sky-500 border-sky-500/20";
      case "DOCTOR": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "NURSE": case "OR_NURSE": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const userInitials = user?.name 
    ? user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() 
    : "U";

  return (
    <header className="h-20 border-b border-border/40 px-4 md:px-6 flex items-center justify-between relative z-10 w-full glass">
      
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile menu trigger button */}
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden p-2.5 bg-background border border-border hover:border-accent/40 rounded-xl text-muted-foreground hover:text-foreground hover:shadow-sm transition-all duration-200"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search / Command palette trigger button (Desktop) */}
        <div className="flex-1 max-w-md hidden sm:block">
          <button
            onClick={onSearchClick}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-background border border-border hover:border-accent/40 rounded-xl text-muted-foreground hover:text-foreground hover:shadow-sm transition-all duration-200 group text-start"
          >
            <div className="flex items-center gap-3">
              <Search className="h-4.5 w-4.5 text-muted-foreground group-hover:text-accent transition-colors duration-200" />
              <span className="text-xs">
                {isRtl ? "البحث عن المرضى، الحالات الجراحية (Ctrl+K)..." : "Search patients, surgical cases (Ctrl+K)..."}
              </span>
            </div>
            <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>
        
        {/* Search / Command palette trigger button (Mobile) */}
        <button
          onClick={onSearchClick}
          className="sm:hidden p-2.5 bg-background border border-border hover:border-accent/40 rounded-xl text-muted-foreground hover:text-foreground hover:shadow-sm transition-all duration-200"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Action / Information tools block */}
      <div className="flex items-center gap-4">
        {/* Dynamic Cairo Time block */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border/20 rounded-xl text-xs font-semibold text-muted-foreground shadow-[inset_0px_1px_1px_rgba(0,0,0,0.02)]">
          <Clock className="h-4 w-4 text-accent animate-spin-slow" />
          <span className="font-mono min-w-[80px]" dir="ltr">{cairoTime}</span>
          <span className="text-[10px] bg-accent/15 text-accent px-1 rounded font-bold uppercase">{isRtl ? "القاهرة" : "Cairo"}</span>
        </div>

        {/* Dark/Light mode switcher */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-muted/80 rounded-xl border border-border text-muted-foreground hover:text-foreground transition-all duration-200 hover:shadow-sm"
            title={theme === "dark" ? "Light Mode" : "Dark Mode"}
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-yellow-500" /> : <Moon className="h-4.5 w-4.5 text-slate-700" />}
          </button>
        )}

        {/* Language Switcher */}
        <div className="hover:shadow-sm rounded-xl">
          <LanguageSwitcher />
        </div>

        {/* Custom Notification Bell */}
        <div className="relative">
          <motion.button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-muted/80 rounded-xl border border-border text-muted-foreground hover:text-foreground relative transition-all duration-200 hover:shadow-sm"
          >
            <motion.div
              animate={isNotificationOpen ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
            >
              <Bell className="h-4.5 w-4.5" />
            </motion.div>
            
            {/* Animated Ripple Pulse dot for critical STAT warning */}
            <span className="absolute top-1.5 end-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
          </motion.button>

          {/* Notification Popover Dropdown */}
          <AnimatePresence>
            {isNotificationOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsNotificationOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="absolute top-12 w-80 bg-card border border-border rounded-2xl shadow-2xl py-3 z-20 end-0 origin-top-end glass-card"
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  <div className="px-4 pb-2 border-b border-border/40 flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {isRtl ? "التنبيهات العاجلة" : "STAT Notifications"}
                    </span>
                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
                      {isRtl ? "هام جداً" : "Critical"}
                    </span>
                  </div>

                  <div className="px-2 py-1.5 max-h-64 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {/* STAT Critical Alert */}
                    {/* TODO: Integrate with real-time laboratory telemetry API */}
                    {process.env.NODE_ENV !== 'production' && (
                      <div className="p-2.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-xl transition-colors duration-150 text-start">
                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                          <span>{isRtl ? "تنبيه معملي عاجل (STAT)" : "STAT LAB ALERT"}</span>
                        </div>
                        <p className="text-xs font-bold text-foreground mt-1 font-cairo">
                          {isRtl 
                            ? "المريض: علي أحمد - البوتاسيوم 6.2 mmol/L (مرتفع جداً)" 
                            : "Patient: Ali Ahmed - Potassium 6.2 mmol/L (Critical High)"}
                        </p>
                        <span className="text-[9px] text-muted-foreground mt-1 block">
                          {isRtl ? "منذ دقيقتين · معمل الطوارئ" : "2m ago · Emergency Lab"}
                        </span>
                      </div>
                    )}

                    {/* Nursing Handoff Alert */}
                    <div className="p-2.5 hover:bg-muted/50 rounded-xl transition-colors duration-150 text-start border border-transparent">
                      <div className="flex items-center gap-2 text-accent font-bold text-[10px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        <span>{isRtl ? "تسليم الوردية" : "NURSING HANDOFF"}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground mt-1 font-cairo">
                        {isRtl 
                          ? "تحديث سجل تسليم الوردية لغرفة 304 متاح للمراجعة" 
                          : "Shift handover log for Room 304 is ready for review."}
                      </p>
                      <span className="text-[9px] text-muted-foreground mt-1 block">
                        {isRtl ? "منذ 15 دقيقة · الجناح الثالث" : "15m ago · Ward 3"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Separator line */}
        <div className="h-6 w-px bg-border/60" />

        {/* User profile details block */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 hover:bg-muted/50 p-1.5 rounded-xl border border-transparent hover:border-border transition-all duration-200 text-start group"
          >
            <div className="h-9 w-9 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform duration-200">
              {userInitials}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-foreground leading-tight">{user?.name || t("welcome")}</span>
              <span className="text-[10px] text-muted-foreground">{user?.email}</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200 hidden md:block" />
          </button>

          {/* Mini-Dropdown */}
          {isDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute top-12 w-56 bg-card border border-border rounded-xl shadow-xl py-2 z-20 animate-slide-up glass-card end-0 origin-top-end">
                {/* User Info Header */}
                <div className="px-4 py-2 border-b border-border/40 mb-1">
                  <span className="block text-xs font-bold text-foreground">{user?.name}</span>
                  <span className="text-[10px] text-muted-foreground block truncate">{user?.email}</span>
                  <span className={cn(
                    "inline-block text-[9px] font-bold border rounded-full px-2 py-0.5 mt-2",
                    getRoleBadgeColor(userRole)
                  )}>
                    {userRole}
                  </span>
                </div>

                <div className="px-2 py-1 space-y-0.5">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 rounded-lg">
                    <Hospital className="h-4 w-4 text-accent" />
                    <span className="truncate">{hospitalName}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 rounded-lg">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    <span>{isRtl ? "الهوية موثقة" : "Identity Verified"}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
