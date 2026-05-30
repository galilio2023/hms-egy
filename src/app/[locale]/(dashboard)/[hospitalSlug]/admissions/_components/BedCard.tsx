"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { BedIcon, Plus } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BedCardProps {
  bed: {
    bedId: string;
    bedNumber: string;
    status: "available" | "occupied" | "maintenance" | "reserved" | "quarantine" | "pending_cleaning";
    patientNameAr: string | null;
    patientNameEn: string | null;
    patientNumber: string | null;
  };
  locale: string;
}

export function BedCard({ bed, locale }: BedCardProps) {
  const t = useTranslations("admissions");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Decide color styling based on bed status
  let statusColor = "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10";
  let statusBadge = "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
  let patientName = "";

  if (bed.status === "occupied") {
    statusColor = "border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10";
    statusBadge = "bg-blue-500/20 text-blue-600 dark:text-blue-400";
    patientName = isRtl ? (bed.patientNameAr || bed.patientNameEn || "") : (bed.patientNameEn || "");
  } else if (bed.status === "pending_cleaning") {
    statusColor = "border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 cursor-not-allowed";
    statusBadge = "bg-amber-500/20 text-amber-600 dark:text-amber-400";
  } else if (bed.status === "maintenance") {
    statusColor = "border-border text-muted-foreground bg-muted/30 cursor-not-allowed";
    statusBadge = "bg-muted text-muted-foreground";
  }

  const handleBedClick = () => {
    const params = new URLSearchParams(searchParams);
    
    if (bed.status === "available") {
      params.set("admitBedId", bed.bedId);
      router.push(`${pathname}?${params.toString()}`);
    } else if (bed.status === "occupied") {
      params.set("selectedBedId", bed.bedId);
      router.push(`${pathname}?${params.toString()}`);
    } else if (bed.status === "pending_cleaning") {
      toast.info(t("bedPendingCleaning"));
    } else {
      toast.warning(t("bedUnavailable"));
    }
  };

  return (
    <button
      onClick={handleBedClick}
      className={cn(
        "flex flex-col justify-between p-4 rounded-xl border border-dashed transition-all text-start w-full relative outline-none focus:ring-2 focus:ring-primary h-28 group",
        statusColor
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="font-black text-sm flex items-center gap-1.5">
          <BedIcon className="h-4 w-4 text-muted-foreground group-hover:scale-110 transition-transform" />
          {isRtl ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}
        </span>
        <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full capitalize", statusBadge)}>
          {t(bed.status)}
        </span>
      </div>

      {bed.status === "occupied" ? (
        <div className="mt-3 space-y-1 flex-1 flex flex-col justify-end">
          <p className="text-xs font-black truncate max-w-full text-foreground group-hover:text-primary transition-colors">
            {patientName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {bed.patientNumber || ""}
          </p>
        </div>
      ) : (
        <div className="mt-3 text-[10px] text-muted-foreground flex flex-col justify-end flex-1">
          {bed.status === "available" ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Plus className="h-3 w-3" />
              {isRtl ? "اضغط للإدخال" : "Click to Admit"}
            </span>
          ) : bed.status === "pending_cleaning" ? (
            <span className="text-amber-600 dark:text-amber-400 font-bold">{isRtl ? "بانتظار التعقيم" : "Cleaning Queue"}</span>
          ) : (
            <span>{isRtl ? "مغلق حالياً" : "Out of Service"}</span>
          )}
        </div>
      )}
    </button>
  );
}
