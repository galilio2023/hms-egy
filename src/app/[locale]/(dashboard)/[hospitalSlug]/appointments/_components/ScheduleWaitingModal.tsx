"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { 
  CalendarIcon, 
  Loader2 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toZonedTime } from "date-fns-tz";
import { 
  getDoctorAvailability, 
  scheduleFromWaitingList 
} from "@/lib/actions/appointments";

interface Doctor {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface ScheduleWaitingModalProps {
  doctors: Doctor[];
  locale: string;
}

export function ScheduleWaitingModal({
  doctors,
  locale,
}: ScheduleWaitingModalProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const waitingEntryId = searchParams.get("scheduleWaitingId");
  const initialDoctorId = searchParams.get("scheduleDoctorId") || "";
  const isOpen = !!waitingEntryId;

  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleDoctorId, setScheduleDoctorId] = useState<string>(initialDoctorId);
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (initialDoctorId) setScheduleDoctorId(initialDoctorId);
  }, [initialDoctorId]);

  useEffect(() => {
    let isMounted = true;
    if (scheduleDoctorId && scheduleDate) {
      setLoadingSlots(true);
      setSelectedSlot("");

      getDoctorAvailability(scheduleDoctorId, scheduleDate).then((res) => {
        if (isMounted) {
          if (res.success && "slots" in res) {
            setAvailableSlots(res.slots);
          } else {
            setAvailableSlots([]);
          }
          setLoadingSlots(false);
        }
      });
    } else {
      setAvailableSlots([]);
    }
    return () => {
      isMounted = false;
    };
  }, [scheduleDoctorId, scheduleDate]);

  const closeModal = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("scheduleWaitingId");
    params.delete("scheduleDoctorId");
    router.push(`${pathname}?${params.toString()}`);
    
    // Reset form
    setScheduleDate("");
    setScheduleDoctorId("");
    setSelectedSlot("");
  };

  const handleSchedule = () => {
    if (!waitingEntryId || !scheduleDoctorId || !scheduleDate || !selectedSlot) return;

    const [h, m] = selectedSlot.split(":").map(Number);
    const [year, month, dayNum] = scheduleDate.split("-").map(Number);
    const scheduledDateObj = new Date(year, month - 1, dayNum, h, m, 0, 0);

    startTransition(async () => {
      const res = await scheduleFromWaitingList(waitingEntryId, {
        patientId: "RESOVED_ON_SERVER", // Action handles this
        doctorId: scheduleDoctorId,
        departmentId: "RESOLVED_ON_SERVER", // Action handles this
        scheduledAt: scheduledDateObj,
        type: "consultation",
      });

      if (res.success) {
        toast.success(t("scheduleSuccess"));
        closeModal();
        router.refresh();
      } else {
        const errorMsg = 'error' in res ? res.error : "Failed to schedule appointment.";
        toast.error(errorMsg);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-md text-start" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader className="text-start">
          <DialogTitle className="text-lg font-black text-foreground">
            {isRtl ? "تسكين موعد من قائمة الانتظار" : "Schedule Waiting List Entry"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-foreground block">{t("doctor")}</label>
            <select
              dir={isRtl ? "rtl" : "ltr"}
              className="hms-select-native"
              value={scheduleDoctorId}
              onChange={(e) => setScheduleDoctorId(e.target.value)}
            >
              <option value="">{isRtl ? "اختر طبيباً عيادياً..." : "Select doctor..."}</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {isRtl ? doc.nameAr : doc.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-foreground block">{t("scheduledDate")}</label>
            <Input
              type="date"
              value={scheduleDate}
              min={(() => {
                const tzDate = toZonedTime(new Date(), "Africa/Cairo");
                const yyyy = tzDate.getFullYear();
                const mm = String(tzDate.getMonth() + 1).padStart(2, "0");
                const dd = String(tzDate.getDate()).padStart(2, "0");
                return `${yyyy}-${mm}-${dd}`;
              })()}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full text-xs"
            />
          </div>

          <div className="space-y-2">
            <label className="font-bold text-foreground block">
              {isRtl ? "الفترات الزمنية المتاحة (٣٠ دقيقة)" : "Available Time Slots (30 mins)"}
            </label>

            {loadingSlots ? (
              <div className="text-[10px] text-muted-foreground italic">{isRtl ? "جاري احتساب فترات الأطباء المتاحة..." : "Loading clinic slots..."}</div>
            ) : availableSlots.length === 0 ? (
              <div className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {scheduleDoctorId && scheduleDate
                  ? (isRtl ? "عذراً! لا توجد كتل زمنية شاغرة في هذا اليوم." : "No slots available on this day.")
                  : (isRtl ? "يرجى اختيار الطبيب وتاريخ اليوم أولاً." : "Please select doctor and date first.")}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-[140px] overflow-y-auto p-1 border border-border/20 rounded-lg bg-muted/10">
                {availableSlots.map((slot) => (
                  <Button
                    key={slot.time}
                    variant={selectedSlot === slot.time ? "default" : "outline"}
                    size="xs"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.time)}
                    className={cn(
                      "text-[10px] font-mono font-bold",
                      slot.available 
                        ? (selectedSlot === slot.time ? "bg-accent text-accent-foreground" : "border-emerald-500/20 hover:bg-emerald-50 text-emerald-700") 
                        : "bg-gray-100/50 text-gray-400 border-none"
                    )}
                  >
                    {slot.time}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={closeModal} className="text-xs font-bold">{isRtl ? "إلغاء الحجز" : "Cancel"}</Button>
          <Button
            size="sm"
            onClick={handleSchedule}
            className="text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={isPending || !scheduleDoctorId || !scheduleDate || !selectedSlot}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : (isRtl ? "جدولة وحفظ الموعد" : "Schedule Appointment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
