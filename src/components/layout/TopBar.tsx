"use client";

import React, { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/lib/auth/client";
import { useTheme } from "next-themes";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Sun, Moon, Search, Clock, ShieldCheck, Hospital, ChevronDown, User, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onSearchClick?: () => void;
}

export function TopBar({ onSearchClick }: TopBarProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [cairoTime, setCairoTime] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const user = session?.user;
  const userRole = (user as any)?.role || "DOCTOR";
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
    <header className="h-20 bg-card/60 backdrop-blur-md border-b border-border/40 px-6 flex items-center justify-between relative z-10 w-full glass">
      {/* Search / Command palette trigger button */}
      <div className="flex-1 max-w-md">
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
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
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
              <div className={cn(
                "absolute top-12 w-56 bg-card border border-border rounded-xl shadow-xl py-2 z-20 animate-slide-up glass-card",
                isRtl ? "left-0 origin-top-left" : "right-0 origin-top-right"
              )}>
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
