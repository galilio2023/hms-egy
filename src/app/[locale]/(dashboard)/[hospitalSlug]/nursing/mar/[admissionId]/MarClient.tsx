"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { 
  Pill, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  History,
  MoreVertical,
  Calendar,
  Thermometer,
  Activity,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, addDays, subDays, startOfDay, endOfDay, isSameDay, eachHourOfInterval, setHours, setMinutes } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { recordMedicationAdministration } from "@/lib/actions/nursing";

interface Admission {
  id: string;
  admissionDate: Date;
  reason: string | null;
  patientId: string;
  patientNameAr: string;
  patientNameEn: string;
  patientNumber: string;
  bedNumber: string | null;
  roomNumber: string | null;
}

interface PrescriptionItem {
  id: string;
  medicationId: string;
  medicationNameAr: string;
  medicationNameEn: string;
  strength: string;
  form: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string | null;
  status: string;
  createdAt: Date;
}

interface MedicationAdministration {
  id: string;
  prescriptionItemId: string;
  scheduledAt: Date;
  administeredAt: Date | null;
  status: string;
  doseGiven: string | null;
  administeredBy: string | null;
}

interface MarClientProps {
  locale: string;
  hospitalSlug: string;
  admission: Admission;
  prescriptions: PrescriptionItem[];
  administrations: MedicationAdministration[];
}

