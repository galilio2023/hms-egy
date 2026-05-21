"use client";

import React, { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useSession, signOut } from "@/lib/auth/client";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Stethoscope, 
  BedDouble, 
  Pill, 
  Beaker, 
  Activity, 
  Syringe, 
  CalendarRange, 
  ClipboardList, 
  Brush, 
  CreditCard, 
  BarChart3, 
  UserRound, 
  Settings, 
  LogOut, 
  Lock,
  ChevronLeft,
  ChevronRight,
  Menu,
  HeartPulse
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItem {
  key: string;
  href: string;
  icon: React.ComponentType<any>;
  roles?: string[];
  subItems?: SidebarItem[];
}

export function Sidebar() {
  const t = useTranslations("navigation");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

  const user = session?.user;
  const userRole = (user as any)?.role || "DOCTOR";
  const hospitalSlug = (session?.session as any)?.activeHospitalId || (user as any)?.hospitalId || "system-wide";

  // Navigation schema configured for HMS Egypt modules
  const navItems: SidebarItem[] = [
    {
      key: "dashboard",
      href: `/${hospitalSlug}`,
      icon: LayoutDashboard,
    },
    {
      key: "patients",
      href: `/${hospitalSlug}/patients`,
      icon: Users,
      roles: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "SURGEON", "ANESTHESIOLOGIST", "NURSE", "OR_NURSE", "RECEPTIONIST"],
    },
    {
      key: "appointments",
      href: `/${hospitalSlug}/appointments`,
      icon: Calendar,
      roles: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "SURGEON", "NURSE", "RECEPTIONIST"],
    },
    {
      key: "clinical",
      href: `/${hospitalSlug}/clinical`,
      icon: Stethoscope,
      roles: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "SURGEON", "NURSE"],
    },
    {
      key: "inpatient",
      href: `/${hospitalSlug}/inpatient`,
      icon: BedDouble,
      roles: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "SURGEON", "NURSE"],
    },
    {
      key: "surgical",
      href: `/${hospitalSlug}/surgical`,
      icon: Syringe,
      roles: ["SUPER_ADMIN", "ADMIN", "SURGEON", "ANESTHESIOLOGIST", "OR_NURSE"],
      subItems: [
        {
          key: "orSchedule",
          href: `/${hospitalSlug}/surgical/schedule`,
          icon: CalendarRange,
        },
        {
          key: "surgicalCases",
          href: `/${hospitalSlug}/surgical/cases`,
          icon: ClipboardList,
        }
      ]
    },
    {
      key: "pharmacy",
      href: `/${hospitalSlug}/pharmacy`,
      icon: Pill,
      roles: ["SUPER_ADMIN", "ADMIN", "PHARMACIST", "DOCTOR", "NURSE"],
    },
    {
      key: "laboratory",
      href: `/${hospitalSlug}/laboratory`,
      icon: Beaker,
      roles: ["SUPER_ADMIN", "ADMIN", "LAB_TECH", "DOCTOR", "NURSE"],
    },
    {
      key: "radiology",
      href: `/${hospitalSlug}/radiology`,
      icon: Activity,
      roles: ["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE"], // Add roles if applicable
    },
    {
      key: "housekeeping",
      href: `/${hospitalSlug}/housekeeping`,
      icon: Brush,
      roles: ["SUPER_ADMIN", "ADMIN", "HOUSEKEEPING"],
    },
    {
      key: "billing",
      href: `/${hospitalSlug}/billing`,
      icon: CreditCard,
      roles: ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"],
    },
    {
      key: "reports",
      href: `/${hospitalSlug}/reports`,
      icon: BarChart3,
      roles: ["SUPER_ADMIN", "ADMIN"],
    },
    {
      key: "portal",
      href: `/${hospitalSlug}/portal`,
      icon: UserRound,
      roles: ["SUPER_ADMIN", "ADMIN"],
    },
    {
      key: "settings",
      href: `/${hospitalSlug}/settings`,
      icon: Settings,
      roles: ["SUPER_ADMIN", "ADMIN"],
    }
  ];

  // Helper to filter nav items based on user roles
  const filteredItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    setActiveSubMenu(null);
  };

  const handleSubMenuToggle = (key: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setActiveSubMenu(key);
    } else {
      setActiveSubMenu(activeSubMenu === key ? null : key);
    }
  };

  const isItemActive = (item: SidebarItem) => {
    if (pathname === item.href) return true;
    if (item.subItems) {
      return item.subItems.some(sub => pathname.startsWith(sub.href));
    }
    return pathname.startsWith(item.href) && item.href !== `/${hospitalSlug}`;
  };

  const handleLockScreen = () => {
    localStorage.setItem("workstation_locked", "true");
    window.dispatchEvent(new Event("storage"));
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <aside 
      className={cn(
        "h-screen flex flex-col bg-primary text-primary-foreground border-border/10 transition-all duration-300 ease-in-out shadow-2xl relative z-20",
        isCollapsed ? "w-20" : "w-64",
        isRtl ? "border-l" : "border-r"
      )}
    >
      {/* Sidebar Header Brand block */}
      <div className="flex items-center justify-between px-4 py-6 border-b border-white/5 h-20">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2.5 bg-accent/25 rounded-xl border border-accent/30 text-accent flex-shrink-0 animate-pulse">
            <HeartPulse className="h-6 w-6" />
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg tracking-wide whitespace-nowrap bg-gradient-to-r from-white via-slate-100 to-accent bg-clip-text text-transparent">
              HMS EGYPT
            </span>
          )}
        </div>
        <button 
          onClick={handleToggleCollapse}
          className="p-1.5 hover:bg-white/10 rounded-lg text-primary-foreground/70 hover:text-white transition-colors duration-200 hidden md:block"
        >
          {isCollapsed ? (
            isRtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />
          ) : (
            isRtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Main Navigation Items block */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredItems.map((item) => {
          const isActive = isItemActive(item);
          const hasSubItems = !!item.subItems && item.subItems.length > 0;
          const isSubMenuOpen = activeSubMenu === item.key || (isActive && activeSubMenu === null);
          const Icon = item.icon;

          if (hasSubItems) {
            return (
              <div key={item.key} className="space-y-1">
                <button
                  onClick={() => handleSubMenuToggle(item.key)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                    isActive 
                      ? "bg-white/10 text-white shadow-[inset_0px_1px_1px_rgba(255,255,255,0.1)] border border-white/5" 
                      : "text-primary-foreground/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn(
                      "h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                      isActive ? "text-accent" : "text-primary-foreground/60 group-hover:text-white"
                    )} />
                    {!isCollapsed && <span>{t(item.key)}</span>}
                  </div>
                  {!isCollapsed && (
                    <div className="transition-transform duration-200">
                      {isSubMenuOpen ? (
                        <ChevronRight className="h-4 w-4 rotate-90" />
                      ) : (
                        <ChevronRight className={isRtl ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
                      )}
                    </div>
                  )}
                  {/* Subtle active border glow */}
                  {isActive && !isCollapsed && (
                    <div className={cn(
                      "absolute top-0 bottom-0 w-1 bg-accent rounded-full",
                      isRtl ? "right-0" : "left-0"
                    )} />
                  )}
                </button>

                {/* Submenu Children container */}
                {isSubMenuOpen && !isCollapsed && (
                  <div className={cn(
                    "space-y-1 py-1 transition-all duration-300 ease-in-out",
                    isRtl ? "pr-8" : "pl-8"
                  )}>
                    {item.subItems!.map((sub) => {
                      const isSubActive = pathname === sub.href;
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          key={sub.key}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 relative group",
                            isSubActive 
                              ? "bg-accent/20 text-white" 
                              : "text-primary-foreground/60 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <SubIcon className={cn(
                            "h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                            isSubActive ? "text-accent" : "text-primary-foreground/40 group-hover:text-white"
                          )} />
                          <span>{t(sub.key)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                isActive 
                  ? "bg-white/10 text-white shadow-[inset_0px_1px_1px_rgba(255,255,255,0.1)] border border-white/5" 
                  : "text-primary-foreground/70 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                isActive ? "text-accent" : "text-primary-foreground/60 group-hover:text-white"
              )} />
              {!isCollapsed && <span>{t(item.key)}</span>}
              
              {/* Active glow enforcers */}
              {isActive && (
                <div className={cn(
                  "absolute top-0 bottom-0 w-1 bg-accent rounded-full",
                  isRtl ? "right-0" : "left-0"
                )} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer block (Lockscreen & Log out buttons) */}
      <div className="p-3 border-t border-white/5 space-y-1 h-36">
        <button
          onClick={handleLockScreen}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-primary-foreground/60 hover:text-accent hover:bg-accent/10 transition-all duration-200 group"
          title={t("lockWorkstation")}
        >
          <Lock className="h-4.5 w-4.5 flex-shrink-0 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />
          {!isCollapsed && <span>{t("lockWorkstation")}</span>}
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-destructive-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
          title={t("logout")}
        >
          <LogOut className="h-4.5 w-4.5 flex-shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:scale-110" />
          {!isCollapsed && <span>{t("logout")}</span>}
        </button>
      </div>
    </aside>
  );
}
