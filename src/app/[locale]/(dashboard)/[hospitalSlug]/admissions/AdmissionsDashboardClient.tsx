"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { safeParseInt } from "@/lib/utils/formatting";
import { calculateMEWS } from "@/lib/clinical/mews";
import {
  Bed as BedIcon,
  Plus,
  Search,
  Check,
  Activity,
  UserCheck,
  LogOut,
  Clock,
  FileText,
  Thermometer,
  Layers,
  RefreshCw,
  Gauge,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { searchPatientsAction } from "@/lib/actions/patients";
import { admitPatient, dischargePatient, recordInpatientVitals } from "@/lib/actions/admissions";

interface BedDataRow {
  bedId: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved" | "quarantine" | "pending_cleaning";
  lastDischargedAt: Date | null;
  cleaningRequestedAt: Date | null;
  
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  wing: string | null;

  admissionId: string | null;
  admissionDate: Date | null;
  reason: string | null;
  admissionStatus: string | null;

  patientId: string | null;
  patientNameAr: string | null;
  patientNameEn: string | null;
  patientNumber: string | null;
  nationalId: string | null;
  gender: "male" | "female" | null;
  dob: Date | null;

  doctorId: string | null;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
  doctorLicense: string | null;
}

interface Doctor {
  id: string;
  nameAr: string;
  nameEn: string;
  licenseNumber: string | null;
}

interface Room {
  id: string;
  roomNumber: string;
  type: string;
  floor: string;
  wing: string | null;
  isActive: boolean;
}

interface VitalRecord {
  id: string;
  patientId: string;
  recordedAt: Date;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperature: string | null;
  oxygenSaturation: number | null;
  weightKg: string | null;
  heightCm: number | null;
  recorderNameAr: string | null;
  recorderNameEn: string | null;
}

interface SearchedPatient {
  id: string;
  nameAr: string;
  nameEn: string;
  patientNumber: string;
  nationalId: string | null;
}

interface AdmissionsDashboardClientProps {
  locale: string;
  hospitalSlug: string;
  rooms: Room[];
  bedsData: BedDataRow[];
  doctors: Doctor[];
  vitalsHistory: Record<string, VitalRecord[]>;
  pendingCleaningCount: number;
}

export default function AdmissionsDashboardClient({
  locale,
  hospitalSlug: _hospitalSlug,
  rooms,
  bedsData,
  doctors,
  vitalsHistory,
  pendingCleaningCount: _pendingCleaningCount,
}: AdmissionsDashboardClientProps) {
  const t = useTranslations("admissions");
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // State managers
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Selection states
  const [selectedBed, setSelectedBed] = useState<BedDataRow | null>(null);
  
  // Memoize MEWS score calculations for the selected patient's vitals history to prevent redundant calculations on every render pass
  const memoizedMewsHistory = useMemo(() => {
    const patientId = selectedBed?.patientId;
    if (!patientId) return {};
    const patientVitals = vitalsHistory[patientId] || [];
    const results: Record<string, ReturnType<typeof calculateMEWS>> = {};
    for (const v of patientVitals) {
      results[v.id] = calculateMEWS({
        systolicBp: v.bloodPressureSystolic,
        heartRate: v.heartRate,
        respiratoryRate: v.respiratoryRate,
        temperature: v.temperature,
      });
    }
    return results;
  }, [selectedBed?.patientId, vitalsHistory]);
  
  // New Admission Dialog fields
  const [patientQuery, setPatientQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedPatient[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<SearchedPatient | null>(null);
  const [admittingDoctorId, setAdmittingDoctorId] = useState("");
  const [admissionReason, setAdmissionReason] = useState("");
  const [targetBedId, setTargetBedId] = useState("");
  const [isAdmitting, setIsAdmitting] = useState(false);

  // Vitals Flowshet Record states
  const [isVitalsFormExpanded, setIsVitalsOpen] = useState(false);
  const [isRecordingVitals, setIsRecordingVitals] = useState(false);
  const [vitalsInput, setVitalsInput] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    heartRate: "",
    respiratoryRate: "",
    temperature: "",
    oxygenSaturation: "",
    weightKg: "",
    heightCm: "",
  });

  // Discharge Dialog fields
  const [dischargeCondition, setDischargeCondition] = useState<"stable" | "improved" | "referred" | "deceased">("stable");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [summaryAr, setSummaryAr] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [isDischarging, setIsDischarging] = useState(false);

  const isRtl = locale === "ar";

  // Compute metrics dynamically from the static dataset passed from the server
  const totalBeds = bedsData.length;
  const occupiedBeds = bedsData.filter((b) => b.status === "occupied").length;
  const availableBeds = bedsData.filter((b) => b.status === "available").length;
  const pendingCleaningBeds = bedsData.filter((b) => b.status === "pending_cleaning").length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Group beds by roomId
  const roomsWithBedsMap = rooms.map((room) => {
    const roomBeds = bedsData.filter((b) => b.roomId === room.id);
    return {
      ...room,
      beds: roomBeds,
    };
  });

  // Patient Search function inside Admission Modal
  const handleSearchPatients = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setIsSearchingPatients(true);
    try {
      const res = await searchPatientsAction(query) as { success: boolean; data?: SearchedPatient[]; error?: string };
      if (res.success && res.data) {
        setSearchResults(res.data);
      } else {
        const errorMessage = res && "error" in res ? res.error : "Failed to search patients.";
        toast.error(errorMessage as string);
      }
    } catch {
      toast.error("Error occurred while searching.");
    } finally {
      setIsSearchingPatients(false);
    }
  }, []); // Stable callback instance

  // Trigger search on typing debounce or enter
  useEffect(() => {
    if (!patientQuery.trim()) {
      const timer = setTimeout(() => {
        setSearchResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
    const delayDebounceFn = setTimeout(() => {
      handleSearchPatients(patientQuery);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [patientQuery, handleSearchPatients]);

  // Admit patient handler
  const handleAdmitPatient = async () => {
    const bedIdToAdmit = targetBedId || selectedBed?.bedId;
    if (!selectedPatient) {
      toast.error(isRtl ? "يرجى تحديد مريض أولاً" : "Please select a patient first.");
      return;
    }
    if (!bedIdToAdmit) {
      toast.error(isRtl ? "يرجى اختيار السرير" : "Please select a bed.");
      return;
    }
    if (!admittingDoctorId) {
      toast.error(isRtl ? "يرجى اختيار الطبيب المعالج" : "Please select admitting physician.");
      return;
    }
    if (!admissionReason.trim()) {
      toast.error(isRtl ? "يرجى توضيح سبب الدخول" : "Please enter the reason for admission.");
      return;
    }

    setIsAdmitting(true);
    try {
      const res = await admitPatient({
        patientId: selectedPatient.id,
        bedId: bedIdToAdmit,
        admittingDoctorId,
        admissionReason,
      });

      if (res.success) {
        toast.success(t("admissionSuccess"));
        setIsAdmitOpen(false);
        // Reset inputs
        setSelectedPatient(null);
        setAdmittingDoctorId("");
        setAdmissionReason("");
        setPatientQuery("");
        setTargetBedId("");
        // Reload page to reflect live changes
        router.refresh();
      } else {
        toast.error((res as { error?: string }).error || "Unknown error occurred.");
      }
    } catch (err: unknown) {
      toast.error("Error admitting patient: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsAdmitting(false);
    }
  };

  // Record vitals handler
  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !selectedBed.patientId) return;

    setIsRecordingVitals(true);
    try {
      const res = await recordInpatientVitals({
        patientId: selectedBed.patientId,
        bloodPressureSystolic: vitalsInput.bpSystolic ? safeParseInt(vitalsInput.bpSystolic) : undefined,
        bloodPressureDiastolic: vitalsInput.bpDiastolic ? safeParseInt(vitalsInput.bpDiastolic) : undefined,
        heartRate: vitalsInput.heartRate ? safeParseInt(vitalsInput.heartRate) : undefined,
        respiratoryRate: vitalsInput.respiratoryRate ? safeParseInt(vitalsInput.respiratoryRate) : undefined,
        temperature: vitalsInput.temperature || undefined,
        oxygenSaturation: vitalsInput.oxygenSaturation ? safeParseInt(vitalsInput.oxygenSaturation) : undefined,
        weightKg: vitalsInput.weightKg || undefined,
        heightCm: vitalsInput.heightCm ? safeParseInt(vitalsInput.heightCm) : undefined,
      });

      if (res.success) {
        toast.success(t("recordVitalsSuccess"));
        setIsVitalsOpen(false);
        // Clear inputs
        setVitalsInput({
          bpSystolic: "",
          bpDiastolic: "",
          heartRate: "",
          respiratoryRate: "",
          temperature: "",
          oxygenSaturation: "",
          weightKg: "",
          heightCm: "",
        });
        // Live updates via server action revalidation
        router.refresh();
      } else {
        toast.error((res as { error?: string }).error || "Unknown error occurred.");
      }
    } catch (err: unknown) {
      toast.error("Failed to record vitals: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRecordingVitals(false);
    }
  };

  // Discharge patient handler
  const handleDischargePatient = async () => {
    if (!selectedBed || !selectedBed.admissionId) return;
    if (!summaryAr.trim() || !summaryEn.trim()) {
      toast.error(
        isRtl 
          ? "يرجى كتابة التلخيص الطبي باللغتين العربية والإنجليزية لضمان الالتزام بمعايير وزارة الصحة." 
          : "Please write the medical summary in both Arabic and English to comply with MOH requirements."
      );
      return;
    }

    setIsDischarging(true);
    try {
      const res = await dischargePatient({
        admissionId: selectedBed.admissionId,
        dischargeCondition,
        followUpInstructions,
        summaryAr,
        summaryEn,
      });

      if (res.success) {
        toast.success(t("dischargeSuccess"));
        setIsDrawerOpen(false);
        // Clear values
        setSummaryAr("");
        setSummaryEn("");
        setFollowUpInstructions("");
        setDischargeCondition("stable");
        // Live updates
        router.refresh();
      } else {
        toast.error((res as { error?: string }).error || "Unknown error occurred.");
      }
    } catch (err: unknown) {
      toast.error("Failed to discharge patient: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDischarging(false);
    }
  };

  // Open Bed admission shortcut
  const handleBedClick = (bed: BedDataRow) => {
    setSelectedBed(bed);
    if (bed.status === "available") {
      setTargetBedId(bed.bedId);
      setIsAdmitOpen(true);
    } else if (bed.status === "occupied") {
      setIsDrawerOpen(true);
    } else if (bed.status === "pending_cleaning") {
      toast.info(t("bedPendingCleaning"));
    } else {
      toast.warning(t("bedUnavailable"));
    }  };

  // Format date helper
  const formatDate = (date: Date | string | null) => {
    if (!date || !mounted) return "";
    const d = new Date(date);
    return d.toLocaleString(isRtl ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAge = (dob: Date | string | null) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age + (isRtl ? " سنة" : " years old");
  };

  // Filter list of available beds for select dropdown
  const availableBedsList = bedsData.filter((b) => b.status === "available");

  return (
    <div className="max-w-7xl mx-auto space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      {/* Upper Navigation Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/30 pb-6 text-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Layers className="h-5 w-5 animate-pulse" />
            </span>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {t("title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            {isRtl 
              ? "متابعة السعة الاستيعابية الحالية للقسم الداخلي، ومراقبة حالة إشغال الأسرة، والتدفق الفوري للمؤشرات الحيوية لمرضى المنشأة." 
              : "Track live inpatient capacity, manage floor bed maps, schedule new admissions, and audit patient flowsheet trends."}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => router.refresh()}
            variant="outline"
            className="rounded-xl border-border bg-card hover:bg-muted text-foreground shadow-sm"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground me-2" />
            {isRtl ? "تحديث" : "Refresh"}
          </Button>

          <Button
            onClick={() => {
              setSelectedBed(null);
              setTargetBedId("");
              setIsAdmitOpen(true);
            }}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-md shadow-blue-500/10"
          >
            <Plus className="h-4 w-4 me-2" />
            {t("admitPatient")}
          </Button>
        </div>
      </header>

      {/* Metrics Grid dashboard */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Beds */}
        <Card className="rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                {t("totalBeds")}
              </p>
              <h3 className="text-3xl font-black text-foreground tracking-tight">
                {totalBeds}
              </h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-400">
              <BedIcon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Occupied Beds */}
        <Card className="rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                {t("occupiedBeds")}
              </p>
              <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                {occupiedBeds}
              </h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 dark:text-blue-400">
              <UserCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Available Beds */}
        <Card className="rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                {t("availableBeds")}
              </p>
              <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {availableBeds}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <Check className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Cleaning */}
        <Card className="rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                {t("pendingCleaning")}
              </p>
              <h3 className="text-3xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
                {pendingCleaningBeds}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
              <Clock className="h-6 w-6 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card className="rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start col-span-2 lg:col-span-1">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2 flex-1 me-2">
              <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
                {t("occupancyRate")}
              </p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
                  {occupancyRate}%
                </h3>
              </div>
              <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className="bg-purple-600 dark:bg-purple-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${occupancyRate}%` }}
                />
              </div>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-600 dark:text-purple-400">
              <Gauge className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Main Bed Map Grid Container */}
      <main className="space-y-8">
        {roomsWithBedsMap.length === 0 ? (
          <Card className="rounded-2xl border border-border/60 p-12 bg-card text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-muted text-muted-foreground">
                <BedIcon className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {isRtl ? "لم يتم تعريف أية غرف أو أسرة بعد في هذه المنشأة" : "No Rooms or Beds Registered Yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {isRtl 
                  ? "يرجى التوجه لإعدادات المستشفى أو الدعم لإضافة غرف وأسرة للقسم الداخلي." 
                  : "Please configure your hospital wards and add clinical rooms under the system configuration guide."}
              </p>
            </CardContent>
          </Card>
        ) : (
          roomsWithBedsMap.map((room) => (
            <Card key={room.id} className="rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start">
              <CardHeader className="bg-muted/30 border-b border-border/60 py-4 px-6 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-foreground text-lg">
                      {isRtl ? `غرفة ${room.roomNumber}` : `Room ${room.roomNumber}`}
                    </span>
                    <Badge variant="outline" className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground border-border capitalize">
                      {room.type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{isRtl ? `الطابق: ${room.floor}` : `Floor: ${room.floor}`}</span>
                    {room.wing && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{isRtl ? `الجناح: ${room.wing}` : `Wing: ${room.wing}`}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge className="rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs border-none font-bold">
                  {isRtl ? `${room.beds.length} أسرة` : `${room.beds.length} Beds`}
                </Badge>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {room.beds.map((bed) => {
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

                    return (
                      <button
                        key={bed.bedId}
                        onClick={() => handleBedClick(bed)}
                        className={`flex flex-col justify-between p-4 rounded-xl border border-dashed transition-all text-start w-full relative outline-none focus:ring-2 focus:ring-primary h-28 group ${statusColor}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-black text-sm flex items-center gap-1.5">
                            <BedIcon className="h-4 w-4 text-muted-foreground group-hover:scale-110 transition-transform" />
                            {isRtl ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}
                          </span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full capitalize ${statusBadge}`}>
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
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>

      {/* MODAL: Admit New Patient */}
      <Dialog open={isAdmitOpen} onOpenChange={setIsAdmitOpen}>
        <DialogHeader onClose={() => setIsAdmitOpen(false)} className="text-start space-y-1.5">
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

        <DialogContent className="space-y-6 text-start" dir={isRtl ? "rtl" : "ltr"}>
          {/* Bed Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/90">{t("selectBed")}</label>
            {selectedBed && targetBedId === selectedBed.bedId ? (
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
                {availableBedsList.map((b) => (
                  <option key={b.bedId} value={b.bedId} className="text-xs bg-background text-foreground">
                    {isRtl 
                      ? `غرفة ${b.roomNumber} · سرير ${b.bedNumber} (${b.roomType})` 
                      : `Room ${b.roomNumber} · Bed ${b.bedNumber} (${b.roomType})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Patient Search */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-foreground/90">{t("selectPatient")}</label>
            {selectedPatient ? (
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs flex justify-between items-center">
                <div className="space-y-1">
                  <p className="font-extrabold text-blue-600 dark:text-blue-400">
                    {isRtl ? selectedPatient.nameAr : selectedPatient.nameEn}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedPatient.patientNumber} · {selectedPatient.nationalId || (isRtl ? "جواز سفر" : "Passport")}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedPatient(null)}
                  className="text-[11px] text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-lg px-2 h-7"
                >
                  {isRtl ? "تغيير" : "Change"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute top-3.5 h-4 w-4 text-muted-foreground start-3" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    className="rounded-xl border-border/60 shadow-sm h-11 text-xs text-start ps-9 pe-4 bg-background text-foreground"
                  />
                </div>
                {isSearchingPatients && (
                  <div className="text-xs text-muted-foreground italic ps-1 flex items-center gap-1.5 mt-1">
                    <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                    {isRtl ? "جاري البحث..." : "Searching directory..."}
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="border border-border/60 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto bg-muted/40 mt-1">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="w-full p-3 text-start hover:bg-card border-b border-border/40 last:border-b-0 transition-colors flex items-center justify-between text-xs outline-none bg-transparent"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">{isRtl ? p.nameAr : p.nameEn}</p>
                          <p className="text-[10px] text-muted-foreground">{p.patientNumber} · {p.nationalId || ""}</p>
                        </div>
                        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black border-none px-2 py-0.5">
                          {isRtl ? "اختر" : "Select"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {patientQuery.trim() && !isSearchingPatients && searchResults.length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic ps-1 mt-1">
                    {isRtl ? "لا توجد نتائج بحث مطابقة." : "No matching patient folders found."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Admitting Physician */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/90">{t("selectDoctor")}</label>
            <select 
              value={admittingDoctorId} 
              onChange={(e) => setAdmittingDoctorId(e.target.value)}
              className="hms-select-native font-bold"
            >
              <option value="" disabled className="text-xs text-muted-foreground bg-background">
                {isRtl ? "اختر الطبيب المسؤول..." : "Select admitting physician..."}
              </option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id} className="text-xs bg-background text-foreground">
                  {isRtl ? doc.nameAr : doc.nameEn} {doc.licenseNumber ? `(${doc.licenseNumber})` : ""}
                </option>
              ))}
            </select>          </div>

          {/* Admission Reason */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/90">{t("admissionReason")}</label>
            <Textarea
              placeholder={isRtl ? "اكتب تفاصيل الشكوى الطبية والداعي للإدخال للقسم الداخلي..." : "Enter symptoms, medical indicators or notes justifying ward admission..."}
              value={admissionReason}
              onChange={(e) => setAdmissionReason(e.target.value)}
              className="rounded-xl border-border/60 bg-background text-foreground shadow-sm min-h-20 text-xs text-start"
            />
          </div>
        </DialogContent>

        <DialogFooter className="gap-2 sm:gap-0 mt-6" dir={isRtl ? "rtl" : "ltr"}>
          <Button
            variant="outline"
            onClick={() => setIsAdmitOpen(false)}
            className="rounded-xl border-border/60 hover:bg-muted text-xs h-10 px-5 text-foreground"
          >
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={handleAdmitPatient}
            disabled={isAdmitting}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-sm text-xs h-10 px-5"
          >
            {isAdmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin me-1.5" />
                {isRtl ? "جاري الإدخال..." : "Admitting..."}
              </>
            ) : (
              t("admitPatient")
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* DRAWER: Inpatient Clinical Portal */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerHeader onClose={() => setIsDrawerOpen(false)} className="text-start border-b border-border/60 pb-4 px-6 sm:px-12 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
            <div className="space-y-1 text-start">
              <DrawerTitle className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600">
                  <Activity className="h-5 w-5 animate-pulse" />
                </span>
                {selectedBed ? (isRtl ? selectedBed.patientNameAr : selectedBed.patientNameEn) : ""}
              </DrawerTitle>
              <DrawerDescription className="text-xs text-muted-foreground font-medium">
                {selectedBed ? (
                  isRtl 
                    ? `سرير ${selectedBed.bedNumber} · غرفة ${selectedBed.roomNumber} (${selectedBed.roomType})` 
                    : `Bed ${selectedBed.bedNumber} · Room ${selectedBed.roomNumber} (${selectedBed.roomType})`
                ) : ""}
              </DrawerDescription>
            </div>

            {selectedBed && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none px-3 py-1 font-bold rounded-full">
                  {selectedBed.patientNumber}
                </Badge>
                <Badge className="bg-muted text-muted-foreground border border-border/60 px-3 py-1 font-medium rounded-full">
                  {selectedBed.gender === "male" ? (isRtl ? "ذكر" : "Male") : (isRtl ? "أنثى" : "Female")} · {getAge(selectedBed.dob)}
                </Badge>
                {selectedBed.nationalId && (
                  <Badge className="bg-muted text-muted-foreground border border-border/60 px-3 py-1 font-mono rounded-full">
                    NID: {selectedBed.nationalId}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DrawerHeader>

        {/* Drawer Scrollable Content Grid */}
        <DrawerContent className="flex-1 overflow-y-auto px-6 sm:px-12 py-6" dir={isRtl ? "rtl" : "ltr"}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column (2/3 width) - Vitals Flowsheet Historical Records */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Thermometer className="h-4.5 w-4.5 text-blue-500" />
                  {t("vitalsFlowsheet")}
                </h4>

                <Button
                  onClick={() => setIsVitalsOpen(!isVitalsFormExpanded)}
                  variant="outline"
                  className="rounded-xl border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 text-xs py-1 h-8 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5 me-1" />
                  {isVitalsFormExpanded ? (isRtl ? "إغلاق النموذج" : "Close Form") : t("recordVitals")}
                </Button>
              </div>

              {/* RECORD VITALS: Collapsible Form panel */}
              {isVitalsFormExpanded && (
                <Card className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 shadow-sm text-start animate-fade-in">
                  <form onSubmit={handleRecordVitals} className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {/* Systolic BP */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "الضغط الانقباضي" : "Systolic BP"}</label>
                        <Input
                          placeholder="120"
                          type="number"
                          value={vitalsInput.bpSystolic}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, bpSystolic: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>

                      {/* Diastolic BP */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "الضغط الانبساطي" : "Diastolic BP"}</label>
                        <Input
                          placeholder="80"
                          type="number"
                          value={vitalsInput.bpDiastolic}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, bpDiastolic: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>

                      {/* Heart Rate */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "نبض القلب" : "Heart Rate (bpm)"}</label>
                        <Input
                          placeholder="72"
                          type="number"
                          value={vitalsInput.heartRate}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, heartRate: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>

                      {/* Respiratory Rate */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "معدل التنفس" : "Resp. Rate (bpm)"}</label>
                        <Input
                          placeholder="16"
                          type="number"
                          value={vitalsInput.respiratoryRate}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, respiratoryRate: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>

                      {/* Temperature */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "درجة الحرارة" : "Body Temp (°C)"}</label>
                        <Input
                          placeholder="36.8"
                          value={vitalsInput.temperature}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, temperature: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>

                      {/* Oxygen Saturation */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "الأكسجين SpO2" : "SpO2 (%)"}</label>
                        <Input
                          placeholder="98"
                          type="number"
                          value={vitalsInput.oxygenSaturation}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, oxygenSaturation: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>

                      {/* Weight */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "الوزن (كجم)" : "Weight (kg)"}</label>
                        <Input
                          placeholder="70"
                          value={vitalsInput.weightKg}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, weightKg: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>

                      {/* Height */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-foreground/90">{isRtl ? "الطول (سم)" : "Height (cm)"}</label>
                        <Input
                          placeholder="170"
                          type="number"
                          value={vitalsInput.heightCm}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, heightCm: e.target.value })}
                          className="rounded-lg bg-background border-border/60 shadow-sm h-9 text-xs text-start text-foreground"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsVitalsOpen(false)}
                        className="rounded-xl hover:bg-muted text-xs h-9 px-4 text-foreground"
                      >
                        {isRtl ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button
                        type="submit"
                        disabled={isRecordingVitals}
                        className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm text-xs h-9 px-4"
                      >
                        {isRecordingVitals ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin me-1.5" />
                            {isRtl ? "حفظ القياسات..." : "Recording..."}
                          </>
                        ) : (
                          t("recordVitals")
                        )}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {/* Vitals History Flowshet Timeline Log */}
              {selectedBed && selectedBed.patientId && vitalsHistory[selectedBed.patientId]?.length > 0 ? (
                <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm overflow-x-auto text-start">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border/40 font-bold text-muted-foreground">
                      <tr>
                        <th className="p-3 text-start">{isRtl ? "تاريخ القياس" : "Recorded At"}</th>
                        <th className="p-3 text-center">{isRtl ? "ضغط الدم" : "BP"}</th>
                        <th className="p-3 text-center">{isRtl ? "النبض" : "HR"}</th>
                        <th className="p-3 text-center">{isRtl ? "التنفس" : "RR"}</th>
                        <th className="p-3 text-center">{isRtl ? "درجة الحرارة" : "Temp"}</th>
                        <th className="p-3 text-center">{isRtl ? "الأكسجين" : "SpO2"}</th>
                        <th className="p-3 text-center">{isRtl ? "تقييم MEWS" : "MEWS Score"}</th>
                        <th className="p-3 text-center">{isRtl ? "الوزن/الطول" : "Wt/Ht"}</th>
                        <th className="p-3 text-start hidden sm:table-cell">{isRtl ? "بواسطة" : "Staff Member"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {vitalsHistory[selectedBed.patientId].map((v) => {
                        const mews = memoizedMewsHistory[v.id] || calculateMEWS({
                          systolicBp: v.bloodPressureSystolic,
                          heartRate: v.heartRate,
                          respiratoryRate: v.respiratoryRate,
                          temperature: v.temperature,
                        });

                        return (
                          <tr key={v.id} className="hover:bg-muted/40 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground whitespace-nowrap">
                              {formatDate(v.recordedAt)}
                            </td>
                            <td className="p-3 text-center font-bold text-foreground">
                              {v.bloodPressureSystolic && v.bloodPressureDiastolic 
                                ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
                                : "—"}
                            </td>
                            <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">
                              {v.heartRate ? `${v.heartRate} bpm` : "—"}
                            </td>
                            <td className="p-3 text-center text-foreground/90">
                              {v.respiratoryRate ? `${v.respiratoryRate}/m` : "—"}
                            </td>
                            <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">
                              {v.temperature ? `${v.temperature}°C` : "—"}
                            </td>
                            <td className="p-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                              {v.oxygenSaturation ? `${v.oxygenSaturation}%` : "—"}
                            </td>
                            <td className="p-3 text-center">
                              <span className={cn("px-2.5 py-0.5 text-[10px] font-bold rounded-full border shadow-sm", mews.badgeStyle)}>
                                {mews.score} ({isRtl ? mews.labelAr : mews.labelEn})
                              </span>
                            </td>
                            <td className="p-3 text-center text-muted-foreground whitespace-nowrap">
                              {v.weightKg ? `${v.weightKg}kg` : "—"} / {v.heightCm ? `${v.heightCm}cm` : "—"}
                            </td>
                            <td className="p-3 text-start text-muted-foreground/80 truncate hidden sm:table-cell max-w-[120px]">
                              {isRtl ? v.recorderNameAr : v.recorderNameEn}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-2xl p-8 bg-muted/20 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-xs">{isRtl ? "لا توجد قياسات علامات حيوية مسجلة بعد لهذا المريض" : "No vital flowsheet measurements logged yet."}</p>
                </div>
              )}
            </div>

            {/* Right Column (1/3 width) - Patient Admission Info and Discharging Form */}
            <div className="space-y-6">
              <Card className="rounded-2xl border border-border/60 bg-muted/40 p-5 shadow-sm text-start">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {isRtl ? "تفاصيل حالة الإدخال" : "Admission Parameters"}
                </h4>

                {selectedBed && (
                  <div className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase">{t("admissionDate")}</label>
                      <p className="font-bold text-foreground">{formatDate(selectedBed.admissionDate)}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase">{t("admittingDoctor")}</label>
                      <p className="font-bold text-foreground">{isRtl ? selectedBed.doctorNameAr : selectedBed.doctorNameEn}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase">{t("admissionReason")}</label>
                      <p className="text-foreground bg-background p-3 rounded-lg border border-border/60 mt-1 shadow-sm leading-relaxed whitespace-pre-wrap">
                        {selectedBed.reason}
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {/* DISCHARGE WORKFLOW WORKSPACE */}
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
                      onChange={(e) => setDischargeCondition(e.target.value as "stable" | "improved" | "referred" | "deceased")}
                      className="hms-select-native font-bold"
                    >
                      <option value="stable" className="text-xs bg-background text-foreground">{t("conditionStable")}</option>
                      <option value="improved" className="text-xs bg-background text-foreground">{t("conditionImproved")}</option>
                      <option value="referred" className="text-xs bg-background text-foreground">{t("conditionReferred")}</option>
                      <option value="deceased" className="text-xs bg-background text-foreground">{t("conditionDeceased")}</option>
                    </select>
                  </div>

                  {/* Follow-up Instructions */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/90">{t("followUpInstructions")}</label>
                    <Textarea
                      placeholder={isRtl ? "اكتب الخطة العلاجية للمنزل ومواعيد المراجعة والأدوية المصروفة..." : "Enter patient discharge instructions, home medication plans and clinic revisits..."}
                      value={followUpInstructions}
                      onChange={(e) => setFollowUpInstructions(e.target.value)}
                      className="rounded-xl border-border/60 bg-background text-foreground shadow-sm min-h-16 text-xs text-start leading-relaxed"
                    />
                  </div>

                  {/* Medical Summary Arabic (MOH Requirement) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/90 flex items-center gap-1">
                      {t("summaryAr")}
                      <Badge variant="secondary" className="bg-muted text-muted-foreground rounded text-[9px] px-1 py-0 border-none font-bold">MOH</Badge>
                    </label>
                    <Textarea
                      placeholder="الملخص الطبي للحالة المرضية والإجراءات المتخذة بالتفصيل..."
                      value={summaryAr}
                      onChange={(e) => setSummaryAr(e.target.value)}
                      className="rounded-xl border-border/60 bg-background text-foreground shadow-sm min-h-20 text-xs text-start leading-relaxed"
                    />
                  </div>

                  {/* Medical Summary English */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/90 flex items-center gap-1">
                      {t("summaryEn")}
                      <Badge variant="secondary" className="bg-muted text-muted-foreground rounded text-[9px] px-1 py-0 border-none font-bold">MOH</Badge>
                    </label>
                    <Textarea
                      placeholder="Comprehensive english medical case brief, treatment details and clinical decisions..."
                      value={summaryEn}
                      onChange={(e) => setSummaryEn(e.target.value)}
                      className="rounded-xl border-border/60 bg-background text-foreground shadow-sm min-h-20 text-xs text-start leading-relaxed"
                    />
                  </div>

                  {/* Discharge button */}
                  <Button
                    onClick={handleDischargePatient}
                    disabled={isDischarging}
                    className="w-full mt-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-sm text-xs h-11"
                  >
                    {isDischarging ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin me-1.5" />
                        {isRtl ? "جاري التخريج والتعقيم..." : "Discharging..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 me-1.5" />
                        {isRtl ? "إنهاء الإدخال وتنبيه النظافة" : "Finalize Discharge & Clean Bed"}
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>

          </div>
        </DrawerContent>

        <DrawerFooter className="border-t border-border/60 py-4 px-6 sm:px-12 shrink-0 flex flex-row justify-end" dir={isRtl ? "rtl" : "ltr"}>
          <Button 
            variant="outline" 
            className="rounded-xl border-border/60 text-xs h-10 px-6 text-foreground hover:bg-muted"
            onClick={() => setIsDrawerOpen(false)}
          >
            {isRtl ? "إغلاق النافذة" : "Close Portal"}
          </Button>
        </DrawerFooter>
      </Drawer>
    </div>
  );
}