export function MarClient({
  locale,
  hospitalSlug,
  admission,
  prescriptions,
  administrations,
}: MarClientProps) {
  const t = useTranslations("nursing");
  const isRtl = locale === "ar";
  const dateLocale = isRtl ? ar : enUS;
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Administration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<PrescriptionItem | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [adminStatus, setAdminStatus] = useState<"given" | "refused" | "held">("given");
  const [adminNotes, setAdminNotes] = useState("");
  const [isPending, startTransition] = React.useTransition();

  const handleSaveAdmin = () => {
    if (!selectedMed || !selectedTime) return;

    startTransition(async () => {
      const result = await recordMedicationAdministration({
        hospitalId: admission.id, // hospitalId is needed, but admission has it from server query
        patientId: admission.patientId,
        prescriptionItemId: selectedMed.id,
        scheduledAt: selectedTime,
        status: adminStatus,
        notes: adminNotes,
        hospitalSlug,
      });

      if (result.success) {
        toast.success(isRtl ? "تم تسجيل العملية بنجاح" : "Administration recorded successfully");
        setIsModalOpen(false);
        setAdminNotes("");
      } else {
        toast.error("error" in result ? String(result.error) : "Failed to record administration");
      }
    });
  };

  // Helper: Parse frequency to hour offsets (very basic implementation for HMS Egypt demo)
  const getFrequncyHours = (freq: string): number[] => {
    const f = freq.toLowerCase();
    if (f.includes("once") || f.includes("od")) return [10]; // 10 AM
    if (f.includes("twice") || f.includes("bid") || f.includes("bd")) return [10, 22]; // 10 AM, 10 PM
    if (f.includes("three") || f.includes("tid") || f.includes("tds")) return [6, 14, 22]; // 6 AM, 2 PM, 10 PM
    if (f.includes("four") || f.includes("qid")) return [6, 12, 18, 0]; // 6 AM, 12 PM, 6 PM, 12 AM
    if (f.includes("every 8")) return [6, 14, 22];
    if (f.includes("every 12")) return [10, 22];
    return [10]; // Default
  };

  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  const filteredPrescriptions = useMemo(() => {
    if (!searchQuery.trim()) return prescriptions;
    const q = searchQuery.toLowerCase();
    return prescriptions.filter(p => 
      p.medicationNameAr.toLowerCase().includes(q) || 
      p.medicationNameEn.toLowerCase().includes(q)
    );
  }, [prescriptions, searchQuery]);

  const getAdminForSlot = (prescriptionItemId: string, date: Date, hour: number) => {
    const slotTime = setMinutes(setHours(startOfDay(date), hour), 0);
    return administrations.find(a => 
      a.prescriptionItemId === prescriptionItemId && 
      isSameDay(new Date(a.scheduledAt), date) &&
      new Date(a.scheduledAt).getHours() === hour
    );
  };

  const handleRecordAdmin = (med: PrescriptionItem, hour: number) => {
    const targetTime = setMinutes(setHours(startOfDay(selectedDate), hour), 0);
    setSelectedMed(med);
    setSelectedTime(targetTime);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── HEADER & PATIENT INFO ────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1">
            <Pill className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">{t("marTitle") || "Medication Administration Record (MAR)"}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            {isRtl ? admission.patientNameAr : admission.patientNameEn}
            <Badge variant="outline" className="text-xs font-mono px-2 py-0.5 border-slate-300 dark:border-slate-700">
              {admission.patientNumber}
            </Badge>
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4" />
              {t("bed")}: {admission.roomNumber}/{admission.bedNumber}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {t("admissionDate")}: {format(new Date(admission.admissionDate), "PP", { locale: dateLocale })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Button 
            variant="ghost" 
            size="xs" 
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="rounded-xl w-8 p-0"
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          <div className="px-4 font-bold text-sm min-w-[140px] text-center">
            {format(selectedDate, "EEEE, PP", { locale: dateLocale })}
          </div>
          <Button 
            variant="ghost" 
            size="xs" 
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="rounded-xl w-8 p-0"
          >
            {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── MAR GRID ────────────────────────────── */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden rounded-3xl bg-white dark:bg-[#0c121e]">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-black">{t("activeMedications") || "Active Inpatient Medications"}</CardTitle>
              <CardDescription className="text-xs font-medium">{t("marSubtitle") || "Tap on a time slot to record or view administration details."}</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 h-9 text-xs rounded-xl bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                <th className="sticky start-0 z-20 bg-slate-50 dark:bg-slate-900 p-4 text-start min-w-[300px] border-e border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t("medicationDetails") || "Medication & Orders"}</span>
                </th>
                {hours.map(h => (
                  <th key={h} className="p-2 text-center min-w-[60px] border-e border-slate-100 dark:border-slate-800/30">
                    <span className="text-[10px] font-bold text-slate-500">
                      {h === 0 ? "00:00" : format(setHours(new Date(), h), "HH:mm")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredPrescriptions.length === 0 ? (
                <tr>
                  <td colSpan={25} className="p-12 text-center text-slate-400 text-sm font-medium italic">
                    {t("noActiveMeds") || "No active inpatient medications found for this admission."}
                  </td>
                </tr>
              ) : (
                filteredPrescriptions.map((med) => {
                  const freqHours = getFrequncyHours(med.frequency);
                  return (
                    <tr key={med.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="sticky start-0 z-20 bg-white dark:bg-[#0c121e] p-4 border-e border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                            med.form.includes("injection") ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" : "bg-teal-100 text-teal-600 dark:bg-teal-900/30"
                          )}>
                            <Pill className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-black text-sm text-slate-900 dark:text-slate-100 leading-tight">
                              {isRtl ? med.medicationNameAr : med.medicationNameEn}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                              <Badge variant="secondary" className="px-1.5 py-0 text-[9px] h-4 bg-slate-100 dark:bg-slate-800">
                                {med.strength}
                              </Badge>
                              <span>{med.dosage} • {med.frequency}</span>
                            </div>
                            {med.instructions && (
                              <p className="text-[9px] text-amber-600 dark:text-amber-500 font-bold mt-1 line-clamp-1">
                                {med.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {hours.map(h => {
                        const isScheduled = freqHours.includes(h);
                        const admin = getAdminForSlot(med.id, selectedDate, h);
                        
                        return (
                          <td 
                            key={h} 
                            onClick={() => (isScheduled || admin) && handleRecordAdmin(med, h)}
                            className={cn(
                              "p-0 text-center border-e border-slate-100 dark:border-slate-800/30 cursor-pointer transition-all",
                              isScheduled ? "bg-teal-50/30 dark:bg-teal-900/5 hover:bg-teal-50 dark:hover:bg-teal-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/20"
                            )}
                          >
                            <div className="h-14 flex items-center justify-center">
                              {admin ? (
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shadow-sm",
                                  admin.status === "given" ? "bg-emerald-500 text-white" : 
                                  admin.status === "missed" ? "bg-rose-500 text-white" : 
                                  "bg-amber-500 text-white"
                                )}>
                                  {admin.status === "given" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                </div>
                              ) : isScheduled ? (
                                <div className="w-8 h-8 rounded-lg border-2 border-dashed border-teal-200 dark:border-teal-800/50 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                                  <Clock className="w-4 h-4 text-teal-400" />
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── ADMIN MODAL ────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {t("recordAdministration") || "Record Administration"}
            </DialogTitle>
            <DialogDescription>
              {selectedMed && (isRtl ? selectedMed.medicationNameAr : selectedMed.medicationNameEn)} 
              {" — "} {selectedTime && format(selectedTime, "p", { locale: dateLocale })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant={adminStatus === "given" ? "accent" : "outline"}
                className="flex-1 rounded-xl"
                onClick={() => setAdminStatus("given")}
              >
                {isRtl ? "تم الإعطاء" : "Given"}
              </Button>
              <Button 
                type="button" 
                variant={adminStatus === "refused" ? "destructive" : "outline"}
                className="flex-1 rounded-xl"
                onClick={() => setAdminStatus("refused")}
              >
                {isRtl ? "رفض المريض" : "Refused"}
              </Button>
              <Button 
                type="button" 
                variant={adminStatus === "held" ? "default" : "outline"}
                className={cn(
                  "flex-1 rounded-xl",
                  adminStatus === "held" && "bg-amber-600 hover:bg-amber-700 border-amber-700 text-white"
                )}
                onClick={() => setAdminStatus("held")}
              >
                {isRtl ? "مؤجل طبياً" : "Held"}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ps-1">
                {isRtl ? "ملاحظات التمريض" : "Nursing Notes"}
              </label>
              <textarea 
                className="w-full min-h-[100px] rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                placeholder={isRtl ? "أي تفاصيل إضافية عن الإعطاء أو الموقع..." : "Additional details (e.g. injection site, patient reaction)..."}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl" disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button 
              variant="accent" 
              onClick={handleSaveAdmin} 
              disabled={isPending}
              className="rounded-xl px-8 font-bold shadow-lg shadow-teal-500/20"
            >
              {isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                t("saveRecord") || "Save Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
