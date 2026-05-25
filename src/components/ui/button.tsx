"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "accent" | "outline" | "destructive" | "ghost" | "link";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "icon";
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild = false, ...props }, ref) => {
    // If we have asChild, normally we'd render Radix Slot, but we can just use normal button or fallback to simple elements.
    // For pure atomic components without heavy Radix, standard ref-forwarded button is best.
    
    const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 select-none cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/10 border border-primary/20",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40",
      accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 border border-accent/10 hover:shadow-accent/30",
      outline: "bg-transparent border border-border text-foreground hover:bg-muted/50 hover:border-muted-foreground/30",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/10 border border-destructive/20",
      ghost: "bg-transparent text-foreground hover:bg-muted/50",
      link: "bg-transparent text-accent hover:underline p-0 underline-offset-4 active:scale-100 disabled:opacity-100"
    };

    const sizes = {
      xs: "h-8 px-2.5 text-[11px] rounded-lg",
      sm: "h-9 px-3.5 text-xs rounded-xl",
      md: "h-11 px-5 text-sm rounded-xl",
      lg: "h-12 px-6 text-base rounded-2xl",
      xl: "h-14 px-8 text-lg rounded-2xl",
      icon: "h-10 w-10 p-0"
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
