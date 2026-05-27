"use client";

import React, { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Command } from "cmdk";
import { 
  Search, 
  Calendar, 
  Users, 
  Syringe, 
  Brush, 
  Pill, 
  Beaker,  
  LayoutDashboard, 
  Lock, 
  Settings,
  HelpCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/client";
import { motion, AnimatePresence } from "framer-motion";

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function CommandPalette({ isOpen, setIsOpen }: CommandPaletteProps) {
  const t = useTranslations("common");
  const navT = useTranslations("navigation");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const { data: session } = useSession();
  
  const hospitalSlug = (session?.session as any)?.activeHospitalId || (session?.user as any)?.hospitalId || "system-wide";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, setIsOpen]);

  const runCommand = (command: () => void) => {
    command();
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        >
          <div 
            className="fixed inset-0" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="fixed top-[15%] inset-x-0 mx-auto w-full max-w-2xl px-4">
            <motion.div
              initial={{ scale: 0.95, y: -15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: -15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            >
              <Command 
                className="w-full bg-card text-card-foreground border border-border shadow-2xl rounded-2xl overflow-hidden glass-card text-start"
                dir={isRtl ? "rtl" : "ltr"}
              >
          <div className="flex items-center px-4 border-b border-border/40 py-1">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Command.Input 
              autoFocus
              placeholder={isRtl ? "اكتب أمرًا أو ابحث عن..." : "Type a command or search..."}
              className="w-full h-12 px-3 bg-transparent text-sm border-0 focus:outline-hidden focus:ring-0 text-foreground placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[350px] overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            <Command.Empty className="text-xs text-muted-foreground py-6 text-center">
              {isRtl ? "لم يتم العثور على نتائج." : "No results found."}
            </Command.Empty>

            {/* Quick Access Actions */}
            <Command.Group 
              heading={<span className="text-[10px] font-bold tracking-wider text-accent px-2 py-1 block uppercase">{isRtl ? "الإجراءات السريعة" : "Quick Actions"}</span>}
            >
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}/surgical/schedule`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{isRtl ? "جدولة عملية جراحية" : "Schedule Surgery"}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}/settings`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <Settings className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{isRtl ? "عرض غرف العمليات والشواغر" : "View OR Rooms & Availability"}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => {
                  localStorage.setItem("workstation_locked", "true");
                  window.dispatchEvent(new Event("storage"));
                })}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-destructive/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-destructive/10 aria-selected:text-destructive font-medium group"
              >
                <Lock className="h-4 w-4 text-muted-foreground group-hover:text-destructive group-aria-selected:text-destructive" />
                <span>{isRtl ? "تأمين محطة العمل" : "Lock Workstation Screen"}</span>
              </Command.Item>
            </Command.Group>

            <div className="h-px bg-border/40 my-1" />

            {/* Navigation Group */}
            <Command.Group 
              heading={<span className="text-[10px] font-bold tracking-wider text-accent px-2 py-1 block uppercase">{isRtl ? "الانتقال إلى الأقسام" : "Navigate to Departments"}</span>}
            >
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{navT("dashboard")}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}/patients`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <Users className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{navT("patients")}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}/surgical`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <Syringe className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{navT("surgical")}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}/pharmacy`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <Pill className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{navT("pharmacy")}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}/laboratory`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <Beaker className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{navT("laboratory")}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push(`/${hospitalSlug}/housekeeping`))}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent/10 rounded-xl cursor-pointer transition-all duration-150 aria-selected:bg-accent/10 aria-selected:text-accent font-medium group"
              >
                <Brush className="h-4 w-4 text-muted-foreground group-hover:text-accent group-aria-selected:text-accent" />
                <span>{navT("housekeeping")}</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Help / Tip Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/30 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5 text-accent" />
              {isRtl ? "استخدم الأسهم للتنقل و Enter للاختيار" : "Use arrow keys to navigate and Enter to select"}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3 text-accent" />
              {isRtl ? "توقيت القاهرة المعتمد" : "Cairo Standard Time"}
            </span>
          </div>
              </Command>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
