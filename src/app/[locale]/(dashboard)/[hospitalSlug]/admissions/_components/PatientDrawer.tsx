"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { 
  LogOut, 
  User, 
  FileText,
  Activity,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { VitalsFlowsheet } from "./VitalsFlowsheet";
import { DischargeForm } from "./DischargeForm";
import { calculateMEWS } from "@/lib/clinical/mews";

interface BedData {
  bedId: string;
  bedNumber: string;
  roomNumber: string;
  roomType: string;
  admissionId: string | null;
  admissionDate: Date | null;
  reason: string | null;
  patientId: string | null;
  patientNameAr: string | null;
  patientNameEn: string | null;
  patientNumber: string | null;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
}

interface PatientDrawerProps {
  bed: BedData | null;
  vitalsHistory: any[];
  locale: string;
}

export function PatientDrawer({
  bed,
  vitalsHistory,
  locale,
}: PatientDrawerProps) {
  const t = useTranslations("admissions");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isOpen = !!bed;

  const closeDrawer = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("selectedBedId");
    router.push(`${pathname}?${params.toString()}`);
  };

  if (!bed) return null;

  // Memoize MEWS for current history
  const mewsHistory: Record<string, any> = {};
  vitalsHistory.forEach(v => {
    mewsHistory[v.id] = calculateMEWS({
      systolicBp: v.bloodPressureSystolic,
      heartRate: v.heartRate,
      respiratoryRate: v.respiratoryRate,
      temperature: v.temperature,
    });
  });

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleString(isRtl ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <DrawerContent className="h-[95vh] glass-card" dir={isRtl ? "rtl" : "ltr"}>
        <div className="mx-auto w-full max-w-7xl overflow-hidden flex flex-col h-full">
          <DrawerHeader className="border-b border-border/40 p-6 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-4 text-start">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <User className="h-6 w-6" />
              </div>
              <div>
                <DrawerTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                  {isRtl ? bed.patientNameAr : bed.patientNameEn}
                  <Badge variant="outline" className="rounded-lg font-bold text-[10px] uppercase border-border/60">
                    {bed.patientNumber}
                  </Badge>
                </DrawerTitle>
                <DrawerDescription className="text-xs font-bold text-muted-foreground flex items-center gap-2 mt-0.5 uppercase">
                  {isRtl ? `غرفة ${bed.roomNumber} · سرير ${bed.bedNumber}` : `Room ${bed.roomNumber} · Bed ${bed.bedNumber}`}
                  <span className="w-1 h-1 rounded-full bg-border" />
                  {bed.roomType}
                </DrawerDescription>
              </div>
            </div>
            <Button variant="ghost" onClick={closeDrawer} className="rounded-xl h-10 w-10 p-0">
              {isRtl ? <ChevronLeft /> : <ChevronRight />}
            </Button>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column (2/3 width) - Clinical Flowsheet */}
              <div className="lg:col-span-2">
                <VitalsFlowsheet 
                  patientId={bed.patientId!} 
                  history={vitalsHistory} 
                  mewsHistory={mewsHistory} 
                  locale={locale} 
                />
              </div>

              {/* Right Column (1/3 width) - Admission Info & Discharge */}
              <div className="space-y-6">
                <Card className="rounded-2xl border border-border/60 bg-muted/40 p-5 shadow-sm text-start">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    {isRtl ? "تفاصيل الإدخال" : "Admission Info"}
                  </h4>
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">{t("admissionDate")}</label>
                      <p className="font-bold text-foreground">{formatDate(bed.admissionDate)}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">{t("admittingDoctor")}</label>
                      <p className="font-bold text-foreground">{isRtl ? bed.doctorNameAr : bed.doctorNameEn}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">{t("admissionReason")}</label>
                      <p className="text-foreground bg-background p-3 rounded-lg border border-border/60 mt-1 shadow-sm leading-relaxed whitespace-pre-wrap font-medium italic">
                        "{bed.reason}"
                      </p>
                    </div>
                  </div>
                </Card>

                {bed.admissionId && (
                  <DischargeForm 
                    admissionId={bed.admissionId} 
                    bedId={bed.bedId} 
                    locale={locale} 
                    onSuccess={closeDrawer} 
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
