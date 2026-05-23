"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startShift, endShift } from "@/lib/actions/nursing";
import { toast } from "sonner";
import { Clock, LogOut, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface ShiftManagementProps {
  hospitalId: string;
  hospitalSlug: string;
  departments: { id: string; nameAr: string; nameEn: string }[];
  activeShift: { id: string; startTime: Date; departmentId: string; departmentNameAr: string; departmentNameEn: string } | null;
  locale: string;
}

export function ShiftManagement({
  hospitalId,
  hospitalSlug,
  departments,
  activeShift,
  locale,
}: ShiftManagementProps) {
  const t = useTranslations("nursing");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const isRtl = locale === "ar";
  const dateLocale = locale === "ar" ? ar : enUS;

  async function handleStartShift() {
    if (!selectedDept) {
      toast.error(t("selectDepartment"));
      return;
    }

    setLoading(true);
    try {
      const result = await startShift({
        hospitalId,
        departmentId: selectedDept,
        hospitalSlug,
      });

      if (result.success) {
        toast.success(isRtl ? "تم بدء المناوبة" : "Shift started");
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error starting shift");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndShift() {
    if (!activeShift) return;

    setLoading(true);
    try {
      const result = await endShift({
        hospitalId,
        shiftId: activeShift.id,
        hospitalSlug,
      });

      if (result.success) {
        toast.success(isRtl ? "تم إنهاء المناوبة" : "Shift ended");
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error ending shift");
    } finally {
      setLoading(false);
    }
  }

  if (activeShift) {
    return (
      <Card className="border-teal-200 dark:border-teal-900 bg-teal-50/30 dark:bg-teal-900/10 rounded-2xl overflow-hidden border shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                {t("activeShift")}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {isRtl ? activeShift.departmentNameAr : activeShift.departmentNameEn}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-500">
                  {t("shiftStarted")} {format(activeShift.startTime, "p", { locale: dateLocale })}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={loading}
            onClick={handleEndShift}
            className="rounded-xl font-bold gap-2 bg-rose-500 hover:bg-rose-600 shadow-sm px-5"
          >
            <LogOut className="w-4 h-4" />
            {t("endShift")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-2xl overflow-hidden border shadow-sm">
      <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t("noActiveShift")}
            </p>
            <div className="mt-1 w-full md:w-64">
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-9 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-bold">
                  <SelectValue placeholder={t("selectDepartment")} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {isRtl ? dept.nameAr : dept.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          disabled={loading}
          onClick={handleStartShift}
          className="w-full md:w-auto rounded-xl font-bold gap-2 bg-teal-600 hover:bg-teal-700 shadow-md px-8"
        >
          <Clock className="w-4 h-4" />
          {t("startShift")}
        </Button>
      </CardContent>
    </Card>
  );
}
