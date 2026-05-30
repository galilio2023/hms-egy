"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { 
  UserCheck, 
  Search, 
  Check, 
  Loader2,
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { searchPatientsAction } from "@/lib/actions/patients";
import { admitPatient } from "../actions";
import { cn } from "@/lib/utils";

interface SearchedPatient {
  id: string;
  nameAr: string;
  nameEn: string;
  patientNumber: string;
  nationalId: string | null;
}

interface Doctor {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface Bed {
  bedId: string;
  bedNumber: string;
  roomNumber: string;
  roomType: string;
}

interface AdmitPatientModalProps {
  doctors: Doctor[];
  availableBeds: Bed[];
  locale: string;
}

export function AdmitPatientModal({
  doctors,
  availableBeds,
  locale,
}: AdmitPatientModalProps) {
  const t = useTranslations("admissions");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const admitBedId = searchParams.get("admitBedId");
  const isOpen = !!admitBedId;

  // Form states
  const [patientQuery, setPatientQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedPatient[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<SearchedPatient | null>(null);
  const [admittingDoctorId, setAdmittingDoctorId] = useState("");
  const [admissionReason, setAdmissionReason] = useState("");
  const [targetBedId, setTargetBedId] = useState(admitBedId || "");

  useEffect(() => {
    if (admitBedId) setTargetBedId(admitBedId);
  }, [admitBedId]);

  const closeModal = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("admitBedId");
    router.push(`${pathname}?${params.toString()}`);
    
    // Reset form
    setPatientQuery("");
    setSearchResults([]);
    setSelectedPatient(null);
    setAdmittingDoctorId("");
    setAdmissionReason("");
  };

  const handleSearchPatients = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingPatients(true);
    try {
      const res = await searchPatientsAction(query) as { success: boolean; data?: SearchedPatient[] };
      if (res.success && res.data) {
        setSearchResults(res.data);
      }
    } catch {
      toast.error("Error occurred while searching.");
    } finally {
      setIsSearchingPatients(false);
    }
  }, []);

  useEffect(() => {
    if (!patientQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => handleSearchPatients(patientQuery), 400);
    return () => clearTimeout(timer);
  }, [patientQuery, handleSearchPatients]);

  const handleAdmit = async () => {
    if (!selectedPatient || !targetBedId || !admittingDoctorId || !admissionReason.trim()) {
      toast.error(isRtl ? "يرجى إكمال جميع الحقول" : "Please complete all fields.");
      return;
    }

    startTransition(async () => {
      const res = await admitPatient({
        patientId: selectedPatient.id,
        bedId: targetBedId,
        admittingDoctorId,
        admissionReason,
      });

      if (res.success) {
        toast.success(t("admissionSuccess"));
        closeModal();
        router.refresh();
      } else {
        const errorMsg = 'error' in res ? res.error : "Failed to admit patient.";
        toast.error(errorMsg);
      }
    });
  };

  const selectedBed = availableBeds.find(b => b.bedId === targetBedId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-2xl border-border/40 shadow-2xl glass-card overflow-hidden p-0" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader className="p-6 pb-0 text-start space-y-1.5">
          <DialogTitle className="text-xl font-extrabold text-foreground flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <UserCheck className="h-5 w-5" />
            </span>
            {t("admitPatient")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isRtl 
              ? "سجل إدخال مريض جديد للقسم الداخلي، واختر الطبيب المعالج والسرير المناسب." 
              : "Record patient admission details, assign physician, and confirm physical bed allocations."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Bed Selection (Locked if came from specific bed click) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/90">{t("selectBed")}</label>
            {admitBedId && selectedBed ? (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs flex justify-between items-center font-bold text-foreground">
                <span>
                  {isRtl 
                    ? `غرفة ${selectedBed.roomNumber} · سرير ${selectedBed.bedNumber} (${selectedBed.roomType})` 
                    : `Room ${selectedBed.roomNumber} · Bed ${selectedBed.bedNumber} (${selectedBed.roomType})`}
                </span>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {isRtl ? "محدد" : "Locked"}
                </Badge>
              </div>
            ) : (
              <select 
                value={targetBedId} 
                onChange={(e) => setTargetBedId(e.target.value)}
                className="hms-select-native font-bold"
              >
                <option value="" disabled className="text-xs text-muted-foreground bg-background">
                  {isRtl ? "اختر سريراً متاحاً..." : "Select an available bed..."}
                </option>
                {availableBeds.map((bed) => (
                  <option key={bed.bedId} value={bed.bedId} className="bg-background text-foreground py-2">
                    {isRtl 
                      ? `غرفة ${bed.roomNumber} · سرير ${bed.bedNumber} (${bed.roomType})` 
                      : `Room ${bed.roomNumber} · Bed ${bed.bedNumber} (${bed.roomType})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Patient Lookup */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-foreground/90">{t("patient")}</label>
            
            {!selectedPatient ? (
              <div className="relative group">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder={isRtl ? "ابحث بالاسم، رقم الملف، أو الرقم القومي..." : "Search by name, file #, or NID..."}
                  className="ps-10 h-11 rounded-xl border-border/60 bg-muted/20 focus:bg-background transition-all"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
                
                {isSearchingPatients && (
                  <div className="absolute end-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-card border border-border/60 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="w-full p-3 text-start hover:bg-muted/50 border-b border-border/30 last:border-0 flex items-center justify-between group transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {isRtl ? p.nameAr : p.nameEn}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                            <span>#{p.patientNumber}</span>
                            {p.nationalId && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span>{p.nationalId}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-primary/5 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-foreground">
                      {isRtl ? selectedPatient.nameAr : selectedPatient.nameEn}
                    </p>
                    <p className="text-[10px] text-muted-foreground">#{selectedPatient.patientNumber}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-bold text-[10px]"
                  onClick={() => setSelectedPatient(null)}
                >
                  {isRtl ? "تغيير" : "Change"}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Admitting Doctor */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/90">{t("admittingDoctor")}</label>
              <select
                value={admittingDoctorId}
                onChange={(e) => setAdmittingDoctorId(e.target.value)}
                className="hms-select-native font-bold"
              >
                <option value="" disabled className="text-xs text-muted-foreground bg-background">
                  {isRtl ? "اختر الطبيب المعالج..." : "Select attending doctor..."}
                </option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id} className="bg-background text-foreground py-2">
                    {isRtl ? doc.nameAr : doc.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Admission Reason */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/90">{t("admissionReason")}</label>
              <Input
                placeholder={isRtl ? "مثال: جراحة استئصال مرارة..." : "e.g. Cholecystectomy..."}
                className="h-11 rounded-xl border-border/60 bg-muted/10 font-medium text-xs"
                value={admissionReason}
                onChange={(e) => setAdmissionReason(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/20 border-t border-border/40 gap-3">
          <Button 
            variant="ghost" 
            className="rounded-xl font-bold text-xs h-11 px-6"
            onClick={closeModal}
            disabled={isPending}
          >
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button 
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs h-11 px-8 shadow-lg shadow-blue-600/20"
            onClick={handleAdmit}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                {isRtl ? "جاري الحجز..." : "Admitting..."}
              </>
            ) : (
              t("confirmAdmission")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
