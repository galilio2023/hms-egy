"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, 
  User, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle,
  FileText,
  CreditCard,
  UserCheck,
  CalendarCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { searchPatientsAction } from "@/lib/actions/patients";
import { createAppointment, addToWaitingList, getDoctorAvailability } from "@/lib/actions/appointments";

interface BookingWizardClientProps {
  departments: { id: string; nameAr: string; nameEn: string }[];
  doctors: { id: string; nameAr: string; nameEn: string }[];
  hospitalSlug: string;
  locale: string;
}

export function BookingWizardClient({
  departments,
  doctors,
  hospitalSlug,
  locale,
}: BookingWizardClientProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard state: 1 = Patient Match, 2 = Clinic & Doctor, 3 = Date & Slot, 4 = Bill & Confirm
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Patient matching states
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Step 2: Clinic & Doctor selections
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [visitType, setVisitType] = useState<"checkup" | "follow_up" | "procedure" | "telemedicine">("checkup");
  const [notes, setNotes] = useState("");

  // Step 3: Date & Slot picking states
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isWeekendWarning, setIsWeekendWarning] = useState(false);
  const [queueToWaitingList, setQueueToWaitingList] = useState(false);

  // Trigger patient lookup
  useEffect(() => {
    if (patientSearch.trim().length >= 2) {
      startTransition(async () => {
        const res = await searchPatientsAction(patientSearch);
        if (res.success && "data" in res) {
          setPatientSearchResults(res.data || []);
        }
      });
    } else {
      setPatientSearchResults([]);
    }
  }, [patientSearch]);

  // Trigger slot availability lookup when doctor or date changes
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      // 1. Cairo Timezone weekend check (Friday = 5, Saturday = 6)
      const day = new Date(selectedDate).getDay();
      const isWeekend = day === 5 || day === 6;
      setIsWeekendWarning(isWeekend);
      setQueueToWaitingList(false);

      setLoadingSlots(true);
      setSelectedSlot("");
      getDoctorAvailability(selectedDoctor, selectedDate).then((res) => {
        if (res.success && "slots" in res) {
          setAvailableSlots(res.slots);
          // If zero slots are available, auto-offer waiting list queueing
          const hasAnyAvailable = res.slots.some((s) => slotAvailableWithWeekendRule(s, isWeekend));
          if (!hasAnyAvailable) {
            setQueueToWaitingList(true);
          }
        } else {
          setAvailableSlots([]);
          setQueueToWaitingList(true);
        }
        setLoadingSlots(false);
      });
    } else {
      setAvailableSlots([]);
    }
  }, [selectedDoctor, selectedDate]);

  // Helper to filter slots based on Cairo weekend rules
  const slotAvailableWithWeekendRule = (slot: { time: string; available: boolean }, isWeekend: boolean) => {
    if (isWeekend) return false; // Hard weekend safeguards in clinical schema
    return slot.available;
  };

  // Co-pay financial estimator in EGP
  const getCopayEstimate = () => {
    let fee = 400; // Base consult checkup fee
    let fileFee = 100; // Digital clinical file creation fee

    if (visitType === "follow_up") {
      fee = 150; // Follow-ups are discounted
    } else if (visitType === "procedure") {
      fee = 950; // Surgical/Clinical Procedures are higher
    } else if (visitType === "telemedicine") {
      fee = 300; // Remote consult
    }

    const total = fee + fileFee;
    
    // Convert to Arabic words for Egyptian tax/invoice audit compliance
    let textAr = "";
    if (total === 500) textAr = "خمسمائة جنيه مصري فقط لا غير";
    else if (total === 250) textAr = "مائتان وخمسون جنيهاً مصرياً فقط لا غير";
    else if (total === 1050) textAr = "ألف وخمسون جنيهاً مصرياً فقط لا غير";
    else if (total === 400) textAr = "أربعمائة جنيه مصري فقط لا غير";
    else textAr = `${total} جنيهاً مصرياً فقط لا غير`;

    return { fee, fileFee, total, textAr };
  };

  const estimate = getCopayEstimate();

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 1 && !selectedPatient) return;
    if (currentStep === 2 && (!selectedDept || !selectedDoctor)) return;
    if (currentStep === 3 && !selectedSlot && !queueToWaitingList) return;
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Create booking submit
  const handleSubmit = () => {
    if (!selectedPatient || !selectedDept || !selectedDoctor) return;

    if (queueToWaitingList) {
      // Add to Waiting List Queue
      startTransition(async () => {
        const res = await addToWaitingList({
          patientId: selectedPatient.id,
          departmentId: selectedDept,
          preferredDoctorId: selectedDoctor,
          priority: "routine",
          notes: notes || "تمت الإضافة من خلال معالج الحجز الذكي لعدم توفر فترات حرة.",
        });

        if (res.success) {
          router.push(`/${hospitalSlug}/appointments`);
          router.refresh();
        } else {
          const errorMsg = res && "error" in res ? res.error : "فشلت عملية الإضافة لقائمة الانتظار.";
          alert(errorMsg);
        }
      });
    } else {
      // Schedule Appointment Slot
      const scheduledAt = new Date(selectedDate);
      const [h, m] = selectedSlot.split(":").map(Number);
      scheduledAt.setHours(h, m, 0, 0);

      const data = {
        patientId: selectedPatient.id,
        doctorId: selectedDoctor,
        departmentId: selectedDept,
        scheduledAt,
        type: visitType === "checkup" ? ("consultation" as const) : visitType,
        notes,
      };

      startTransition(async () => {
        const res = await createAppointment(data);
        if (res.success) {
          router.push(`/${hospitalSlug}/appointments`);
          router.refresh();
        } else {
          const errorMsg = res && "error" in res ? res.error : "فشل تسجيل الموعد. يرجى إعادة المحاولة.";
          alert(errorMsg);
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Step-by-Step Progress Indicators */}
      <div className="grid grid-cols-4 gap-2 border-b border-border/20 pb-4">
        {[
          { step: 1, name: isRtl ? "تحديد المريض" : "Patient Info", icon: User },
          { step: 2, name: isRtl ? "العيادة والطبيب" : "Clinic & Doctor", icon: UserCheck },
          { step: 3, name: isRtl ? "الوقت والجدولة" : "Date & Slot", icon: CalendarIcon },
          { step: 4, name: isRtl ? "الفاتورة والتأكيد" : "Co-Pay & Confirm", icon: CreditCard },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.step} 
              className={cn(
                "flex flex-col items-center sm:items-start p-2 border-t-2 text-start gap-1 transition-all",
                currentStep >= item.step 
                  ? "border-accent text-accent" 
                  : "border-border/30 text-muted-foreground/60"
              )}
            >
              <span className="text-[10px] font-black uppercase tracking-wider">
                {isRtl ? `الخطوة ${item.step}` : `Step ${item.step}`}
              </span>
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-black text-foreground">
                <Icon className="h-3.5 w-3.5" />
                {item.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* STEP 1: PATIENT SELECTION */}
      {currentStep === 1 && (
        <Card className="border border-border/40 shadow-xs">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-1.5">
              <User className="h-5 w-5 text-accent" />
              {isRtl ? "البحث عن مريض مسجل وتحديده" : "Identify Patient Profile"}
            </h2>
            <p className="text-xs text-muted-foreground leading-normal">
              {isRtl 
                ? "ابحث عن المريض المسجل في نظام المنشأة باستخدام الاسم، الهاتف، أو رقم الملف الطبي لتأكيد بياناته قبل التسكين."
                : "Type patient name, mobile, or hospital file number to load clinical demographics."}
            </p>

            <div className="relative">
              <Search className="absolute top-[13px] start-3.5 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder={isRtl ? "ابحث بالاسم، هاتف المريض، رقم الملف..." : "Search by name, phone, file #..."}
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="ps-10 h-11 text-xs"
              />
            </div>

            {/* Results Lookup list */}
            {patientSearchResults.length > 0 && (
              <div className="border border-border/30 rounded-xl overflow-hidden bg-muted/5 max-h-[250px] overflow-y-auto">
                {patientSearchResults.map((pat) => (
                  <button
                    key={pat.id}
                    onClick={() => {
                      setSelectedPatient(pat);
                      setPatientSearch("");
                      setPatientSearchResults([]);
                    }}
                    className={cn(
                      "w-full p-3 border-b border-border/20 flex justify-between items-center text-start transition-all hover:bg-muted/40",
                      selectedPatient?.id === pat.id && "bg-accent/5 hover:bg-accent/10 border-s-4 border-s-accent"
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black text-xs text-foreground">
                        {isRtl ? pat.nameAr : pat.nameEn}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {isRtl ? pat.nameEn : pat.nameAr}
                      </span>
                    </div>
                    <div className="text-end flex flex-col gap-0.5">
                      <Badge variant="outline" className="font-mono text-[9px] font-bold text-accent border-accent/20">
                        #{pat.patientNumber}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{pat.contactPhone}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Patient demographic card */}
            {selectedPatient && (
              <div className="p-4 bg-accent/2 border border-accent/20 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-accent font-black tracking-wide block uppercase">
                    {isRtl ? "الملف النشط حالياً" : "Selected Clinical Profile"}
                  </span>
                  <div className="font-black text-sm text-foreground">
                    {isRtl ? selectedPatient.nameAr : selectedPatient.nameEn}
                  </div>
                  <div className="text-muted-foreground font-mono">
                    {isRtl ? selectedPatient.nameEn : selectedPatient.nameAr}
                  </div>
                </div>

                <div className="text-start sm:text-end space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  <div><span className="font-bold text-foreground/80">{isRtl ? "رقم الملف: " : "File: "}</span>#{selectedPatient.patientNumber}</div>
                  <div><span className="font-bold text-foreground/80">{isRtl ? "الهاتف: " : "Phone: "}</span>{selectedPatient.contactPhone}</div>
                  <div><span className="font-bold text-foreground/80">{isRtl ? "القومي: " : "National ID: "}</span>{selectedPatient.nationalId || "N/A"}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: CLINIC & DOCTOR SELECTION */}
      {currentStep === 2 && (
        <Card className="border border-border/40 shadow-xs">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-1.5">
              <UserCheck className="h-5 w-5 text-accent" />
              {isRtl ? "اختيار العيادة الطبية والطبيب المعالج" : "Select Clinic & Medical Specialist"}
            </h2>

            {/* Department */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">{t("department")}</label>
              <Select
                value={selectedDept}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDept(val);
                  setSelectedDoctor(""); // Reset doctor on clinic shift
                }}
                className="w-full h-10 text-xs"
              >
                <option value="">{isRtl ? "اختر العيادة التخصصية..." : "Choose clinic..."}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {isRtl ? dept.nameAr : dept.nameEn}
                  </option>
                ))}
              </Select>
            </div>

            {/* Doctor */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">{t("doctor")}</label>
              <Select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="w-full h-10 text-xs"
                disabled={!selectedDept}
              >
                <option value="">{isRtl ? "اختر الطبيب المتوفر..." : "Choose doctor..."}</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {isRtl ? doc.nameAr : doc.nameEn}
                  </option>
                ))}
              </Select>
            </div>

            {/* Visit Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">{t("type")}</label>
              <Select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as any)}
                className="w-full h-10 text-xs"
              >
                <option value="checkup">{t("checkup")}</option>
                <option value="follow_up">{t("follow_up")}</option>
                <option value="procedure">{t("procedure")}</option>
                <option value="telemedicine">{t("telemedicine")}</option>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">{t("notes")}</label>
              <Input
                placeholder={isRtl ? "اكتب أي ملاحظات أو شكوى سريرية..." : "Enter clinical symptoms, notes..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 text-xs"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: DATE & TIME SLOT PICKING */}
      {currentStep === 3 && (
        <Card className="border border-border/40 shadow-xs">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-1.5">
              <CalendarIcon className="h-5 w-5 text-accent" />
              {isRtl ? "تحديد موعد ويوم الكشف الطبي" : "Select Appointment Slot"}
            </h2>

            {/* Date input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">{t("scheduledDate")}</label>
              <Input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            {/* Cairo Timezone Weekend safeguards */}
            {isWeekendWarning && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-xl text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block mb-0.5">{isRtl ? "تنبيه: عطلة المستشفى" : "Weekend Safeguard Active"}</span>
                  {isRtl 
                    ? "اليوم المختار يصادف عطلة نهاية الأسبوع الرسمية (الجمعة أو السبت). الكشف قد يتطلب تصريحاً عاجلاً." 
                    : "The selected date falls on the official hospital weekend (Friday or Saturday) in Egypt."}
                </div>
              </div>
            )}

            {/* Slot list buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground block">
                {queueToWaitingList 
                  ? (isRtl ? "طابور الانتظار لعدم توفر فترات" : "Queue to Waiting List Option")
                  : (isRtl ? "فترات الطبيب المتاحة (٣٠ دقيقة)" : "Available Clinic Slots (30 mins)")}
              </label>

              {loadingSlots ? (
                <div className="text-xs text-muted-foreground italic">{isRtl ? "جاري احتساب كتل المواعيد المتاحة..." : "Computing free clinical slots..."}</div>
              ) : queueToWaitingList ? (
                <div className="p-4 bg-amber-500/5 border border-amber-500/15 text-xs text-amber-800 rounded-xl space-y-3">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <span className="font-black block mb-0.5">
                        {isRtl ? "عذراً! العيادة مكتملة الحجز" : "Clinics Fully Booked"}
                      </span>
                      {isRtl 
                        ? "لا تتوفر فترات حرة متبقية لهذا الطبيب في هذا اليوم. يمكنك تحويل ملف المريض لجدول طابور الانتظار لتسكينه عاجلاً عند توفر إلغاء."
                        : "All 30-minute intervals for this doctor are fully booked. Check the box to add them to the Waiting List."}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-amber-500/10">
                    <input
                      type="checkbox"
                      id="waitingCheck"
                      checked={queueToWaitingList}
                      onChange={(e) => setQueueToWaitingList(e.target.checked)}
                      className="h-4 w-4 accent-amber-600 rounded-sm"
                    />
                    <label htmlFor="waitingCheck" className="font-black text-[11px] cursor-pointer text-amber-900 select-none">
                      {isRtl ? "أوافق على تحويل الحجز لطابور الانتظار النشط" : "Queue to Hospital's Waiting List"}
                    </label>
                  </div>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-xs text-rose-600 font-bold bg-rose-50 p-3 rounded-lg border border-rose-100">
                  {selectedDoctor && selectedDate 
                    ? (isRtl ? "عذراً! لا توجد كتل زمنية شاغرة في هذا اليوم المختار." : "No slots available on this day.") 
                    : (isRtl ? "يرجى اختيار الطبيب واليوم لعرض الفترات." : "Please select doctor and date first.")}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 border border-border/20 p-2.5 rounded-xl bg-muted/10 max-h-[160px] overflow-y-auto">
                  {availableSlots.map((slot) => {
                    const isAvailable = slotAvailableWithWeekendRule(slot, isWeekendWarning);
                    return (
                      <Button
                        key={slot.time}
                        variant={selectedSlot === slot.time ? "default" : "outline"}
                        size="xs"
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={cn(
                          "text-[10px] font-mono font-bold",
                          isAvailable 
                            ? (selectedSlot === slot.time ? "bg-accent text-accent-foreground" : "border-emerald-500/20 hover:bg-emerald-50 text-emerald-700") 
                            : "bg-gray-100/50 text-gray-400 border-none"
                        )}
                      >
                        {slot.time}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: CO-PAY INVOICE & CONFIRMATION */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <Card className="border border-border/40 shadow-xs">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-base font-black text-foreground flex items-center gap-1.5 border-b border-border/20 pb-3">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                {isRtl ? "مراجعة وتأكيد بيانات حجز الزيارة" : "Review & Validate Booking Details"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">{t("patient")}</span>
                  <span className="font-black text-foreground text-sm">
                    {isRtl ? selectedPatient.nameAr : selectedPatient.nameEn}
                  </span>
                  <span className="text-[10px] text-accent font-mono block font-bold mt-0.5">#{selectedPatient.patientNumber}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">{t("doctor")}</span>
                  <span className="font-black text-foreground text-sm">
                    د. {isRtl ? doctors.find((d) => d.id === selectedDoctor)?.nameAr : doctors.find((d) => d.id === selectedDoctor)?.nameEn}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-black block mt-0.5">
                    {isRtl ? departments.find((d) => d.id === selectedDept)?.nameAr : departments.find((d) => d.id === selectedDept)?.nameEn}
                  </span>
                </div>

                <div className="pt-2 border-t border-border/10">
                  <span className="text-muted-foreground block mb-0.5">{t("scheduledDate")}</span>
                  <span className="font-black text-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {new Date(selectedDate).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>

                <div className="pt-2 border-t border-border/10">
                  <span className="text-muted-foreground block mb-0.5">{isRtl ? "الوقت المحدد" : "Scheduled Slot"}</span>
                  <span className="font-black text-foreground flex items-center gap-1 font-mono">
                    <Clock className="h-3.5 w-3.5" />
                    {queueToWaitingList ? (isRtl ? "طابور الانتظار ⏳" : "Waiting List Queue ⏳") : selectedSlot}
                  </span>
                </div>
              </div>

              {notes && (
                <div className="p-3 bg-muted/40 rounded-xl border border-border/10 text-xs">
                  <span className="text-muted-foreground block mb-1">{t("notes")}</span>
                  <p className="font-semibold text-foreground/85 italic">"{notes}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Premium Co-Pay Invoice Estimation Card */}
          <Card className="border border-accent/20 bg-accent/2 relative overflow-hidden shadow-xs">
            {/* Background design accents */}
            <div className="absolute top-0 end-0 h-24 w-24 bg-accent/5 rounded-full translate-x-8 -translate-y-8" />
            
            <CardContent className="p-6 space-y-4">
              <h3 className="text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1.5 border-b border-accent/10 pb-3">
                <FileText className="h-4 w-4" />
                {isRtl ? "تقدير المطالبة والفوترة المالية المصاحبة" : "Co-Pay Hospital Billing Claim"}
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{isRtl ? "رسوم الكشف بالعيادة الخارجية" : "Clinic Consultation Base Fee"}</span>
                  <span className="font-mono font-bold text-foreground">{estimate.fee}.00 EGP</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{isRtl ? "رسوم معالجة الملف الرقمي والتأمين" : "Digital Record & Claim Process"}</span>
                  <span className="font-mono font-bold text-foreground">{estimate.fileFee}.00 EGP</span>
                </div>

                <div className="flex justify-between items-center text-sm font-black text-foreground border-t border-accent/10 pt-3 mt-3">
                  <span>{isRtl ? "إجمالي المبلغ المطلوب دفعه" : "Grand Total (Payable)"}</span>
                  <span className="font-mono text-accent text-base font-black">{estimate.total}.00 {isRtl ? "ج.م" : "EGP"}</span>
                </div>
              </div>

              <div className="p-3 bg-card border border-accent/15 rounded-xl text-[10px] text-accent font-black text-center shadow-2xs leading-relaxed">
                {isRtl ? `مكتوب فقط: ${estimate.textAr}` : `In Words: Five Hundred Egyptian Pounds Only`}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stepper Buttons Control panel */}
      <div className="flex justify-between items-center pt-4 border-t border-border/20">
        <Button
          variant="outline"
          size="sm"
          onClick={currentStep === 1 ? () => router.push(`/${hospitalSlug}/appointments`) : handleBack}
          className="text-xs font-bold gap-1 px-4 h-10"
        >
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          <span>{currentStep === 1 ? (isRtl ? "إلغاء والعودة" : "Cancel") : (isRtl ? "السابق" : "Back")}</span>
        </Button>

        {currentStep < 4 ? (
          <Button
            size="sm"
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !selectedPatient) ||
              (currentStep === 2 && (!selectedDept || !selectedDoctor)) ||
              (currentStep === 3 && !selectedSlot && !queueToWaitingList)
            }
            className="text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90 gap-1 px-4 h-10"
          >
            <span>{isRtl ? "الخطوة التالية" : "Next"}</span>
            {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-5 h-10"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {queueToWaitingList 
                ? (isRtl ? "تأكيد الإدراج في طابور الانتظار" : "Confirm Queue to Waiting List")
                : (isRtl ? "تأكيد الدفع وحفظ الموعد" : "Confirm Payment & Book Slot")}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
