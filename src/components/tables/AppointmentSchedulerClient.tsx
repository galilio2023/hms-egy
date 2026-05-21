"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
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
  Search, 
  User, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Menu,
  BookOpen,
  Eye,
  Settings,
  CalendarRange
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toZonedTime } from "date-fns-tz";
import { 
  updateAppointmentStatus, 
  getWaitingList, 
  getDoctorAvailability, 
  scheduleFromWaitingList,
  addToWaitingList 
} from "@/lib/actions/appointments";

interface AppointmentSchedulerClientProps {
  initialAppointments: any[];
  departments: { id: string; nameAr: string; nameEn: string }[];
  doctors: { id: string; nameAr: string; nameEn: string }[];
  hospitalSlug: string;
  locale: string;
}

export function AppointmentSchedulerClient({
  initialAppointments,
  departments,
  doctors,
  hospitalSlug,
  locale,
}: AppointmentSchedulerClientProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();

  const [appointments, setAppointments] = useState<any[]>(initialAppointments);
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Active filters
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "week">("week");
  const [targetWeekStart, setTargetWeekStart] = useState<Date>(() => {
    const d = toZonedTime(new Date(), "Africa/Cairo");
    const day = d.getDay();
    const diff = d.getDate() - day; 
    return new Date(d.setDate(diff));
  });

  // Collapsible waiting list state
  const [showWaitingList, setShowWaitingList] = useState(false);

  // Selected appointment details drawer state
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Waiting list schedule converter modal state
  const [selectedWaitingEntry, setSelectedWaitingEntry] = useState<any | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleDoctorId, setScheduleDoctorId] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Fetch waiting list queue on load and when queue updates
  const loadWaitingList = async () => {
    const res = await getWaitingList();
    if (res.success && "data" in res) {
      setWaitingList(res.data);
    }
  };

  useEffect(() => {
    loadWaitingList();
  }, []);

  // Sync state with props
  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  // Load slots for the waiting list scheduling wizard
  useEffect(() => {
    if (scheduleDoctorId && scheduleDate) {
      setLoadingSlots(true);
      setSelectedSlot("");
      getDoctorAvailability(scheduleDoctorId, scheduleDate).then((res) => {
        if (res.success && "slots" in res) {
          setAvailableSlots(res.slots);
        } else {
          setAvailableSlots([]);
        }
        setLoadingSlots(false);
      });
    } else {
      setAvailableSlots([]);
    }
  }, [scheduleDoctorId, scheduleDate]);

  // Handle status update
  const handleStatusChange = (status: string) => {
    if (!selectedAppointment) return;
    startTransition(async () => {
      const res = await updateAppointmentStatus(
        selectedAppointment.id, 
        status, 
        status === "cancelled" ? cancelReason : undefined
      );
      if (res.success) {
        setAppointments((prev) => 
          prev.map((app) => 
            app.id === selectedAppointment.id 
              ? { ...app, status, cancellationReason: status === "cancelled" ? cancelReason : null } 
              : app
          )
        );
        setIsDetailDrawerOpen(false);
        setCancelReason("");
        setSelectedAppointment(null);
        router.refresh();
      } else {
        const errorMsg = res && "error" in res ? res.error : "Failed to update appointment status";
        toast.error(errorMsg);
      }
    });
  };

  // Convert waiting list entry to official appointment
  const handleScheduleFromWaiting = () => {
    if (!selectedWaitingEntry || !scheduleDoctorId || !scheduleDate || !selectedSlot) return;

    const [h, m] = selectedSlot.split(":").map(Number);
    const [year, month, dayNum] = scheduleDate.split("-").map(Number);
    const scheduledDateObj = new Date(year, month - 1, dayNum, h, m, 0, 0);

    const appointmentDetails = {
      patientId: selectedWaitingEntry.patientId,
      doctorId: scheduleDoctorId,
      departmentId: selectedWaitingEntry.departmentId,
      scheduledAt: scheduledDateObj,
      type: "consultation" as const,
      notes: `تمت الجدولة ترقيةً من طابور الانتظار: ${selectedWaitingEntry.notes || ""}`,
    };

    startTransition(async () => {
      const res = await scheduleFromWaitingList(selectedWaitingEntry.id, appointmentDetails);
      if (res.success) {
        setSelectedWaitingEntry(null);
        setScheduleDate("");
        setScheduleDoctorId("");
        setSelectedSlot("");
        loadWaitingList();
        router.refresh();
      } else {
        const errorMsg = res && "error" in res ? res.error : "خطأ أثناء جدولة الموعد.";
        toast.error(errorMsg);
      }
    });
  };

  // Local filter calculations
  const filteredAppointments = appointments.filter((app) => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchPatientAr = app.patientNameAr?.toLowerCase().includes(q);
      const matchPatientEn = app.patientNameEn?.toLowerCase().includes(q);
      const matchNum = app.patientNumber?.toLowerCase().includes(q);
      const matchPhone = app.patientPhone?.toLowerCase().includes(q);
      const matchDoctorAr = app.doctorNameAr?.toLowerCase().includes(q);
      const matchDoctorEn = app.doctorNameEn?.toLowerCase().includes(q);

      if (!matchPatientAr && !matchPatientEn && !matchNum && !matchPhone && !matchDoctorAr && !matchDoctorEn) {
        return false;
      }
    }

    if (selectedDept && app.departmentId !== selectedDept) return false;
    if (selectedDoctor && app.doctorId !== selectedDoctor) return false;
    if (selectedStatus && app.status !== selectedStatus) return false;

    return true;
  });

  const getWeekDates = (start: Date) => {
    const dates = [];
    const curr = new Date(start);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const weekDates = getWeekDates(targetWeekStart);

  const getAppointmentsForDate = (date: Date) => {
    return filteredAppointments.filter((app) => {
      const d = new Date(app.scheduledDate);
      return d.getFullYear() === date.getFullYear() &&
             d.getMonth() === date.getMonth() &&
             d.getDate() === date.getDate();
    });
  };

  const handlePrevWeek = () => {
    setTargetWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setTargetWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleRowClick = (app: any) => {
    setSelectedAppointment(app);
    setIsDetailDrawerOpen(true);
  };

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

  const renderTypeBadge = (type: string) => {
    switch (type) {
      case "checkup":
      case "consultation":
        return <Badge variant="outline" className="text-violet-600 border-violet-500/20 bg-violet-500/5 text-xs font-semibold">{t("checkup")}</Badge>;
      case "follow_up":
        return <Badge variant="outline" className="text-indigo-600 border-indigo-500/20 bg-indigo-500/5 text-xs font-semibold">{t("follow_up")}</Badge>;
      case "procedure":
        return <Badge variant="outline" className="text-rose-600 border-rose-500/20 bg-rose-500/5 text-xs font-semibold">{t("procedure")}</Badge>;
      case "telemedicine":
        return <Badge variant="outline" className="text-teal-600 border-teal-500/20 bg-teal-500/5 text-xs font-semibold">{t("telemedicine")}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs font-semibold">{type}</Badge>;
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "scheduledDate",
      header: isRtl ? "التاريخ والوقت" : "Date & Time",
      cell: ({ row }) => {
        const date = new Date(row.original.scheduledDate);
        const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        const start = row.original.startTime.substring(0, 5);
        const end = row.original.endTime.substring(0, 5);
        return (
          <div className="flex flex-col gap-1 text-start">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
              {dateStr}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/80 font-bold flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {start} - {end}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: "patientName",
      header: t("patient"),
      cell: ({ row }) => {
        const name = isRtl ? row.original.patientNameAr : row.original.patientNameEn;
        return (
          <div className="flex flex-col text-start">
            <span className="font-black text-foreground text-sm">{name}</span>
            <span className="text-[10px] text-muted-foreground font-mono font-bold mt-0.5">
              #{row.original.patientNumber}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: "doctorName",
      header: t("doctor"),
      cell: ({ row }) => {
        const name = isRtl ? row.original.doctorNameAr : row.original.doctorNameEn;
        const dept = isRtl ? row.original.departmentNameAr : row.original.departmentNameEn;
        return (
          <div className="flex flex-col text-start gap-0.5">
            <span className="font-bold text-foreground/90 text-xs flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground" />
              {name}
            </span>
            <span className="text-[10px] text-accent/90 font-black">{dept}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "type",
      header: t("type"),
      cell: ({ row }) => renderTypeBadge(row.original.type)
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => renderStatusBadge(row.original.status)
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button 
          variant="ghost" 
          size="xs" 
          className="text-muted-foreground hover:text-foreground font-bold text-[10px]"
          onClick={() => handleRowClick(row.original)}
        >
          <Eye className="h-3 w-3 me-1" />
          {isRtl ? "عرض وإدارة" : "View & Edit"}
        </Button>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 rounded-2xl border border-border/40 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-[11px] start-3.5 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 h-9 text-xs"
            />
          </div>

          <select dir={isRtl ? "rtl" : "ltr"} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="">{isRtl ? "جميع العيادات" : "All Clinics"}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {isRtl ? dept.nameAr : dept.nameEn}
              </option>
            ))}
          </select>

          <select dir={isRtl ? "rtl" : "ltr"} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
            <option value="">{isRtl ? "جميع الأطباء" : "All Doctors"}</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {isRtl ? doc.nameAr : doc.nameEn}
              </option>
            ))}
          </select>

          <select dir={isRtl ? "rtl" : "ltr"} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="">{isRtl ? "كل الحالات" : "All Statuses"}</option>
            <option value="scheduled">{isRtl ? "مؤكد" : "Scheduled"}</option>
            <option value="completed">{isRtl ? "مكتمل" : "Completed"}</option>
            <option value="cancelled">{isRtl ? "ملغي" : "Cancelled"}</option>
            <option value="no_show">{isRtl ? "غائب" : "No Show"}</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWaitingList(!showWaitingList)}
            className={cn(
              "text-xs font-black relative h-9 px-3 gap-1.5",
              showWaitingList && "bg-amber-500/10 text-amber-700 border-amber-500/30"
            )}
          >
            <Menu className="h-4 w-4" />
            <span>{t("waitingList")}</span>
            {waitingList.length > 0 && (
              <span className="absolute -top-1.5 -end-1.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-amber-500 text-[10px] text-white font-bold px-1 ring-2 ring-white">
                {waitingList.length}
              </span>
            )}
          </Button>

          <div className="border border-border/40 p-0.5 rounded-lg flex gap-0.5 bg-muted/40">
            <Button
              variant={viewMode === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="h-8 text-xs font-bold px-2.5"
            >
              <CalendarRange className="h-3.5 w-3.5 me-1" />
              {isRtl ? "الأسبوع" : "Week"}
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 text-xs font-bold px-2.5"
            >
              <BookOpen className="h-3.5 w-3.5 me-1" />
              {isRtl ? "القائمة" : "List"}
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => router.push(`/${hospitalSlug}/appointments/new`)}
            className="text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90 h-9 px-3 gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>{t("newAppointment")}</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {viewMode === "list" ? (
            <Card className="rounded-2xl border border-border/30 overflow-hidden shadow-xs">
              <CardContent className="p-0">
                <DataTable
                  columns={columns}
                  data={filteredAppointments}
                  searchKey="patientName"
                  searchPlaceholder={t("searchPlaceholder")}
                  onRowClick={handleRowClick}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border/40 shadow-xs">
                <Button variant="outline" size="sm" onClick={handlePrevWeek} className="h-8 px-2.5">
                  {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
                <span className="font-black text-sm tracking-tight text-foreground">
                  {weekDates[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - {weekDates[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <Button variant="outline" size="sm" onClick={handleNextWeek} className="h-8 px-2.5">
                  {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                {weekDates.map((date, idx) => {
                  const dayApps = getAppointmentsForDate(date);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const isWeekend = date.getDay() === 5 || date.getDay() === 6;

                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "rounded-xl border flex flex-col bg-card min-h-[350px] shadow-xs text-start transition-all",
                        isToday ? "border-accent ring-1 ring-accent/30 shadow-md bg-accent/2" : "border-border/40 hover:border-border/80",
                        isWeekend && "bg-gray-50/20"
                      )}
                    >
                      <div 
                        className={cn(
                          "p-3 border-b border-border/30 flex flex-col items-start gap-0.5",
                          isToday && "bg-accent/5"
                        )}
                      >
                        <span className={cn("text-xs font-black", isToday ? "text-accent" : "text-foreground")}>
                          {date.toLocaleDateString(locale, { weekday: 'long' })}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono font-bold">
                          {date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      <div className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-thin">
                        {dayApps.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center p-4">
                            <span className="text-[10px] text-muted-foreground/60 font-semibold italic text-center">
                              {isWeekend 
                                ? (isRtl ? "عطلة نهاية الأسبوع 🌴" : "Weekend Off 🌴")
                                : (isRtl ? "لا توجد مواعيد" : "No appointments")}
                            </span>
                          </div>
                        ) : (
                          dayApps.map((app) => (
                            <button
                              key={app.id}
                              onClick={() => handleRowClick(app)}
                              className={cn(
                                "p-2 rounded-lg border text-start flex flex-col gap-1 transition-all outline-hidden text-[11px] shadow-2xs hover:shadow-xs",
                                app.status === "cancelled" 
                                  ? "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10 text-rose-800" 
                                  : app.status === "completed"
                                    ? "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10 text-emerald-800"
                                    : "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/10 text-blue-800"
                              )}
                            >
                              <div className="flex justify-between items-center gap-1 w-full">
                                <span className="font-mono font-black text-[9px]">
                                  {app.startTime.substring(0, 5)}
                                </span>
                                {renderTypeBadge(app.type)}
                              </div>
                              <span className="font-black truncate text-foreground leading-snug">
                                {isRtl ? app.patientNameAr : app.patientNameEn}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-semibold truncate">
                                د. {isRtl ? app.doctorNameAr : app.doctorNameEn}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {showWaitingList && (
          <aside className="w-80 border border-border/40 rounded-2xl bg-card p-4 flex flex-col gap-4 shadow-sm shrink-0 self-stretch text-start max-h-[800px] overflow-y-auto">
            <header className="border-b border-border/30 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  {t("waitingList")}
                </h3>
              </div>
              <Badge className="bg-amber-500 text-white border-none font-bold text-[10px] h-5 px-1.5">
                {waitingList.length}
              </Badge>
            </header>

            <div className="flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-thin">
              {waitingList.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground/70 italic">
                  {isRtl ? "طابور الانتظار فارغ حالياً." : "Waiting queue is clear."}
                </div>
              ) : (
                waitingList.map((entry) => (
                  <Card key={entry.id} className="border-border/30 bg-muted/20 shadow-2xs">
                    <CardContent className="p-3 space-y-2 flex flex-col items-start">
                      <div className="flex justify-between items-start gap-2 w-full">
                        <span className="font-black text-xs text-foreground">
                          {isRtl ? entry.patientNameAr : entry.patientNameEn}
                        </span>
                      </div>
                      <Button
                        size="xs"
                        className="w-full text-[10px] font-black mt-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                        onClick={() => {
                          setSelectedWaitingEntry(entry);
                          setScheduleDoctorId(entry.preferredDoctorId || "");
                        }}
                      >
                        <CalendarIcon className="h-3 w-3 me-1" />
                        {isRtl ? "جدولة الموعد وتسكينه" : "Schedule Patient"}
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      <Drawer isOpen={isDetailDrawerOpen} onClose={() => setIsDetailDrawerOpen(false)}>
        <DrawerContent className="text-start">
          <div className="mx-auto w-full max-w-lg p-6">
            {selectedAppointment && (
              <>
                <DrawerHeader className="border-b border-border/30 pb-4 text-start" onClose={() => setIsDetailDrawerOpen(false)}>
                  <div className="flex justify-between items-center gap-4 w-full">
                    <div>
                      <DrawerTitle className="text-lg font-black text-foreground">
                        {isRtl ? selectedAppointment.patientNameAr : selectedAppointment.patientNameEn}
                      </DrawerTitle>
                    </div>
                    {renderStatusBadge(selectedAppointment.status)}
                  </div>
                </DrawerHeader>

                <div className="py-6 space-y-4">
                  {selectedAppointment.status === "scheduled" && (
                    <div className="space-y-4 pt-4 border-t border-border/30">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-foreground block">
                          {isRtl ? "تعديل حالة الحجز" : "Update Appointment Status"}
                        </label>
                        <select
                          dir={isRtl ? "rtl" : "ltr"}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          value={selectedAppointment.status}
                          onChange={(e) => handleStatusChange(e.target.value)}
                        >
                          <option value="scheduled">{isRtl ? "مؤكد" : "Scheduled"}</option>
                          <option value="completed">{isRtl ? "مكتمل" : "Completed"}</option>
                          <option value="no_show">{isRtl ? "غائب" : "No Show"}</option>
                          <option value="cancelled">{isRtl ? "ملغي" : "Cancelled"}</option>
                        </select>
                      </div>

                      <div className="space-y-2 pt-2">
                        <label className="text-[11px] font-black text-rose-700 block">
                          {isRtl ? "إلغاء الحجز (يرجى كتابة السبب)" : "Cancel Appointment (Reason Required)"}
                        </label>
                        <div className="flex gap-2">
                          <Input
                            placeholder={isRtl ? "اكتب سبب إلغاء الحجز..." : "Reason for cancellation..."}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="h-9 text-xs border-rose-200 focus:border-rose-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <DrawerFooter className="border-t border-border/30 pt-4 flex gap-2">
                  <Button variant="outline" className="w-full text-xs font-bold" onClick={() => setIsDetailDrawerOpen(false)}>{isRtl ? "إغلاق النافذة" : "Close"}</Button>
                </DrawerFooter>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog isOpen={!!selectedWaitingEntry} onClose={() => setSelectedWaitingEntry(null)}>
        <DialogContent className="sm:max-w-md text-start">
          <DialogHeader className="text-start">
            <DialogTitle className="text-lg font-black text-foreground">
              {isRtl ? "تسكين موعد من قائمة الانتظار" : "Schedule Waiting List Entry"}
            </DialogTitle>
          </DialogHeader>

          {selectedWaitingEntry && (
            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-foreground block">{t("doctor")}</label>
                <select
                  dir={isRtl ? "rtl" : "ltr"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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

              {/* Date picker */}
              <div className="space-y-1">
                <label className="font-bold text-foreground block">{t("scheduledDate")}</label>
                <Input
                  type="date"
                  value={scheduleDate}
                  min={(() => {
                    const tzDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
                    const yyyy = tzDate.getFullYear();
                    const mm = String(tzDate.getMonth() + 1).padStart(2, "0");
                    const dd = String(tzDate.getDate()).padStart(2, "0");
                    return `${yyyy}-${mm}-${dd}`;
                  })()}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full text-xs"
                />
              </div>

              {/* Available Slots Bader Picker */}
              <div className="space-y-2">
                <label className="font-bold text-foreground block">
                  {isRtl ? "الفترات الزمنية المتاحة (٣٠ دقيقة)" : "Available Time Slots (30 mins)"}
                </label>

                {loadingSlots ? (
                  <div className="text-[10px] text-muted-foreground italic">{isRtl ? "جاري احتساب فترات الأطباء المتاحة للعيادة..." : "Loading clinic slots..."}</div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {scheduleDoctorId && scheduleDate
                      ? (isRtl ? "عذراً! لا توجد كتل زمنية شاغرة في هذا اليوم المختار أو أنه يقع في إجازة عطلة المستشفى." : "No slots available on this day or weekend off.")
                      : (isRtl ? "يرجى اختيار الطبيب وتاريخ اليوم أولاً لعرض الفترات." : "Please select doctor and date first.")}
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
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedWaitingEntry(null);
                setScheduleDate("");
                setScheduleDoctorId("");
                setSelectedSlot("");
              }}
              className="text-xs font-bold"
            >
              {isRtl ? "إلغاء الحجز" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleScheduleFromWaiting}
              className="text-xs font-black bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isPending || !scheduleDoctorId || !scheduleDate || !selectedSlot}
            >
              {isRtl ? "جدولة وحفظ الموعد" : "Schedule Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
