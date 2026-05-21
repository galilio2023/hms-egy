"use client";

import React from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { ChevronRight, ChevronLeft, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageShellProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function PageShell({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  className,
  headerClassName,
}: PageShellProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className={cn("flex flex-col min-h-full w-full space-y-6 animate-fade-in p-6 lg:p-8", className)}>
      {/* Page Header Area */}
      <div
        className={cn(
          "flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/40",
          headerClassName
        )}
      >
        <div className="space-y-1.5">
          {/* Breadcrumbs Navigation */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center space-x-1.5 space-x-reverse text-xs text-muted-foreground mb-2" aria-label="Breadcrumb">
              <Link
                href="/"
                className="hover:text-accent transition-colors duration-200 flex items-center gap-1 font-medium"
              >
                <Home className="h-3.5 w-3.5" />
              </Link>
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={index}>
                    <ChevronIcon className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="hover:text-accent transition-colors duration-200 font-medium"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={cn("truncate font-semibold", isLast && "text-foreground")}>
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )}

          {/* Title and Subtitle */}
          <div className="space-y-1">
            {typeof title === "string" ? (
              <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight scroll-m-20">
                {title}
              </h1>
            ) : (
              title
            )}
            {subtitle && (
              <div className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Header Actions (Buttons, dropdowns, etc.) */}
        {actions && (
          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Main Page Content */}
      <main className="flex-1 w-full animate-slide-up">
        {children}
      </main>
    </div>
  );
}
