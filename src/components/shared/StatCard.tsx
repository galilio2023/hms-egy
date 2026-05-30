import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  iconClassName?: string;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  className?: string;
  description?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconClassName,
  trend,
  className,
  description,
}: StatCardProps) {
  return (
    <Card className={cn("rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start", className)}>
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-foreground tracking-tight">
              {value}
            </h3>
            {trend && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                trend.isPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
              )}>
                {trend.isPositive ? "+" : "-"}{trend.value}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-[10px] text-muted-foreground line-clamp-1">
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn("p-3 rounded-2xl", iconClassName || "bg-primary/10 text-primary")}>
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
