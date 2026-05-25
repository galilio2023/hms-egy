"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Save, 
  Loader2, 
  AlertCircle, 
  Info,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  FlaskConical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveLabResults } from "@/lib/actions/laboratory";
import { toast } from "sonner";
import { latinizeNumerals } from "@/lib/utils/egypt";

interface LabItem {
  id: string;
  status: string;
  resultValue: string | null;
  isCritical: boolean;
  notes: string | null;
  testId: string;
  testNameAr: string;
  testNameEn: string;
  loincCode: string | null;
  unit: string | null;
  normalRange: string | null;
}

interface LabResultEntryClientProps {
  locale: string;
  hospitalSlug: string;
  order: any;
  items: LabItem[];
}

export default function LabResultEntryClient({
  locale,
  hospitalSlug,
  order,
  items,
}: LabResultEntryClientProps) {
  const t = useTranslations("laboratory");
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formItems, setFormItems] = useState(
    items.map((item) => ({
      itemId: item.id,
      resultValue: item.resultValue || "",
      isCritical: item.isCritical,
      notes: item.notes || "",
    }))
  );

  const updateItem = (itemId: string, field: string, value: any) => {
    let finalValue = value;
    if (field === "resultValue" && typeof value === "string") {
      finalValue = latinizeNumerals(value);
    }
    
    setFormItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, [field]: finalValue } : item
      )
    );
  };

  const handleSave = () => {
    const incomplete = formItems.some((item) => !item.resultValue.trim());
    if (incomplete) {
      toast.error(isRtl ? "يرجى إدخال النتائج لجميع الفحوصات" : "Please enter results for all tests");
      return;
    }

    startTransition(async () => {
      const res = await saveLabResults({
        orderId: order.id,
        items: formItems,
      });

      if (res.success) {
        toast.success(isRtl ? "تم حفظ النتائج واعتمادها بنجاح" : "Results saved and finalized successfully");
        router.push(`/${locale}/${hospitalSlug}/laboratory`);
      } else {
        const errorMessage = "error" in res ? res.error : "Failed to save results";
        toast.error(errorMessage);
      }
    });
  };

  return (
    <div className="space-y-6 text-start" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── CLINICAL CONTEXT CARD ────────────────── */}
      <Card className="border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl overflow-hidden shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              {isRtl ? "الملاحظات الإكلينيكية للطبيب" : "Physician Clinical Context"}
            </h3>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 italic">
              {order.clinicalNotes || (isRtl ? "لا توجد ملاحظات إكلينيكية مسجلة." : "No specific clinical notes provided.")}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <div className="text-end">
              <span className="text-[10px] font-bold text-slate-400 block">{isRtl ? "الطبيب المعالج" : "Ordering Physician"}</span>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">{isRtl ? order.doctorNameAr : order.doctorNameEn}</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 text-xs">
              {(isRtl ? order.doctorNameAr : order.doctorNameEn).slice(0, 1)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── TEST ITEMS GRID ──────────────────────── */}
      <div className="space-y-4">
        {items.map((item, idx) => {
          const formItem = formItems.find((fi) => fi.itemId === item.id);
          if (!formItem) return null;

          return (
            <Card key={item.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-950">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  {/* Left Column: Test Info */}
                  <div className="lg:col-span-4 p-5 bg-slate-50/50 dark:bg-slate-900/30 border-b lg:border-b-0 lg:border-e border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-xs">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 dark:text-white text-sm truncate">
                          {isRtl ? item.testNameAr : item.testNameEn}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                          {t("loinc")}: {item.loincCode || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-400">{t("normalRange")}</span>
                        <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                          {item.normalRange || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-400">{t("unit")}</span>
                        <span className="text-indigo-600 dark:text-indigo-400">
                          {item.unit || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Entry Fields */}
                  <div className="lg:col-span-8 p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ps-1">{t("result")}</Label>
                        <div className="relative">
                          <Input
                            placeholder={isRtl ? "أدخل النتيجة..." : "Enter numeric or text result..."}
                            value={formItem.resultValue}
                            onChange={(e) => updateItem(item.id, "resultValue", e.target.value)}
                            className={cn(
                              "h-12 rounded-xl border-slate-200 dark:border-slate-800 font-black text-lg focus-visible:ring-teal-500",
                              formItem.isCritical && "border-rose-500 text-rose-600 focus-visible:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/20"
                            )}
                          />
                          {item.unit && (
                            <div className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                              {item.unit}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col justify-end pb-1">
                        <div className={cn(
                          "flex items-center gap-2 h-12 px-4 rounded-xl border transition-all select-none",
                          formItem.isCritical 
                            ? "border-rose-600 bg-rose-600 text-white shadow-lg shadow-rose-500/20" 
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 hover:border-rose-300 dark:hover:border-rose-900/50"
                        )}
                        >
                          <Checkbox 
                            id={`critical-${item.id}`} 
                            checked={formItem.isCritical} 
                            onCheckedChange={(val) => updateItem(item.id, "isCritical", !!val)}
                            className={cn("rounded border-slate-300", formItem.isCritical && "border-white data-[state=checked]:bg-white data-[state=checked]:text-rose-600")}
                          />
                          <Label 
                            htmlFor={`critical-${item.id}`}
                            className="font-black text-xs cursor-pointer flex items-center gap-2 flex-1 h-full"
                          >
                            <AlertCircle className="w-4 h-4" />
                            {t("critical")}
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ps-1">{t("notes")}</Label>
                      <Textarea 
                        placeholder={isRtl ? "ملاحظات مخبرية إضافية لهذا الفحص..." : "Specific lab observations for this test..."}
                        value={formItem.notes}
                        onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                        className="min-h-[44px] rounded-xl border-slate-200 dark:border-slate-800 text-sm py-2"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── ACTION FOOTER ───────────────────────── */}
      <div className="pt-6 flex flex-col md:flex-row gap-4 items-center justify-between border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 text-slate-500">
          <Info className="w-5 h-5 text-indigo-500" />
          <p className="text-xs font-medium max-w-sm">
            {isRtl 
              ? "بتأكيد النتائج، سيتم إخطار الطبيب المعالج فوراً في حال وجود قيم حرجة، وسيتمكن المريض من رؤية النتائج عبر البوابة." 
              : "By finalizing, the ordering physician will be notified of any critical values, and results will be available in the patient portal."}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
            variant="ghost" 
            className="rounded-xl h-12 px-6 font-bold"
            onClick={() => router.back()}
          >
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button 
            className="flex-1 md:flex-initial h-12 px-10 rounded-xl font-black text-lg bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20 transition-all duration-300"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="me-2 h-5 w-5" />}
            {t("saveResults")}
          </Button>
        </div>
      </div>
    </div>
  );
}
