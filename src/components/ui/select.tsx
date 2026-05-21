"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error = false, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-xl border border-border bg-background ps-4 pe-10 py-2 text-sm text-foreground appearance-none transition-all duration-200 focus-visible:outline-hidden focus-visible:border-accent/80 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
            error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="absolute top-[14px] end-3 pointer-events-none text-muted-foreground">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";
