"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Drawer({ open, onOpenChange, children }: DrawerProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";

  // Prevent scrolling when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const slideDirection = isRtl 
    ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } } 
    : { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" } };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Drawer container sliding from right for RTL or left for LTR */}
          <motion.div
            initial={slideDirection.initial}
            animate={slideDirection.animate}
            exit={slideDirection.exit}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed top-0 bottom-0 w-full max-w-md bg-card text-card-foreground border-border shadow-2xl overflow-hidden glass-card flex flex-col z-10 start-0 border-e"
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function DrawerHeader({ className, children, onClose, ...props }: DrawerHeaderProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <div className={cn("flex flex-row items-center justify-between p-6 border-b border-border/40 shrink-0", className)} {...props}>
      <div className="flex-1 space-y-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted/80 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer ms-auto"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function DrawerTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-black tracking-tight leading-none", className)} {...props}>
      {children}
    </h3>
  );
}

export function DrawerDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted-foreground mt-1 leading-normal", className)} {...props}>
      {children}
    </p>
  );
}

export function DrawerContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex-1 p-6 overflow-y-auto scrollbar-thin space-y-4", className)} {...props}>
      {children}
    </div>
  );
}

export function DrawerFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-end gap-3 p-6 border-t border-border/10 bg-muted/20 shrink-0", className)} {...props}>
      {children}
    </div>
  );
}
