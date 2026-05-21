"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter
} from "@/components/ui/drawer";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  AlertCircle,
  Activity,
  HeartPulse,
  User,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrSchedule, createSurgicalCase } from "@/lib/actions/surgical";

interface SurgicalScheduleClientProps {
  surgeons: { id: string; nameAr: string; nameEn: string }[];
  anesthesiologists: { id: string; nameAr: string; nameEn: string }[];
  patients: { id: string; nameAr: string; nameEn: string; patientNumber: string }[];
  hospitalSlug: string;
  locale: string;
}

export function SurgicalScheduleClient({
  surgeons,
  anesthesiologists,
  patients,
  hospitalSlug,
  locale,
}: SurgicalScheduleClientProps) {
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected daily timeline date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Daily calendar data
  const [rooms, setRooms] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick book modal state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedSurgeonId, setSelectedSurgeonId] = useState("");
  const [selectedAnesthesiologistId, setSelectedAnesthesiologistId] = useState("");
  const [procedureAr, setProcedureAr] = useState("");
  const [procedureEn, setProcedureEn] = useState("");
  const [cptCode, setCptCode] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [anesthesiaType, setAnesthesiaType] = useState<string>("general");
  const [asaClass, setAsaClass] = useState<string>("ASA_I");
  
  // Emergency override bypasses
  const [bypassBlocks, setBypassBlocks] = useState(false);
  const [justification, setJustification] = useState("");
  const [validationError, setValidationError] = useState("");

  // Case details drawer state
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Time-slot calculation parameters
  const startHour = 7;
  const endHour = 22;
  const totalHours = endHour - startHour; // 15 hours timeline
  const columnWidth = 100; // 100px per hour
  const timelineWidth = totalHours * columnWidth; // 1500px total grid width

  // Fetch rooms, blocks, and cases for selected date
  const loadScheduleData = async () => {
    setLoading(true);
    const res = await getOrSchedule(selectedDate);
    if (res.success && "rooms" in res) {
      setRooms(res.rooms || []);
      setBlocks(res.blocks || []);
      setCases(res.cases || []);
    } else {
      const errorMsg = res && "error" in res ? (res as any).error : "Failed to load schedule board";
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadScheduleData();
  }, [selectedDate]);

  // Position calculation helper for grid cards
  const getTimeOffsetAndWidth = (startTimeStr: string, durationMinutes: number) => {
    const parts = startTimeStr.split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const timeInHours = h + m / 60;

    const clampedStart = Math.max(startHour, Math.min(endHour, timeInHours));
    const durationInHours = durationMinutes / 60;
    const clampedEnd = Math.max(startHour, Math.min(endHour, timeInHours + durationInHours));

    const left = (clampedStart - startHour) * columnWidth;
    const width = (clampedEnd - clampedStart) * columnWidth;

    return { left, width };
  };

  // Convert time-slot click to prefilled form
  const handleTimelineCellClick = (roomId: string, hour: number) => {
    setSelectedRoomId(roomId);
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    setScheduledTime(timeStr);
    setBypassBlocks(false);
    setJustification("");
    setValidationError("");
    setIsBookModalOpen(true);
  };

  // Submit quick surgery form
  const handleBookSurgery = () => {
    setValidationError("");

    if (!selectedPatientId || !selectedRoomId || !selectedSurgeonId || !scheduledTime || !duration) {
      setValidationError(isRtl ? "يرجى تعبئة كافة الحقول الإلزامية." : "Please fill in all required fields.");
      return;
    }

    const [h, m] = scheduledTime.split(":").map(Number);
    const [year, month, dayNum] = selectedDate.split("-").map(Number);
    const scheduledAt = new Date(year, month - 1, dayNum, h, m, 0, 0);

    const data = {
      patientId: selectedPatientId,
      orRoomId: selectedRoomId,
      leadSurgeonId: selectedSurgeonId,
      assistantSurgeonIds: [],
      anesthesiologistId: selectedAnesthesiologistId || undefined,
      procedureNameAr: procedureAr.trim() || (isRtl ? "عملية جراحية روتينية" : "Routine Surgical Procedure"),
      procedureNameEn: procedureEn.trim() || (isRtl ? "Routine Surgery" : "Routine Surgical Procedure"),
      cptCode: cptCode.trim() || undefined,
      scheduledAt,
      estimatedDuration: Number(duration),
      anesthesiaType: anesthesiaType as any,
      asaClass: asaClass,
    };

    startTransition(async () => {
      const res = await createSurgicalCase(data, bypassBlocks, justification);
      if (res.success) {
        setIsBookModalOpen(false);
        // Reset states
        setSelectedPatientId("");
        setSelectedSurgeonId("");
        setSelectedAnesthesiologistId("");
        setProcedureAr("");
        setProcedureEn("");
        setCptCode("");
        setScheduledTime("");
        setBypassBlocks(false);
        setJustification("");
        loadScheduleData();
        router.refresh();
      } else {
        const errorMsg = res && "error" in res ? res.error : "حدث خطأ أثناء جدولة العملية.";
        setValidationError(errorMsg);
      }
    });
  };

  const handlePrevDay = () => {
    const [year, month, dayNum] = selectedDate.split("-").map(Number);
    const d = new Date(year, month - 1, dayNum);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleNextDay = () => {
    const [year, month, dayNum] = selectedDate.split("-").map(Number);
    const d = new Date(year, month - 1, dayNum);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  // Status style helpers for surgery cases
  const getCaseStatusStyle = (status: string, leadNotes: string | null) => {
    // Glowing crimson overrides for Emergency/Bypass cases
    if (leadNotes && leadNotes.includes("[حالة طارئة")) {
      return "bg-red-500/10 hover:bg-red-500/15 border-red-500/50 text-red-900 shadow-sm animate-pulse ring-1 ring-red-500/30";
    }

    switch (status) {
      case "active":
      case "in_progress":
        return "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/40 text-amber-900";
      case "completed":
        return "bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-900";
      case "postponed":
        return "bg-violet-500/10 hover:bg-violet-500/15 border-violet-500/30 text-violet-900";
      default:
        return "bg-blue-500/10 hover:bg-blue-500/15 border-blue-500/30 text-blue-900";
    }
  };

  return (
    <div className="space-y-6">
      {/* Date controller and Emergency trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-2xl border border-border/40 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handlePrevDay} className="h-9 px-2.5">
            {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          
          <div className="relative">
            <CalendarIcon className="absolute top-[11px] start-3 h-4 w-4 text-muted-foreground/60" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="ps-9 h-9 text-xs font-black font-mono w-44"
            />
          </div>

          <Button variant="outline" size="sm" onClick={handleNextDay} className="h-9 px-2.5">
            {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>

          <span className="font-mono text-[10px] text-muted-foreground font-bold hidden md:inline bg-muted/40 p-2 rounded-lg">
            {(() => {
              const [year, month, dayNum] = selectedDate.split("-").map(Number);
              return new Date(year, month - 1, dayNum).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            })()}
          </span>
        </div>

        {/* Emergency Add action button */}
        <Button
          onClick={() => {
            setSelectedRoomId(rooms[0]?.id || "");
            setScheduledTime("08:00");
            setBypassBlocks(true);
            setJustification("");
            setIsBookModalOpen(true);
          }}
          className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white h-9 px-4 gap-1.5 self-stretch sm:self-auto shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>{isRtl ? "جدولة حالة طارئة 🚨" : "Emergency Add 🚨"}</span>
        </Button>
      </div>

      {/* Main Board Space */}
      <Card className="rounded-2xl border border-border/30 overflow-hidden shadow-xs">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center text-xs text-muted-foreground italic">
              {isRtl ? "جاري استرداد جدول غرف العمليات والمسارات الزمنية..." : "Loading Operating Rooms Schedule Board..."}
            </div>
          ) : rooms.length === 0 ? (
            <div className="p-16 text-center text-xs text-muted-foreground italic">
              {isRtl ? "عذراً! لا توجد غرف عمليات مسجلة أو مفعّلة في منشأتك." : "No active operating rooms found."}
            </div>
          ) : (
            /* Horizontal Timeline Scroller */
            <div className="overflow-x-auto scrollbar-thin">
              <div style={{ width: `${timelineWidth + 240}px` }} className="flex flex-col divide-y divide-border/20">
                {/* Timeline Grid Hours Header */}
                <div className="flex bg-muted/30 text-[10px] font-bold text-muted-foreground">
                  {/* Left spacer for operating room labels */}
                  <div className="w-60 p-3 shrink-0 bg-muted/50 border-e border-border/30 font-black text-xs text-foreground uppercase tracking-wider">
                    {isRtl ? "جناح / غرف العمليات" : "Operating Theater"}
                  </div>

                  {/* Hourly labels */}
                  {Array.from({ length: totalHours }).map((_, i) => {
                    const h = startHour + i;
                    return (
                      <div 
                        key={h} 
                        style={{ width: `${columnWidth}px` }} 
                        className="p-3 shrink-0 text-center border-e border-border/10 font-mono font-bold"
                      >
                        {String(h).padStart(2, "0")}:00
                      </div>
                    );
                  })}
                </div>

                {/* Operating Rooms Timeline Rows */}
                {rooms.map((room) => {
                  const roomBlocks = blocks.filter((b) => b.orRoomId === room.id);
                  const roomCases = cases.filter((c) => c.orRoomId === room.id);

                  return (
                    <div key={room.id} className="flex min-h-[90px] relative items-stretch group">
                      {/* Left Side: Room Label & Spec */}
                      <div className="w-60 p-4 shrink-0 bg-muted/15 border-e border-border/30 flex flex-col justify-center items-start text-start gap-1">
                        <span className="font-black text-sm text-foreground">
                          {isRtl ? room.nameAr : room.nameEn}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                          <HeartPulse className="h-3 w-3 text-accent" />
                          {room.floor} {isRtl ? "طابق" : "Floor"} • {room.type}
                        </span>
                      </div>

                      {/* Right Side: Relative horizontal absolute space */}
                      <div style={{ width: `${timelineWidth}px` }} className="relative shrink-0 flex items-stretch">
                        {/* Background columns click targets */}
                        {Array.from({ length: totalHours }).map((_, i) => {
                          const h = startHour + i;
                          return (
                            <button
                              key={h}
                              style={{ width: `${columnWidth}px` }}
                              onClick={() => handleTimelineCellClick(room.id, h)}
                              className="shrink-0 border-e border-border/10 hover:bg-muted/10 transition-colors duration-150 relative h-full outline-hidden"
                            />
                          );
                        })}

                        {/* Rendering Block exclusions as gray blocks */}
                        {roomBlocks.map((block) => {
                          const { left, width } = getTimeOffsetAndWidth(block.startTime, 360); // 6 hours default block
                          return (
                            <div
                              key={block.id}
                              style={{ left: `${left}px`, width: `${width}px` }}
                              className="absolute top-1 bottom-1 p-2 bg-gray-500/5 hover:bg-gray-500/10 border-s-2 border-s-gray-500/40 text-start flex flex-col justify-center text-[10px] select-none text-muted-foreground/80 overflow-hidden pointer-events-none"
                            >
                              <span className="font-bold flex items-center gap-1">
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                {isRtl ? block.blockName : "OR Block Slot"}
                              </span>
                              <span className="text-[9px] font-semibold truncate">
                                {isRtl ? block.departmentNameAr : block.departmentNameEn}
                              </span>
                            </div>
                          );
                        })}

                        {/* Rendering Scheduled Surgical Cases */}
                        {roomCases.map((sc) => {
                          const { left, width } = getTimeOffsetAndWidth(sc.scheduledStartTime, sc.estimatedDurationMinutes);
                          const isEmergency = sc.notes && sc.notes.includes("[حالة طارئة");

                          return (
                            <button
                              key={sc.id}
                              onClick={() => {
                                setSelectedCase(sc);
                                setIsDetailDrawerOpen(true);
                              }}
                              style={{ left: `${left}px`, width: `${width}px` }}
                              className={cn(
                                "absolute top-1 bottom-1 p-2 rounded-lg border text-start flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-xs transition-all",
                                getCaseStatusStyle(sc.status, sc.notes)
                              )}
                            >
                              <div className="flex flex-col gap-0.5 w-full">
                                <div className="flex justify-between items-center gap-1">
                                  <span className="text-[8px] font-black tracking-wider uppercase bg-foreground/5 p-1 rounded-sm">
                                    {sc.caseNumber}
                                  </span>
                                  {isEmergency && (
                                    <Badge className="bg-red-600 text-white text-[8px] font-bold py-0 h-4 border-none">
                                      {isRtl ? "طارئة" : "Emergency"}
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-black text-foreground truncate text-[11px] mt-1 leading-snug">
                                  {isRtl ? sc.procedureNameAr : sc.procedureName}
                                </span>
                              </div>

                              <div className="text-[9px] text-muted-foreground/90 font-semibold flex justify-between items-center w-full truncate border-t border-foreground/5 pt-1">
                                <span className="truncate flex items-center gap-1">
                                  <User className="h-2.5 w-2.5 shrink-0" />
                                  د. {isRtl ? sc.surgeonNameAr : sc.surgeonNameEn}
                                </span>
                                <span className="font-mono text-[8px] font-black shrink-0 bg-background/40 p-0.5 rounded-xs">
                                  {sc.estimatedDurationMinutes}m
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Booking Dialog (OR Case Creator Wizard) */}
      <Dialog isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)}>
        <DialogContent className="sm:max-w-lg text-start">
          <DialogHeader className="text-start">
            <DialogTitle className={cn("text-lg font-black text-foreground flex items-center gap-1.5", bypassBlocks && "text-rose-700")}>
              {bypassBlocks ? "تسجيل حالة طارئة في جناح العمليات" : "جدولة حالة جراحية جديدة"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {isRtl 
                ? "إدراج وتسكين مريض مسجل في غرفة العمليات المحددة، وضبط التوقيت التلقائي وفريق الجراحة."
                : "Schedule surgical procedure, surgeon, anesthesiologist and clinic rooms."}
            </DialogDescription>
          </DialogHeader>

          {/* Validation Warnings */}
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex gap-1.5 items-start">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{validationError}</span>
            </div>
          )}

          {bypassBlocks && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 font-black flex gap-1.5 items-start animate-pulse">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <span>{isRtl ? "نظام تجاوز التعارض والكتل الزمنية مفعل!" : "Emergency Block Override Mode Active!"}</span>
                <p className="text-[10px] text-rose-900 font-bold mt-0.5">{isRtl ? "الحجز سيتخطى تلقائياً أي كتل جراحية أخرى محظورة أو حيازات غرف العمليات." : "This procedure bypasses standard timeline conflicts."}</p>
              </div>
            </div>
          )}

          <div className="space-y-4 py-3 text-xs max-h-[400px] overflow-y-auto">
            {/* Patient Select */}
            <div className="space-y-1">
              <label className="font-bold text-foreground block">{isRtl ? "المريض" : "Patient"}</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{isRtl ? "اختر مريضاً مسجلاً..." : "Select Patient..."}</option>
                {patients.map((pat) => (
                  <option key={pat.id} value={pat.id}>
                    {isRtl ? pat.nameAr : pat.nameEn} (#{pat.patientNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground block">{isRtl ? "غرفة العمليات" : "Operating Room"}</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{isRtl ? "اختر غرفة..." : "Select room..."}</option>
                {rooms.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {isRtl ? rm.nameAr : rm.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground block">{isRtl ? "الجراح الرئيسي" : "Lead Surgeon"}</label>
              <select
                value={selectedSurgeonId}
                onChange={(e) => setSelectedSurgeonId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{isRtl ? "اختر الطبيب الجراح..." : "Select Surgeon..."}</option>
                {surgeons.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {isRtl ? doc.nameAr : doc.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground block">{isRtl ? "طبيب التخدير" : "Anesthesiologist"}</label>
              <select
                value={selectedAnesthesiologistId}
                onChange={(e) => setSelectedAnesthesiologistId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{isRtl ? "اختر طبيب التخدير المتواجد..." : "Select Anesthesiologist..."}</option>
                {anesthesiologists.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {isRtl ? doc.nameAr : doc.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Procedure Arabic & English */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-foreground block">{isRtl ? "العملية (بالعربية)" : "Procedure (Ar)"}</label>
                <Input
                  placeholder={isRtl ? "استئصال المرارة بالمنظار..." : "Gallbladder removal..."}
                  value={procedureAr}
                  onChange={(e) => setProcedureAr(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground block">{isRtl ? "العملية (بالإنجليزية)" : "Procedure (En)"}</label>
                <Input
                  placeholder="Laparoscopic Cholecystectomy..."
                  value={procedureEn}
                  onChange={(e) => setProcedureEn(e.target.value)}
                  className="h-9 text-xs text-start"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Scheduled Time */}
              <div className="space-y-1 col-span-1">
                <label className="font-bold text-foreground block">{isRtl ? "توقيت البدء" : "Time"}</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              {/* Duration */}
              <div className="space-y-1 col-span-1">
                <label className="font-bold text-foreground block">{isRtl ? "المدة (دقائق)" : "Duration"}</label>
                <Input
                  type="number"
                  value={duration}
                  min={15}
                  max={720}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1 col-span-1">
                <label className="font-bold text-foreground block">{isRtl ? "التخدير" : "Anesthesia"}</label>
                <select
                  value={anesthesiaType}
                  onChange={(e) => setAnesthesiaType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="general">{isRtl ? "عام" : "General"}</option>
                  <option value="regional">{isRtl ? "ناحي" : "Regional"}</option>
                  <option value="local">{isRtl ? "موضعي" : "Local"}</option>
                  <option value="sedation">{isRtl ? "مهدئ" : "Sedation"}</option>
                  <option value="spinal">{isRtl ? "نخاعي" : "Spinal"}</option>
                </select>
              </div>
            </div>

            {/* Emergency Bypass trigger */}
            <div className="pt-3 border-t border-border/20 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bypassCheck"
                  checked={bypassBlocks}
                  onChange={(e) => setBypassBlocks(e.target.checked)}
                  className="h-4 w-4 accent-rose-600 rounded-sm cursor-pointer"
                />
                <label htmlFor="bypassCheck" className="font-black text-rose-700 cursor-pointer select-none">
                  {isRtl ? "حالة طارئة - تفعيل تجاوز تعارض الكتل الجراحية" : "Emergency Override - Bypass scheduling blocks"}
                </label>
              </div>

              {bypassBlocks && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="font-black text-rose-900 block">
                    {isRtl ? "المبرر الطبي/الإداري للتجاوز الإلزامي" : "Surgical Justification Reason (Required)"}
                  </label>
                  <Input
                    placeholder={isRtl ? "اكتب مبرر الحالة والتدخل الطارئ..." : "Enter surgery emergency reasons..."}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    className="h-10 text-xs border-rose-300 focus:border-rose-500 bg-rose-50/10 font-bold"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBookModalOpen(false)}
              className="text-xs font-bold"
            >
              {isRtl ? "إلغاء والرجوع" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleBookSurgery}
              className={cn("text-xs font-black px-4", bypassBlocks ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-accent text-accent-foreground hover:bg-accent/90")}
              disabled={isPending || (bypassBlocks && justification.trim().length < 5)}
            >
              {bypassBlocks ? (isRtl ? "تسجيل فوري طارئ" : "Bypass & Book Now") : (isRtl ? "حفظ وجدولة العملية" : "Schedule Case")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Details Drawer */}
      <Drawer isOpen={isDetailDrawerOpen} onClose={() => setIsDetailDrawerOpen(false)}>
        <DrawerContent className="text-start">
          <div className="mx-auto w-full max-w-lg p-6">
            {selectedCase && (
              <>
                <DrawerHeader className="border-b border-border/30 pb-4 text-start" onClose={() => setIsDetailDrawerOpen(false)}>
                  <div className="flex justify-between items-center gap-4 w-full">
                    <div>
                      <DrawerTitle className="text-lg font-black text-foreground">
                        {isRtl ? selectedCase.patientNameAr : selectedCase.patientNameEn}
                      </DrawerTitle>
                      <DrawerDescription className="text-xs text-muted-foreground font-mono mt-0.5">
                        #{selectedCase.patientNumber} • {isRtl ? "رقم الحالة: " : "Case: "} {selectedCase.caseNumber}
                      </DrawerDescription>
                    </div>
                    <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 font-black text-xs">
                      {selectedCase.status}
                    </Badge>
                  </div>
                </DrawerHeader>

                <div className="py-6 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-3 rounded-xl border border-border/10">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">
                        {isRtl ? "العملية المقررة" : "Surgical Procedure"}
                      </span>
                      <span className="font-black text-foreground text-sm leading-snug">
                        {isRtl ? selectedCase.procedureNameAr : selectedCase.procedureName}
                      </span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-xl border border-border/10">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">
                        {isRtl ? "الجراح المسؤول" : "Lead Surgeon"}
                      </span>
                      <span className="font-black text-foreground">
                        د. {isRtl ? selectedCase.surgeonNameAr : selectedCase.surgeonNameEn}
                      </span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-xl border border-border/10">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">
                        {isRtl ? "موعد التدخل" : "Surgical Time"}
                      </span>
                      <span className="font-mono font-black text-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3.5 w-3.5" />
                        {selectedCase.scheduledStartTime.substring(0, 5)} ({selectedCase.estimatedDurationMinutes} mins)
                      </span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-xl border border-border/10">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">
                        {isRtl ? "أسلوب التخدير" : "Anesthesia Type"}
                      </span>
                      <span className="font-black text-accent uppercase">
                        {selectedCase.anesthesiaType}
                      </span>
                    </div>
                  </div>

                  {/* Safety checklist mock triggers */}
                  <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/15">
                    <span className="text-[10px] text-emerald-700 font-bold block uppercase mb-1.5 flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      {isRtl ? "مؤشرات أمان سلامة الجراحة (WHO Checklist)" : "WHO Surgery Safety Checklist State"}
                    </span>
                    <div className="flex gap-2 text-[10px] font-bold text-center">
                      <div className="flex-1 bg-emerald-500 text-white p-2 rounded-lg">{isRtl ? "Sign-In (مكتمل)" : "Sign-In (Ok)"}</div>
                      <div className="flex-1 bg-emerald-500 text-white p-2 rounded-lg">{isRtl ? "Time-Out (مكتمل)" : "Time-Out (Ok)"}</div>
                      <div className="flex-1 bg-muted border border-border/40 text-muted-foreground p-2 rounded-lg">{isRtl ? "Sign-Out (معلق)" : "Sign-Out"}</div>
                    </div>
                  </div>

                  {selectedCase.notes && selectedCase.notes.includes("[حالة طارئة") && (
                    <div className="bg-red-500/5 p-3.5 rounded-xl border border-red-500/10 text-xs">
                      <span className="text-[10px] text-red-700 font-black uppercase block mb-1 flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {isRtl ? "مذكرة مبرر التدخل العاجل" : "Clinical Emergency Justification"}
                      </span>
                      <p className="text-rose-900 font-bold italic leading-relaxed">
                        "{selectedCase.notes}"
                      </p>
                    </div>
                  )}
                </div>

                <DrawerFooter className="border-t border-border/30 pt-4 flex gap-2">
                  <Button variant="outline" className="w-full text-xs font-bold" onClick={() => setIsDetailDrawerOpen(false)}>{isRtl ? "إغلاق التفاصيل" : "Close"}</Button>
                </DrawerFooter>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
