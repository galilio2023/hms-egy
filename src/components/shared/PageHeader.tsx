import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/30 pb-6 text-start",
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              {icon}
            </span>
          )}
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground max-w-xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
