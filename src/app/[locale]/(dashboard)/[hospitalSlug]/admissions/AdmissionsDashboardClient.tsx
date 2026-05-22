"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { safeParseInt } from "@/lib/utils/formatting";
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
import { Select } from "@/components/ui/select";
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

  // State managers
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Selection states
  const [selectedBed, setSelectedBed] = useState<BedDataRow | null>(null);
  
  // Track client-side added vitals to merge with server data without mirror-state anti-patterns
  const [clientAddedVitals, setClientAddedVitals] = useState<Record<string, VitalRecord[]>>({});

  // Compute the combined flowsheet dynamically in-render
  const combinedVitalsHistory = useMemo(() => {
    const result: Record<string, VitalRecord[]> = { ...vitalsHistory };
    
    Object.keys(clientAddedVitals).forEach((patientId) => {
      const allRecords = [...(clientAddedVitals[patientId] || []), ...(result[patientId] || [])];
      
      // Deduplicate on-the-fly by record ID to prevent double-rendering after router.refresh()
      result[patientId] = Array.from(
        new Map(allRecords.map(item => [item.id, item])).values()
      ).sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    });
    
    return result;
  }, [vitalsHistory, clientAddedVitals]);
  
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
        toast.error(res.error || "Failed to search patients.");
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
        // Reload data
        router.refresh();
        // Update selectedBed reference to update the flowsheet panel on the fly
        if (selectedBed.patientId) {
          const recordToAppend: VitalRecord = {
            id: (res as { vitalId?: string }).vitalId || Math.random().toString(),
            patientId: selectedBed.patientId,
            recordedAt: new Date(),
            bloodPressureSystolic: safeParseInt(vitalsInput.bpSystolic) ?? null,
            bloodPressureDiastolic: safeParseInt(vitalsInput.bpDiastolic) ?? null,
            heartRate: safeParseInt(vitalsInput.heartRate) ?? null,
            respiratoryRate: safeParseInt(vitalsInput.respiratoryRate) ?? null,
            temperature: vitalsInput.temperature || null,
            oxygenSaturation: safeParseInt(vitalsInput.oxygenSaturation) ?? null,
            weightKg: vitalsInput.weightKg || null,
            heightCm: safeParseInt(vitalsInput.heightCm) ?? null,
            recorderNameAr: isRtl ? "الطاقم الطبي الحالي" : "Current Medical Staff",
            recorderNameEn: "Current Medical Staff",
          };
          setClientAddedVitals(prev => ({
            ...prev,
            [selectedBed.patientId!]: [recordToAppend, ...(prev[selectedBed.patientId!] || [])]
          }));
        }
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
    if (!date) return "";
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
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Layers className="h-5 w-5 animate-pulse" />
            </span>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              {t("title")}
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-xl">
            {isRtl 
              ? "متابعة السعة الاستيعابية الحالية للقسم الداخلي، ومراقبة حالة إشغال الأسرة، والتدفق الفوري للمؤشرات الحيوية لمرضى المنشأة." 
              : "Track live inpatient capacity, manage floor bed maps, schedule new admissions, and audit patient flowsheet trends."}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => router.refresh()}
            variant="outline"
            className="rounded-xl border-slate-200/80 bg-white hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="h-4 w-4 text-slate-600 me-2" />
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
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                {t("totalBeds")}
              </p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                {totalBeds}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <BedIcon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Occupied Beds */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                {t("occupiedBeds")}
              </p>
              <h3 className="text-3xl font-black text-blue-600 tracking-tight">
                {occupiedBeds}
              </h3>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-2xl text-blue-500">
              <UserCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Available Beds */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                {t("availableBeds")}
              </p>
              <h3 className="text-3xl font-black text-emerald-600 tracking-tight">
                {availableBeds}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Cleaning */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden text-start">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                {t("pendingCleaning")}
              </p>
              <h3 className="text-3xl font-black text-amber-500 tracking-tight">
                {pendingCleaningBeds}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-500">
              <Clock className="h-6 w-6 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden text-start col-span-2 lg:col-span-1">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-2 flex-1 me-2">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                {t("occupancyRate")}
              </p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-3xl font-black text-purple-600 tracking-tight">
                  {occupancyRate}%
                </h3>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${occupancyRate}%` }}
                />
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
              <Gauge className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Main Bed Map Grid Container */}
      <main className="space-y-8">
        {roomsWithBedsMap.length === 0 ? (
          <Card className="rounded-2xl border border-slate-100 p-12 bg-white text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-slate-50 text-slate-400">
                <BedIcon className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {isRtl ? "لم يتم تعريف أية غرف أو أسرة بعد في هذه المنشأة" : "No Rooms or Beds Registered Yet"}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                {isRtl 
                  ? "يرجى التوجه لإعدادات المستشفى أو الدعم لإضافة غرف وأسرة للقسم الداخلي." 
                  : "Please configure your hospital wards and add clinical rooms under the system configuration guide."}
              </p>
            </CardContent>
          </Card>
        ) : (
          roomsWithBedsMap.map((room) => (
            <Card key={room.id} className="rounded-2xl border border-slate-100/80 shadow-sm bg-white overflow-hidden text-start">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-lg">
                      {isRtl ? `غرفة ${room.roomNumber}` : `Room ${room.roomNumber}`}
                    </span>
                    <Badge variant="outline" className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 border-slate-200 capitalize">
                      {room.type}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{isRtl ? `الطابق: ${room.floor}` : `Floor: ${room.floor}`}</span>
                    {room.wing && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                        <span>{isRtl ? `الجناح: ${room.wing}` : `Wing: ${room.wing}`}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge className="rounded-full bg-slate-200/80 text-slate-600 px-3 py-1 text-xs border-none font-bold">
                  {isRtl ? `${room.beds.length} أسرة` : `${room.beds.length} Beds`}
                </Badge>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {room.beds.map((bed) => {
                    // Decide color styling based on bed status
                    let statusColor = "border-emerald-200 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50";
                    let statusBadge = "bg-emerald-100 text-emerald-800";
                    let patientName = "";

                    if (bed.status === "occupied") {
                      statusColor = "border-blue-200 text-blue-800 bg-blue-50/50 hover:bg-blue-100/50";
                      statusBadge = "bg-blue-100 text-blue-800";
                      patientName = isRtl ? (bed.patientNameAr || bed.patientNameEn || "") : (bed.patientNameEn || "");
                    } else if (bed.status === "pending_cleaning") {
                      statusColor = "border-amber-200 text-amber-800 bg-amber-50/50 hover:bg-amber-100/50 cursor-not-allowed";
                      statusBadge = "bg-amber-100 text-amber-800";
                    } else if (bed.status === "maintenance") {
                      statusColor = "border-slate-200 text-slate-800 bg-slate-50/50 cursor-not-allowed";
                      statusBadge = "bg-slate-200 text-slate-600";
                    }

                    return (
                      <button
                        key={bed.bedId}
                        onClick={() => handleBedClick(bed)}
                        className={`flex flex-col justify-between p-4 rounded-xl border border-dashed transition-all text-start w-full relative outline-none focus:ring-2 focus:ring-blue-500 h-28 group ${statusColor}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-black text-sm flex items-center gap-1.5">
                            <BedIcon className="h-4 w-4 text-slate-400 group-hover:scale-110 transition-transform" />
                            {isRtl ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}
                          </span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full capitalize ${statusBadge}`}>
                            {t(bed.status)}
                          </span>
                        </div>

                        {bed.status === "occupied" ? (
                          <div className="mt-3 space-y-1 flex-1 flex flex-col justify-end">
                            <p className="text-xs font-black truncate max-w-full text-slate-900 group-hover:text-blue-700 transition-colors">
                              {patientName}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {bed.patientNumber || ""}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 text-[10px] text-slate-400 flex flex-col justify-end flex-1">
                            {bed.status === "available" ? (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <Plus className="h-3 w-3" />
                                {isRtl ? "اضغط للإدخال" : "Click to Admit"}
                              </span>
                            ) : bed.status === "pending_cleaning" ? (
                              <span className="text-amber-600 font-bold">{isRtl ? "بانتظار التعقيم" : "Cleaning Queue"}</span>
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
      <Dialog isOpen={isAdmitOpen} onClose={() => setIsAdmitOpen(false)}>
        <DialogHeader onClose={() => setIsAdmitOpen(false)} className="text-start space-y-1.5">
          <DialogTitle className="text-xl font-extrabold text-slate-950 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
              <UserCheck className="h-5 w-5" />
            </span>
            {t("admitPatient")}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isRtl 
              ? "سجل إدخال مريض جديد للقسم الداخلي، واختر الطبيب المعالج والسرير المناسب." 
              : "Record patient admission details, assign physician, and confirm physical bed allocations."}
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-6 text-start" dir={isRtl ? "rtl" : "ltr"}>
          {/* Bed Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">{t("selectBed")}</label>
            {selectedBed && targetBedId === selectedBed.bedId ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex justify-between items-center font-bold text-slate-700">
                <span>
                  {isRtl 
                    ? `غرفة ${selectedBed.roomNumber} · سرير ${selectedBed.bedNumber} (${selectedBed.roomType})` 
                    : `Room ${selectedBed.roomNumber} · Bed ${selectedBed.bedNumber} (${selectedBed.roomType})`}
                </span>
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {isRtl ? "محدد" : "Locked"}
                </Badge>
              </div>
            ) : (
              <Select value={targetBedId} onChange={(e) => setTargetBedId(e.target.value)}>
                <option value="" disabled className="text-xs text-muted-foreground">
                  {isRtl ? "اختر سريراً متاحاً..." : "Select an available bed..."}
                </option>
                {availableBedsList.map((b) => (
                  <option key={b.bedId} value={b.bedId} className="text-xs">
                    {isRtl 
                      ? `غرفة ${b.roomNumber} · سرير ${b.bedNumber} (${b.roomType})` 
                      : `Room ${b.roomNumber} · Bed ${b.bedNumber} (${b.roomType})`}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Patient Search */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700">{t("selectPatient")}</label>
            {selectedPatient ? (
              <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 text-xs flex justify-between items-center">
                <div className="space-y-1">
                  <p className="font-extrabold text-blue-900">
                    {isRtl ? selectedPatient.nameAr : selectedPatient.nameEn}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {selectedPatient.patientNumber} · {selectedPatient.nationalId || (isRtl ? "جواز سفر" : "Passport")}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedPatient(null)}
                  className="text-[11px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg px-2 h-7"
                >
                  {isRtl ? "تغيير" : "Change"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute top-3.5 h-4 w-4 text-slate-400 start-3" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    className="rounded-xl border-slate-200/80 shadow-sm h-11 text-xs text-start ps-9 pe-4"
                  />
                </div>
                {isSearchingPatients && (
                  <div className="text-xs text-slate-400 italic ps-1 flex items-center gap-1.5 mt-1">
                    <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                    {isRtl ? "جاري البحث..." : "Searching directory..."}
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto bg-slate-50/50 mt-1">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="w-full p-3 text-start hover:bg-white border-b border-slate-100/50 last:border-b-0 transition-colors flex items-center justify-between text-xs outline-none"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">{isRtl ? p.nameAr : p.nameEn}</p>
                          <p className="text-[10px] text-slate-400">{p.patientNumber} · {p.nationalId || ""}</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800 rounded-full text-[10px] font-black border-none px-2 py-0.5">
                          {isRtl ? "اختر" : "Select"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {patientQuery.trim() && !isSearchingPatients && searchResults.length === 0 && (
                  <p className="text-[10px] text-slate-400 italic ps-1 mt-1">
                    {isRtl ? "لا توجد نتائج بحث مطابقة." : "No matching patient folders found."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Admitting Physician */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">{t("selectDoctor")}</label>
            <Select value={admittingDoctorId} onChange={(e) => setAdmittingDoctorId(e.target.value)}>
              <option value="" disabled className="text-xs text-muted-foreground">
                {isRtl ? "اختر الطبيب المسؤول..." : "Select admitting physician..."}
              </option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id} className="text-xs">
                  {isRtl ? doc.nameAr : doc.nameEn} {doc.licenseNumber ? `(${doc.licenseNumber})` : ""}
                </option>
              ))}
            </Select>
          </div>

          {/* Admission Reason */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">{t("admissionReason")}</label>
            <Textarea
              placeholder={isRtl ? "اكتب تفاصيل الشكوى الطبية والداعي للإدخال للقسم الداخلي..." : "Enter symptoms, medical indicators or notes justifying ward admission..."}
              value={admissionReason}
              onChange={(e) => setAdmissionReason(e.target.value)}
              className="rounded-xl border-slate-200/80 shadow-sm min-h-20 text-xs text-start"
            />
          </div>
        </DialogContent>

        <DialogFooter className="gap-2 sm:gap-0 mt-6" dir={isRtl ? "rtl" : "ltr"}>
          <Button
            variant="outline"
            onClick={() => setIsAdmitOpen(false)}
            className="rounded-xl border-slate-200/80 hover:bg-slate-50 text-xs h-10 px-5"
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
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <DrawerHeader onClose={() => setIsDrawerOpen(false)} className="text-start border-b border-slate-100 pb-4 px-6 sm:px-12 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
            <div className="space-y-1 text-start">
              <DrawerTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600">
                  <Activity className="h-5 w-5 animate-pulse" />
                </span>
                {selectedBed ? (isRtl ? selectedBed.patientNameAr : selectedBed.patientNameEn) : ""}
              </DrawerTitle>
              <DrawerDescription className="text-xs text-slate-500 font-medium">
                {selectedBed ? (
                  isRtl 
                    ? `سرير ${selectedBed.bedNumber} · غرفة ${selectedBed.roomNumber} (${selectedBed.roomType})` 
                    : `Bed ${selectedBed.bedNumber} · Room ${selectedBed.roomNumber} (${selectedBed.roomType})`
                ) : ""}
              </DrawerDescription>
            </div>

            {selectedBed && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="bg-blue-50 text-blue-800 border-none px-3 py-1 font-bold rounded-full">
                  {selectedBed.patientNumber}
                </Badge>
                <Badge className="bg-slate-50 text-slate-600 border border-slate-100 px-3 py-1 font-medium rounded-full">
                  {selectedBed.gender === "male" ? (isRtl ? "ذكر" : "Male") : (isRtl ? "أنثى" : "Female")} · {getAge(selectedBed.dob)}
                </Badge>
                {selectedBed.nationalId && (
                  <Badge className="bg-slate-50 text-slate-600 border border-slate-100 px-3 py-1 font-mono rounded-full">
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
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Thermometer className="h-4.5 w-4.5 text-blue-500" />
                  {t("vitalsFlowsheet")}
                </h4>

                <Button
                  onClick={() => setIsVitalsOpen(!isVitalsFormExpanded)}
                  variant="outline"
                  className="rounded-xl border-blue-200 bg-blue-50/30 text-blue-700 hover:bg-blue-50 text-xs py-1 h-8 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5 me-1" />
                  {isVitalsFormExpanded ? (isRtl ? "إغلاق النموذج" : "Close Form") : t("recordVitals")}
                </Button>
              </div>

              {/* RECORD VITALS: Collapsible Form panel */}
              {isVitalsFormExpanded && (
                <Card className="rounded-2xl border border-blue-100 bg-blue-50/20 p-5 shadow-sm text-start animate-fade-in">
                  <form onSubmit={handleRecordVitals} className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {/* Systolic BP */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "الضغط الانقباضي" : "Systolic BP"}</label>
                        <Input
                          placeholder="120"
                          type="number"
                          value={vitalsInput.bpSystolic}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, bpSystolic: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>

                      {/* Diastolic BP */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "الضغط الانبساطي" : "Diastolic BP"}</label>
                        <Input
                          placeholder="80"
                          type="number"
                          value={vitalsInput.bpDiastolic}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, bpDiastolic: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>

                      {/* Heart Rate */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "نبض القلب" : "Heart Rate (bpm)"}</label>
                        <Input
                          placeholder="72"
                          type="number"
                          value={vitalsInput.heartRate}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, heartRate: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>

                      {/* Respiratory Rate */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "معدل التنفس" : "Resp. Rate (bpm)"}</label>
                        <Input
                          placeholder="16"
                          type="number"
                          value={vitalsInput.respiratoryRate}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, respiratoryRate: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>

                      {/* Temperature */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "درجة الحرارة" : "Body Temp (°C)"}</label>
                        <Input
                          placeholder="36.8"
                          value={vitalsInput.temperature}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, temperature: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>

                      {/* Oxygen Saturation */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "الأكسجين SpO2" : "SpO2 (%)"}</label>
                        <Input
                          placeholder="98"
                          type="number"
                          value={vitalsInput.oxygenSaturation}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, oxygenSaturation: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>

                      {/* Weight */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "الوزن (كجم)" : "Weight (kg)"}</label>
                        <Input
                          placeholder="70"
                          value={vitalsInput.weightKg}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, weightKg: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>

                      {/* Height */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700">{isRtl ? "الطول (سم)" : "Height (cm)"}</label>
                        <Input
                          placeholder="170"
                          type="number"
                          value={vitalsInput.heightCm}
                          onChange={(e) => setVitalsInput({ ...vitalsInput, heightCm: e.target.value })}
                          className="rounded-lg bg-white border-slate-200 shadow-sm h-9 text-xs text-start"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsVitalsOpen(false)}
                        className="rounded-xl hover:bg-slate-100 text-xs h-9 px-4"
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
              {selectedBed && selectedBed.patientId && combinedVitalsHistory[selectedBed.patientId]?.length > 0 ? (
                <div className="border border-slate-100/80 rounded-2xl overflow-hidden bg-white shadow-sm overflow-x-auto text-start">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-600">
                      <tr>
                        <th className="p-3 text-start">{isRtl ? "تاريخ القياس" : "Recorded At"}</th>
                        <th className="p-3 text-center">{isRtl ? "ضغط الدم" : "BP"}</th>
                        <th className="p-3 text-center">{isRtl ? "النبض" : "HR"}</th>
                        <th className="p-3 text-center">{isRtl ? "التنفس" : "RR"}</th>
                        <th className="p-3 text-center">{isRtl ? "درجة الحرارة" : "Temp"}</th>
                        <th className="p-3 text-center">{isRtl ? "الأكسجين" : "SpO2"}</th>
                        <th className="p-3 text-center">{isRtl ? "الوزن/الطول" : "Wt/Ht"}</th>
                        <th className="p-3 text-start hidden sm:table-cell">{isRtl ? "بواسطة" : "Staff Member"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {combinedVitalsHistory[selectedBed.patientId].map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-semibold text-slate-500 whitespace-nowrap">
                            {formatDate(v.recordedAt)}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800">
                            {v.bloodPressureSystolic && v.bloodPressureDiastolic 
                              ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
                              : "—"}
                          </td>
                          <td className="p-3 text-center font-bold text-blue-600">
                            {v.heartRate ? `${v.heartRate} bpm` : "—"}
                          </td>
                          <td className="p-3 text-center text-slate-700">
                            {v.respiratoryRate ? `${v.respiratoryRate}/m` : "—"}
                          </td>
                          <td className="p-3 text-center font-bold text-amber-600">
                            {v.temperature ? `${v.temperature}°C` : "—"}
                          </td>
                          <td className="p-3 text-center font-black text-emerald-600">
                            {v.oxygenSaturation ? `${v.oxygenSaturation}%` : "—"}
                          </td>
                          <td className="p-3 text-center text-slate-500 whitespace-nowrap">
                            {v.weightKg ? `${v.weightKg}kg` : "—"} / {v.heightCm ? `${v.heightCm}cm` : "—"}
                          </td>
                          <td className="p-3 text-start text-slate-400 truncate hidden sm:table-cell max-w-[120px]">
                            {isRtl ? v.recorderNameAr : v.recorderNameEn}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50/30 text-center text-slate-400">
                  <Activity className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs">{isRtl ? "لا توجد قياسات علامات حيوية مسجلة بعد لهذا المريض" : "No vital flowsheet measurements logged yet."}</p>
                </div>
              )}
            </div>

            {/* Right Column (1/3 width) - Patient Admission Info and Discharging Form */}
            <div className="space-y-6">
              <Card className="rounded-2xl border border-slate-100 bg-slate-50/40 p-5 shadow-sm text-start">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1">
                  <FileText className="h-4 w-4 text-slate-500" />
                  {isRtl ? "تفاصيل حالة الإدخال" : "Admission Parameters"}
                </h4>

                {selectedBed && (
                  <div className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">{t("admissionDate")}</label>
                      <p className="font-bold text-slate-800">{formatDate(selectedBed.admissionDate)}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">{t("admittingDoctor")}</label>
                      <p className="font-bold text-slate-800">{isRtl ? selectedBed.doctorNameAr : selectedBed.doctorNameEn}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">{t("admissionReason")}</label>
                      <p className="text-slate-600 bg-white p-3 rounded-lg border border-slate-100 mt-1 shadow-sm leading-relaxed whitespace-pre-wrap">
                        {selectedBed.reason}
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {/* DISCHARGE WORKFLOW WORKSPACE */}
              <Card className="rounded-2xl border border-red-100 bg-red-50/10 p-5 shadow-sm text-start">
                <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <LogOut className="h-4 w-4" />
                  {t("dischargePatient")}
                </h4>

                <div className="space-y-4">
                  {/* Select Discharge Condition */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700">{t("dischargeCondition")}</label>
                    <Select 
                      value={dischargeCondition} 
                      onChange={(e) => setDischargeCondition(e.target.value as "stable" | "improved" | "referred" | "deceased")}
                    >
                      <option value="stable" className="text-xs">{t("conditionStable")}</option>
                      <option value="improved" className="text-xs">{t("conditionImproved")}</option>
                      <option value="referred" className="text-xs">{t("conditionReferred")}</option>
                      <option value="deceased" className="text-xs">{t("conditionDeceased")}</option>
                    </Select>
                  </div>

                  {/* Follow-up Instructions */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700">{t("followUpInstructions")}</label>
                    <Textarea
                      placeholder={isRtl ? "اكتب الخطة العلاجية للمنزل ومواعيد المراجعة والأدوية المصروفة..." : "Enter patient discharge instructions, home medication plans and clinic revisits..."}
                      value={followUpInstructions}
                      onChange={(e) => setFollowUpInstructions(e.target.value)}
                      className="rounded-xl border-slate-200 bg-white shadow-sm min-h-16 text-xs text-start leading-relaxed"
                    />
                  </div>

                  {/* Medical Summary Arabic (MOH Requirement) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      {t("summaryAr")}
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 rounded text-[9px] px-1 py-0 border-none font-bold">MOH</Badge>
                    </label>
                    <Textarea
                      placeholder="الملخص الطبي للحالة المرضية والإجراءات المتخذة بالتفصيل..."
                      value={summaryAr}
                      onChange={(e) => setSummaryAr(e.target.value)}
                      className="rounded-xl border-slate-200 bg-white shadow-sm min-h-20 text-xs text-start leading-relaxed"
                    />
                  </div>

                  {/* Medical Summary English */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      {t("summaryEn")}
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 rounded text-[9px] px-1 py-0 border-none font-bold">MOH</Badge>
                    </label>
                    <Textarea
                      placeholder="Comprehensive english medical case brief, treatment details and clinical decisions..."
                      value={summaryEn}
                      onChange={(e) => setSummaryEn(e.target.value)}
                      className="rounded-xl border-slate-200 bg-white shadow-sm min-h-20 text-xs text-start leading-relaxed"
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

        <DrawerFooter className="border-t border-slate-100 py-4 px-6 sm:px-12 shrink-0 flex flex-row justify-end" dir={isRtl ? "rtl" : "ltr"}>
          <Button 
            variant="outline" 
            className="rounded-xl border-slate-200 text-xs h-10 px-6"
            onClick={() => setIsDrawerOpen(false)}
          >
            {isRtl ? "إغلاق النافذة" : "Close Portal"}
          </Button>
        </DrawerFooter>
      </Drawer>
    </div>
  );
}
