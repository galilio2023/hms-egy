"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { 
  User, 
  Video, 
  Clock, 
  Calendar as CalendarIcon 
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  updateAppointmentStatus, 
  type AppointmentStatus 
} from "@/lib/actions/appointments";

interface Appointment {
  id: string;
  patientId: string;
  patientNameAr?: string;
  patientNameEn?: string;
  patientNumber?: string;
  doctorNameAr?: string;
  doctorNameEn?: string;
  departmentNameAr?: string;
  departmentNameEn?: string;
  scheduledDate: string | Date;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  notes?: string | null;
}

interface AppointmentDetailsDrawerProps {
  appointment: Appointment | null;
  hospitalSlug: string;
  locale: string;
}

export function AppointmentDetailsDrawer({
  appointment,
  hospitalSlug,
  locale,
}: AppointmentDetailsDrawerProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [cancelReason, setCancelReason] = useState("");

  const isOpen = !!appointment;

  const closeDrawer = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("selectedAppId");
    router.push(`${pathname}?${params.toString()}`);
    setCancelReason("");
  };

  const handleStatusChange = (status: AppointmentStatus) => {
    if (!appointment) return;
    
    if (status === "cancelled" && !cancelReason.trim()) {
      toast.error(isRtl ? "يرجى كتابة سبب الإلغاء" : "Please provide a reason for cancellation.");
      return;
    }

    startTransition(async () => {
      const res = await updateAppointmentStatus(
        appointment.id, 
        status, 
        status === "cancelled" ? cancelReason : undefined
      );
      
      if (res.success) {
        toast.success(t("statusUpdateSuccess"));
        closeDrawer();
        router.refresh();
      } else {
        const errorMsg = 'error' in res ? res.error : "Failed to update status.";
        toast.error(errorMsg);
      }
    });
  };

  if (!appointment) return null;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-none font-bold py-0.5">{isRtl ? "مؤكد" : "Scheduled"}</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-none font-bold py-0.5">{isRtl ? "مكتمل" : "Completed"}</Badge>;
      case "cancelled":
        return <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-none font-bold py-0.5">{isRtl ? "ملغي" : "Cancelled"}</Badge>;
      case "no_show":
        return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-none font-bold py-0.5">{isRtl ? "غائب" : "No Show"}</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-600 border border-gray-500/20 shadow-none font-bold py-0.5">{status}</Badge>;
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <DrawerContent className="text-start">
        <div className="mx-auto w-full max-w-lg p-6">
          <DrawerHeader className="border-b border-border/30 pb-4 text-start" onClose={closeDrawer}>
            <div className="flex justify-between items-center gap-4 w-full">
              <DrawerTitle className="text-lg font-black text-foreground">
                {isRtl ? appointment.patientNameAr : appointment.patientNameEn}
              </DrawerTitle>
              {renderStatusBadge(appointment.status)}
            </div>
            <DrawerDescription className="text-xs font-bold text-muted-foreground mt-1 uppercase">
              #{appointment.patientNumber}
            </DrawerDescription>
          </DrawerHeader>

          <div className="py-6 space-y-4">
            <div className="p-4 bg-muted/20 border border-border/20 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-bold">{isRtl ? "الطبيب المعالج" : "Doctor Specialist"}</span>
                  <span className="font-bold text-foreground">
                    {isRtl ? appointment.doctorNameAr : appointment.doctorNameEn}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-bold">{isRtl ? "القسم / العيادة" : "Department"}</span>
                  <span className="font-semibold text-foreground">
                    {isRtl ? appointment.departmentNameAr : appointment.departmentNameEn}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/10">
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-bold">{isRtl ? "تاريخ الحجز" : "Scheduled Date"}</span>
                  <span className="font-mono font-bold text-foreground text-start" dir="ltr">
                    {new Date(appointment.scheduledDate).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-bold">{isRtl ? "الفترة الزمنية" : "Time Slot"}</span>
                  <span className="font-mono font-bold text-foreground text-start" dir="ltr">
                    {appointment.startTime.substring(0, 5)} - {appointment.endTime.substring(0, 5)}
                  </span>
                </div>
              </div>

              {appointment.notes && (
                <div className="pt-2 border-t border-border/10 text-muted-foreground">
                  <span className="text-[10px] block uppercase font-bold">{isRtl ? "شكوى المريض" : "Patient Complaint / Notes"}</span>
                  <span className="italic leading-relaxed">&quot;{appointment.notes}&quot;</span>
                </div>
              )}
            </div>

            {appointment.type === "telemedicine" && appointment.status === "scheduled" && (
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-3 text-xs relative overflow-hidden">
                <div className="absolute top-0 end-0 h-16 w-14 bg-accent/5 rounded-full translate-x-4 -translate-y-4 flex items-center justify-center">
                  <Video className="h-6 w-6 text-accent opacity-20" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-accent font-black tracking-wide block uppercase">
                    {isRtl ? "الاستشارة الافتراضية نشطة حالياً" : "Virtual Clinic Active Now"}
                  </span>
                  <h4 className="font-black text-foreground text-start">
                    {isRtl ? "بوابة الاستشارة الطبية عن بعد" : "Outpatient Telemedicine Hub"}
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-normal text-start">
                    {isRtl
                      ? "انضم للمكالمة مرئية آمنة مع المريض، وقم بتدوين سجل SOAP الطبي وإصدار الوصفات الدوائية."
                      : "Launch encrypted video consult room, consult patient vitals, and issue digital prescriptions."}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    closeDrawer();
                    router.push(`/${hospitalSlug}/appointments/${appointment.id}/telemedicine`);
                  }}
                  className="w-full text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 h-9"
                >
                  <Video className="h-4 w-4" />
                  <span>{isRtl ? "دخول عيادة الاتصال المرئي" : "Launch Telemedicine Room"}</span>
                </Button>
              </div>
            )}

            {appointment.status === "scheduled" && (
              <div className="space-y-4 pt-4 border-t border-border/30">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-foreground block text-start">
                    {isRtl ? "تعديل حالة الحجز" : "Update Appointment Status"}
                  </label>
                  <select
                    dir={isRtl ? "rtl" : "ltr"}
                    className="hms-select-native"
                    value={appointment.status}
                    onChange={(e) => handleStatusChange(e.target.value as AppointmentStatus)}
                    disabled={isPending}
                  >
                    <option value="scheduled">{isRtl ? "مؤكد" : "Scheduled"}</option>
                    <option value="completed">{isRtl ? "مكتمل" : "Completed"}</option>
                    <option value="no_show">{isRtl ? "غائب" : "No Show"}</option>
                    <option value="cancelled">{isRtl ? "ملغي" : "Cancelled"}</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-[11px] font-black text-rose-700 block text-start">
                    {isRtl ? "إلغاء الحجز (يرجى كتابة السبب)" : "Cancel Appointment (Reason Required)"}
                  </label>
                  <Input
                    placeholder={isRtl ? "اكتب سبب إلغاء الحجز..." : "Reason for cancellation..."}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="h-9 text-xs border-rose-200 focus:border-rose-400 text-start"
                    disabled={isPending}
                  />
                </div>
              </div>
            )}
          </div>

          <DrawerFooter className="border-t border-border/30 pt-4 px-0">
            <Button variant="outline" className="w-full text-xs font-bold" onClick={closeDrawer}>{isRtl ? "إغلاق النافذة" : "Close"}</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
