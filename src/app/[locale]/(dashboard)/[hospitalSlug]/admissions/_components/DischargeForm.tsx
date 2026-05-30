"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { dischargePatient } from "../actions";

interface DischargeFormProps {
  admissionId: string;
  bedId: string;
  locale: string;
  onSuccess: () => void;
}

export function DischargeForm({
  admissionId,
  bedId,
  locale,
  onSuccess,
}: DischargeFormProps) {
  const t = useTranslations("admissions");
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dischargeCondition, setDischargeCondition] = useState<"stable" | "improved" | "referred" | "deceased">("stable");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [summaryAr, setSummaryAr] = useState("");
  const [summaryEn, setSummaryEn] = useState("");

  const handleDischarge = () => {
    if (!summaryAr.trim() || !summaryEn.trim()) {
      toast.error(isRtl ? "يرجى إكمال التلخيص الطبي" : "Please complete medical summary.");
      return;
    }

    startTransition(async () => {
      const res = await dischargePatient({
        admissionId,
        dischargeCondition,
        followUpInstructions,
        summaryAr,
        summaryEn,
      });

      if (res.success) {
        toast.success(t("dischargeSuccess"));
        onSuccess();
        router.refresh();
      } else {
        const errorMsg = 'error' in res ? res.error : "Failed to discharge patient.";
        toast.error(errorMsg);
      }
    });
  };

  return (
    <Card className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm text-start">
      <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <LogOut className="h-4 w-4" />
        {t("dischargePatient")}
      </h4>

      <div className="space-y-4">
        {/* Select Discharge Condition */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-foreground/90">{t("dischargeCondition")}</label>
          <select 
            value={dischargeCondition} 
            onChange={(e) => setDischargeCondition(e.target.value as any)}
            className="hms-select-native font-bold"
          >
            <option value="stable">{t("conditionStable")}</option>
            <option value="improved">{t("conditionImproved")}</option>
            <option value="referred">{t("conditionReferred")}</option>
            <option value="deceased">{t("conditionDeceased")}</option>
          </select>
        </div>

        {/* Follow-up Instructions */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-foreground/90">{t("followUpInstructions")}</label>
          <Textarea
            placeholder={isRtl ? "اكتب الخطة العلاجية للمنزل..." : "Enter home medication plans..."}
            value={followUpInstructions}
            onChange={(e) => setFollowUpInstructions(e.target.value)}
            className="rounded-xl border-border/60 bg-background text-foreground shadow-sm min-h-16 text-xs text-start leading-relaxed"
          />
        </div>

        {/* Medical Summary Arabic */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-foreground/90 flex items-center gap-1">
            {t("summaryAr")}
            <Badge variant="secondary" className="bg-muted text-muted-foreground rounded text-[9px] px-1 py-0 border-none font-bold">MOH</Badge>
          </label>
          <Textarea
            placeholder="الملخص الطبي للحالة المرضية..."
            value={summaryAr}
            onChange={(e) => setSummaryAr(e.target.value)}
            className="rounded-xl border-border/60 bg-background text-foreground shadow-sm min-h-20 text-xs text-start leading-relaxed"
          />
        </div>

        {/* Medical Summary English */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-foreground/90">{t("summaryEn")}</label>
          <Textarea
            placeholder="Detailed medical summary of the case and clinical course..."
            value={summaryEn}
            onChange={(e) => setSummaryEn(e.target.value)}
            className="rounded-xl border-border/60 bg-background text-foreground shadow-sm min-h-20 text-xs text-start leading-relaxed"
          />
        </div>

        <Button 
          onClick={handleDischarge}
          disabled={isPending}
          className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs h-11 shadow-lg shadow-red-600/10"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : t("confirmDischarge")}
        </Button>
      </div>
    </Card>
  );
}
