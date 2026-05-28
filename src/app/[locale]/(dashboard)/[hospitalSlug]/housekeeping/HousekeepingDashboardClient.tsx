"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import {
  Brush,
  ClipboardList,
  Map,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  User,
  Camera,
  Upload,
  AlertTriangle,
  UserCheck,
  Filter,
  Check,
  X,
  Sparkles,
  Bed as BedIcon,
  Home,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { normalizeSearchTerm } from "@/lib/utils/egypt";
import {
  createHousekeepingTask,
  assignHousekeepingTask,
  startHousekeepingTask,
  completeHousekeepingTask
} from "@/lib/actions/housekeeping";

interface Room {
  id: string;
  roomNumber: string;
  type: string;
  floor: string;
  wing: string | null;
  isActive: boolean;
}

interface BedData {
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
}

interface CleaningTask {
  id: string;
  bedId: string | null;
  roomId: string;
  type: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  priority: string;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  assignedTo: string | null;
  assignedStaffNameAr: string | null;
  assignedStaffNameEn: string | null;
  bedNumber: string | null;
  roomNumber: string;
  floor: string;
  wing: string | null;
}

interface StaffMember {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface CompletedTaskMetric {
  id: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  priority: string;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

type HousekeepingTaskType = "post_discharge" | "routine" | "pre_admission" | "deep_clean" | "isolation_terminal";
type HousekeepingTaskPriority = "routine" | "urgent";

interface HousekeepingDashboardClientProps {
  locale: string;
  hospitalSlug: string;
  rooms: Room[];
  bedsData: BedData[];
  tasks: CleaningTask[];
  staffList: StaffMember[];
  completedTasks: CompletedTaskMetric[];
  currentUserStaff: StaffMember | null;
  currentUserRole: string;
}

export default function HousekeepingDashboardClient({
  locale,
  hospitalSlug,
  rooms,
  bedsData,
  tasks,
  staffList,
  completedTasks,
  currentUserStaff,
  currentUserRole
}: HousekeepingDashboardClientProps) {
  const t = useTranslations("housekeeping");
  const isRtl = locale === "ar";
  const dateLocale = isRtl ? ar : enUS;

  // Tabs state: "queue" or "map"
  const [activeTab, setActiveTab] = useState<"queue" | "map">("queue");

  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Loading states for actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Completion Dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRequired, setPhotoRequired] = useState(false);

  // Manual Task Creation Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<HousekeepingTaskType>("routine");
  const [selectedPriority, setSelectedPriority] = useState<HousekeepingTaskPriority>("routine");
  const [taskNotes, setTaskNotes] = useState("");

  const handleTypeChange = (val: string) => {
    setSelectedType(val as HousekeepingTaskType);
  };

  const handlePriorityChange = (val: string) => {
    setSelectedPriority(val as HousekeepingTaskPriority);
  };

  const isSupervisor = ["SUPER_ADMIN", "ADMIN", "NURSE", "OR_NURSE"].includes(currentUserRole);

  // Calculate Supervisor KPI Metrics
  const supervisorMetrics = useMemo(() => {
    // 1. Avg cleaning time today (in minutes)
    let avgMinutes = 0;
    const completedWithTimes = completedTasks.filter(
      (task) => task.startedAt && task.completedAt
    );
    if (completedWithTimes.length > 0) {
      const totalMs = completedWithTimes.reduce((acc, curr) => {
        const start = new Date(curr.startedAt!).getTime();
        const end = new Date(curr.completedAt!).getTime();
        return acc + (end - start);
      }, 0);
      avgMinutes = Math.round(totalMs / (completedWithTimes.length * 60 * 1000));
    }

    // 2. Beds Cleaned Today
    const bedsCleanedTodayCount = completedTasks.length;

    // 3. Currently In-Progress Count
    const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;

    // 4. Overdue (waiting > 2 hours) Count
    // To ensure hook purity, we use a fixed reference time or pass it in if needed
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const overdueCount = tasks.filter(
      (task) => task.status === "pending" && new Date(task.requestedAt) < twoHoursAgo
    ).length;

    return {
      avgMinutes,
      bedsCleanedTodayCount,
      inProgressCount,
      overdueCount
    };
  }, [tasks, completedTasks]);

  // Filters tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const normalizedQuery = normalizeSearchTerm(searchQuery);
      
      const matchQuery =
        searchQuery === "" ||
        normalizeSearchTerm(task.roomNumber).includes(normalizedQuery) ||
        (task.bedNumber && normalizeSearchTerm(task.bedNumber).includes(normalizedQuery)) ||
        (task.assignedStaffNameAr && normalizeSearchTerm(task.assignedStaffNameAr).includes(normalizedQuery)) ||
        (task.assignedStaffNameEn && normalizeSearchTerm(task.assignedStaffNameEn).includes(normalizedQuery));

      const matchPriority = filterPriority === "all" || task.priority === filterPriority;
      const matchType = filterType === "all" || task.type === filterType;

      return matchQuery && matchPriority && matchType;
    });
  }, [tasks, searchQuery, filterPriority, filterType]);

  // Group beds by floor and wing for the Map View
  const groupedBeds = useMemo(() => {
    const groups: Record<string, BedData[]> = {};
    bedsData.forEach((bed) => {
      const floorName = isRtl ? `الطابق ${bed.floor}` : `Floor ${bed.floor}`;
      const wingName = bed.wing ? (isRtl ? `جناح ${bed.wing}` : `Wing ${bed.wing}`) : "";
      const groupKey = wingName ? `${floorName} - ${wingName}` : floorName;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(bed);
    });
    return groups;
  }, [bedsData, isRtl]);

  // Actions handlers
  const handleAssignToMe = async (taskId: string) => {
    if (!currentUserStaff) {
      toast.error(t("staffProfileRequired"));
      return;
    }

    setActionLoading(taskId);
    try {
      const res = await assignHousekeepingTask(taskId, currentUserStaff.id);
      if (res.success) {
        toast.success(t("assignSuccess"));
      } else {
        const errorMessage = "error" in res ? res.error : t("assignError");
        toast.error(errorMessage);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignStaff = async (taskId: string, staffId: string) => {
    setActionLoading(taskId);
    try {
      const res = await assignHousekeepingTask(taskId, staffId);
      if (res.success) {
        toast.success(t("assignSuccess"));
      } else {
        const errorMessage = "error" in res ? res.error : t("assignError");
        toast.error(errorMessage);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartTask = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const res = await startHousekeepingTask(taskId);
      if (res.success) {
        toast.success(t("startSuccess"));
      } else {
        const errorMessage = "error" in res ? res.error : t("startError");
        toast.error(errorMessage);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(null);
    }
  };

  const openCompleteDialog = (taskId: string) => {
    setActiveTaskId(taskId);
    setPhotoPreview(null);
    setCompleteDialogOpen(true);
    // Completion photo is highly recommended for all tasks, but mandatory for post_discharge/deep_clean
    const task = tasks.find((t) => t.id === taskId);
    setPhotoRequired(task?.type === "post_discharge" || task?.type === "deep_clean");
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // client-side compression for slower mobile networks
      const compressedDataUrl = await compressImage(file);
      setPhotoPreview(compressedDataUrl);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onerror = (err) => reject(err);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onerror = (err) => reject(err);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1024;
          const scaleSize = MAX_WIDTH / img.width;
          
          if (img.width > MAX_WIDTH) {
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Export as highly compressed JPEG (0.7 quality)
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
      };
    });
  };

  const base64ToBlob = (base64: string, contentType: string) => {
    const byteCharacters = atob(base64.split(",")[1]);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: contentType });
  };

  const handleCompleteTask = async () => {
    if (!activeTaskId) return;
    if (photoRequired && !photoPreview) {
      toast.error(t("photoRequired") || "Completion photo is required.");
      return;
    }

    setActionLoading(activeTaskId);
    setCompleteDialogOpen(false);
    try {
      let finalPhotoUrl = undefined;

      // Direct-to-Cloud Upload Strategy (Pre-signed URLs)
      if (photoPreview && photoPreview.startsWith("data:image")) {
        // 1. Get pre-signed URL from API
        const extension = photoPreview.split(';')[0].split('/')[1];
        const contentType = photoPreview.split(';')[0].split(':')[1];
        
        const presignRes = await fetch("/api/housekeeping/presign", {
          method: "POST",
          body: JSON.stringify({ contentType, extension }),
          headers: { "Content-Type": "application/json" },
        });

        if (!presignRes.ok) throw new Error("Failed to initialize upload");
        
        const { uploadUrl, publicUrl, isLocal } = await presignRes.json();
        
        // 2. Perform binary upload
        const blob = base64ToBlob(photoPreview, contentType);

        if (isLocal) {
          // Standard multipart for local dev fallback
          const formData = new FormData();
          formData.append("file", blob);
          
          const localRes = await fetch(uploadUrl, {
            method: "POST",
            body: JSON.stringify({ base64: photoPreview }), // existing local api expects base64
            headers: { "Content-Type": "application/json" },
          });
          if (!localRes.ok) throw new Error("Local upload failed");
        } else {
          // Direct high-performance binary upload to S3/R2
          const cloudRes = await fetch(uploadUrl, {
            method: "PUT",
            body: blob,
            headers: { "Content-Type": contentType },
          });
          if (!cloudRes.ok) throw new Error("Cloud upload failed");
        }
        
        finalPhotoUrl = publicUrl;
      }

      const res = await completeHousekeepingTask(activeTaskId, finalPhotoUrl);
      if (res.success) {
        toast.success(t("completeSuccess"));
      } else {
        const errorMessage = "error" in res ? res.error : t("completeError");
        toast.error(errorMessage);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(null);
      setActiveTaskId(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedId) {
      toast.error(isRtl ? "يرجى تحديد السرير." : "Please select a bed.");
      return;
    }

    setActionLoading("create");
    try {
      const res = await createHousekeepingTask({
        bedId: selectedBedId,
        type: selectedType,
        priority: selectedPriority,
        notes: taskNotes,
      });

      if (res.success) {
        toast.success(isRtl ? "تم إنشاء مهمة التنظيف بنجاح." : "Housekeeping task created successfully.");
        setCreateDialogOpen(false);
        setSelectedBedId("");
        setTaskNotes("");
      } else {
        const errorMessage = "error" in res ? res.error : (isRtl ? "فشل إنشاء المهمة." : "Failed to create task.");
        toast.error(errorMessage);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(null);
    }
  };

  // Get available beds (not occupied, not already pending cleaning) for manual task creation
  const cleanableBeds = useMemo(() => {
    return bedsData.filter(
      (bed) => bed.status !== "pending_cleaning" && bed.status !== "occupied"
    );
  }, [bedsData]);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Brush className="h-8 w-8 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>
        {isSupervisor && (
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full md:w-auto font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-102 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {isRtl ? "طلب تعقيم/تنظيف يدوي" : "Manual Cleaning Request"}
          </Button>
        )}
      </div>

      {/* Supervisor Statistics Section */}
      {isSupervisor && (
        <Card className="border border-border/60 shadow-md bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {t("supervisorStats")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Avg Cleaning Time */}
              <div className="p-4 rounded-xl border border-border/80 bg-background/50 flex flex-col justify-between">
                <span className="text-xs text-muted-foreground font-black">{t("avgCleaningTime")}</span>
                <span className="text-3xl font-black mt-2 text-foreground flex items-baseline gap-1">
                  {supervisorMetrics.avgMinutes || "—"}
                  <span className="text-xs text-muted-foreground font-black">
                    {t("minutes")}
                  </span>
                </span>
              </div>

              {/* Beds Cleaned Today */}
              <div className="p-4 rounded-xl border border-border/80 bg-background/50 flex flex-col justify-between">
                <span className="text-xs text-muted-foreground font-black">{t("bedsCleaned")}</span>
                <span className="text-3xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
                  {supervisorMetrics.bedsCleanedTodayCount}
                </span>
              </div>

              {/* Currently In-Progress */}
              <div className="p-4 rounded-xl border border-border/80 bg-background/50 flex flex-col justify-between">
                <span className="text-xs text-muted-foreground font-black">{t("currentlyInProgress")}</span>
                <span className="text-3xl font-black mt-2 text-amber-600 dark:text-amber-400">
                  {supervisorMetrics.inProgressCount}
                </span>
              </div>

              {/* Overdue Tasks */}
              <div className={cn(
                "p-4 rounded-xl border flex flex-col justify-between transition-colors",
                supervisorMetrics.overdueCount > 0 
                  ? "border-red-500/30 bg-red-500/5" 
                  : "border-border/80 bg-background/50"
              )}>
                <span className={cn(
                  "text-xs font-black",
                  supervisorMetrics.overdueCount > 0 ? "text-red-500" : "text-muted-foreground"
                )}>
                  {t("overdueTasks")}
                </span>
                <span className={cn(
                  "text-3xl font-black mt-2",
                  supervisorMetrics.overdueCount > 0 ? "text-red-600 dark:text-red-400 animate-pulse" : "text-foreground"
                )}>
                  {supervisorMetrics.overdueCount}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs list */}
      <div className="flex border-b border-border/80 pb-0 gap-4">
        <button
          onClick={() => setActiveTab("queue")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 border-b-2 font-black text-sm transition-all focus:outline-none cursor-pointer",
            activeTab === "queue"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          {t("queueTab")}
        </button>
        <button
          onClick={() => setActiveTab("map")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 border-b-2 font-black text-sm transition-all focus:outline-none cursor-pointer",
            activeTab === "map"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Map className="h-4 w-4" />
          {t("mapTab")}
        </button>
      </div>

      {/* Queue View Content */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {/* Filters controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder={isRtl ? "البحث برقم الغرفة، السرير، أو الموظف..." : "Search by room, bed, or staff..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full ps-9 pe-9"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("priority")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRtl ? "كل الأولويات" : "All Priorities"}</SelectItem>
                  <SelectItem value="urgent">{isRtl ? "عاجل" : "Urgent"}</SelectItem>
                  <SelectItem value="routine">{isRtl ? "عادي" : "Routine"}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder={t("taskType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRtl ? "كل الأنواع" : "All Types"}</SelectItem>
                  <SelectItem value="post_discharge">{t("post_discharge")}</SelectItem>
                  <SelectItem value="routine">{t("routine_clean")}</SelectItem>
                  <SelectItem value="deep_clean">{t("deep_clean")}</SelectItem>
                  <SelectItem value="pre_admission">{t("pre_admission")}</SelectItem>
                  <SelectItem value="isolation_terminal">{t("isolation_terminal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tasks Grid */}
          {filteredTasks.length === 0 ? (
            <Card className="border-dashed p-12 text-center flex flex-col items-center justify-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-muted-foreground font-black text-sm">{t("noTasks")}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map((task) => {
                const timeRequestedText = formatDistanceToNow(new Date(task.requestedAt), {
                  locale: dateLocale,
                  addSuffix: true,
                });
                
                const isUrgent = task.priority === "urgent";
                const isAssigned = !!task.assignedTo;
                const isAssignedToMe = isAssigned && currentUserStaff && task.assignedTo === currentUserStaff.id;

                return (
                  <Card
                    key={task.id}
                    className={cn(
                      "flex flex-col justify-between transition-all hover:shadow-lg relative overflow-hidden group border border-border/80",
                      isUrgent && "border-red-500/20 bg-red-500/[0.01]"
                    )}
                  >
                    {/* Urgencies Accent top bar */}
                    {isUrgent && <div className="absolute top-0 inset-x-0 h-1 bg-red-500" />}

                    <CardContent className="pt-6 flex-1 flex flex-col justify-between space-y-4">
                      {/* Bed info & priorities */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-black text-lg text-foreground flex items-center gap-1.5">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            {isRtl 
                              ? `الغرفة ${task.roomNumber} - السرير ${task.bedNumber || "—"}` 
                              : `Room ${task.roomNumber} - Bed ${task.bedNumber || "—"}`}
                          </h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {isRtl
                              ? `طابق ${task.floor} ${task.wing ? `· جناح ${task.wing}` : ""}`
                              : `Floor ${task.floor} ${task.wing ? `· Wing ${task.wing}` : ""}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge className={cn(
                            "text-[10px] font-black tracking-wide",
                            isUrgent ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"
                          )}>
                            {isUrgent ? t("urgentBadge") : t("routineBadge")}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-black text-primary border-primary/20 bg-primary/5">
                            {t(task.type)}
                          </Badge>
                        </div>
                      </div>

                      {/* Notes if exists */}
                      {task.notes && (
                        <div className="p-2.5 rounded-lg bg-muted/40 text-xs text-muted-foreground border border-border/40">
                          {task.notes}
                        </div>
                      )}

                      {/* Request times & Assignee status */}
                      <div className="space-y-2 border-t pt-3 border-border/40 text-xs text-muted-foreground mt-4">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {t("requested")}
                          </span>
                          <span className="font-bold">{timeRequestedText}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {t("assignedTo")}
                          </span>
                          <span className={cn(
                            "font-bold",
                            isAssigned ? "text-foreground" : "text-amber-600 dark:text-amber-400"
                          )}>
                            {isAssigned
                              ? (isRtl ? task.assignedStaffNameAr : task.assignedStaffNameEn)
                              : t("unassigned")}
                          </span>
                        </div>
                      </div>

                      {/* Actions Panel */}
                      <div className="pt-4 border-t border-border/40 mt-auto">
                        {/* 1. Housekeeper role interactions */}
                        {currentUserRole === "HOUSEKEEPING" && (
                          <div className="w-full">
                            {!isAssigned ? (
                              <Button
                                size="sm"
                                className="w-full font-black text-xs cursor-pointer"
                                onClick={() => handleAssignToMe(task.id)}
                                disabled={actionLoading === task.id}
                              >
                                {actionLoading === task.id ? <Loader2 className="h-3 w-3 animate-spin mx-1" /> : <UserCheck className="h-3.5 w-3.5 mx-1.5" />}
                                {t("assignToMe")}
                              </Button>
                            ) : isAssignedToMe ? (
                              task.status === "pending" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="w-full font-black text-xs border border-border cursor-pointer"
                                  onClick={() => handleStartTask(task.id)}
                                  disabled={actionLoading === task.id}
                                >
                                  {actionLoading === task.id ? <Loader2 className="h-3 w-3 animate-spin mx-1" /> : <Clock className="h-3.5 w-3.5 mx-1.5" />}
                                  {t("startTask")}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
                                  onClick={() => openCompleteDialog(task.id)}
                                  disabled={actionLoading === task.id}
                                >
                                  {actionLoading === task.id ? <Loader2 className="h-3 w-3 animate-spin mx-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mx-1.5" />}
                                  {t("completeWithPhoto")}
                                </Button>
                              )
                            ) : (
                              <Button size="sm" variant="ghost" disabled className="w-full text-xs text-muted-foreground border-dashed border">
                                {isRtl ? "مهمة لزميل آخر" : "Assigned to other colleague"}
                              </Button>
                            )}
                          </div>
                        )}

                        {/* 2. Admin / Nurse supervisor interactions */}
                        {isSupervisor && (
                          <div className="space-y-2">
                            {task.status === "pending" && (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={task.assignedTo || "unassigned"}
                                  onValueChange={(val) => handleAssignStaff(task.id, val)}
                                  disabled={actionLoading === task.id}
                                >
                                  <SelectTrigger className="w-full text-xs font-black h-8">
                                    <SelectValue placeholder={t("assignToMe")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned" disabled>{t("unassigned")}</SelectItem>
                                    {staffList.map((st) => (
                                      <SelectItem key={st.id} value={st.id} className="text-xs">
                                        {isRtl ? st.nameAr : st.nameEn}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {task.status === "in_progress" && (
                              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <span className="flex items-center gap-1.5 font-black">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  {isRtl ? "قيد التنظيف والتعقيم..." : "Cleaning in-progress..."}
                                </span>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  className="h-6 text-[10px] text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 font-black cursor-pointer"
                                  onClick={() => openCompleteDialog(task.id)}
                                >
                                  {isRtl ? "إكمال المهمة" : "Complete"}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Map View Content */}
      {activeTab === "map" && (
        <div className="space-y-8">
          {Object.entries(groupedBeds).map(([groupTitle, beds]) => (
            <Card key={groupTitle} className="border border-border/80 shadow-sm bg-card/60 backdrop-blur-md">
              <CardHeader className="border-b border-border/40 pb-3">
                <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                  <Home className="h-4.5 w-4.5 text-muted-foreground" />
                  {groupTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {beds.map((bed) => {
                    let statusColor = "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10";
                    let statusBadge = "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
                    
                    if (bed.status === "occupied") {
                      statusColor = "border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10";
                      statusBadge = "bg-blue-500/20 text-blue-600 dark:text-blue-400";
                    } else if (bed.status === "pending_cleaning") {
                      statusColor = "border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10";
                      statusBadge = "bg-amber-500/20 text-amber-600 dark:text-amber-400";
                    } else if (bed.status === "maintenance") {
                      statusColor = "border-border text-muted-foreground bg-muted/30 cursor-not-allowed";
                      statusBadge = "bg-muted text-muted-foreground";
                    } else if (["reserved", "quarantine"].includes(bed.status)) {
                      statusColor = "border-purple-500/20 text-purple-600 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/10";
                      statusBadge = "bg-purple-500/20 text-purple-600 dark:text-purple-400";
                    }

                    // Click handler
                    const handleBedClick = () => {
                      if (bed.status === "pending_cleaning") {
                        // Locate the task corresponding to the bed and jump/scroll to it, or show message
                        const task = tasks.find((t) => t.bedId === bed.bedId);
                        if (task) {
                          setActiveTab("queue");
                          setSearchQuery(`الغرفة ${task.roomNumber}`);
                          toast.info(isRtl ? `تمت تصفية الطابور لعرض المهمة.` : `Filtered queue to show task.`);
                        }
                      } else if (isSupervisor && bed.status === "available") {
                        // Open manual clean creation with this bed pre-selected
                        setSelectedBedId(bed.bedId);
                        setCreateDialogOpen(true);
                      }
                    };

                    return (
                      <button
                        key={bed.bedId}
                        onClick={handleBedClick}
                        disabled={bed.status === "maintenance" || bed.status === "occupied" || (!isSupervisor && bed.status === "available")}
                        className={cn(
                          "flex flex-col justify-between p-3.5 rounded-xl border border-dashed transition-all text-start w-full relative outline-none focus:ring-2 focus:ring-primary h-28 group cursor-pointer",
                          statusColor
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-black text-xs sm:text-sm flex items-center gap-1">
                            <BedIcon className="h-4 w-4 text-muted-foreground group-hover:scale-110 transition-transform" />
                            {isRtl ? `${bed.bedNumber}` : `Bed ${bed.bedNumber}`}
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full capitalize ${statusBadge}`}>
                            {t(bed.status)}
                          </span>
                        </div>

                        <div className="mt-3 text-[10px] text-muted-foreground flex flex-col justify-end flex-1">
                          <span className="font-bold text-foreground">
                            {isRtl ? `غرفة ${bed.roomNumber}` : `Room ${bed.roomNumber}`}
                          </span>
                          {bed.status === "available" && isSupervisor && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 mt-1">
                              <Plus className="h-3 w-3" />
                              {isRtl ? "طلب تعقيم" : "Order clean"}
                            </span>
                          )}
                          {bed.status === "pending_cleaning" && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold mt-1">
                              {isRtl ? "بانتظار التعقيم" : "Pending cleaning"}
                            </span>
                          )}
                          {bed.status === "occupied" && (
                            <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">
                              {isRtl ? "مستغل بمريض" : "Occupied"}
                            </span>
                          )}
                          {bed.status === "maintenance" && (
                            <span className="text-muted-foreground font-medium mt-1">
                              {isRtl ? "خارج الخدمة" : "Out of order"}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completion Dialog (With camera simulation) */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md w-full border border-border">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-foreground flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {t("capturePhoto")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {photoRequired && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertTriangle className="h-4.5 w-4.5 mt-0.5 shrink-0" />
                <p className="font-bold">
                  {isRtl 
                    ? "تنبيه: تتطلب هذه المهمة (تنظيف بعد الخروج/تعقيم عميق) التقاط صورة لإثبات الإنجاز ونظافة السرير قبل إتاحته للاستقبال."
                    : "Attention: This task (post-discharge/deep clean) requires capturing a photo to prove cleanliness before the bed is released."}
                </p>
              </div>
            )}

            {/* Camera View Box */}
            <div className="relative border-2 border-dashed border-border rounded-xl aspect-video bg-muted overflow-hidden flex flex-col items-center justify-center group">
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Captured Bed" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 end-2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="text-center p-4">
                  <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-black text-foreground">{isRtl ? "التقط صورة للسرير المعقم" : "Take photo of sanitized bed"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{isRtl ? "انقر لاستخدام كاميرا الهاتف أو تحميل ملف" : "Click to launch camera or upload file"}</p>
                  
                  {/* Real responsive Camera/File input */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
              className="font-black"
            >
              {t("close")}
            </Button>
            <Button
              onClick={handleCompleteTask}
              disabled={photoRequired && !photoPreview}
              className="font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <Check className="h-4 w-4 mx-1.5" />
              {t("completeTask")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Cleaning Request Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md w-full border border-border">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-foreground flex items-center gap-2">
              <Brush className="h-5 w-5 text-primary" />
              {isRtl ? "طلب تعقيم/تنظيف سرير" : "Request Bed Cleaning"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4 py-3">
            {/* Bed selector */}
            <div className="space-y-2">
              <label className="text-xs font-black text-foreground">{isRtl ? "اختر السرير الشاغر" : "Select Available Bed"}</label>
              <Select value={selectedBedId} onValueChange={setSelectedBedId}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder={isRtl ? "-- اختر السرير --" : "-- Select Bed --"} />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {cleanableBeds.map((bed) => (
                    <SelectItem key={bed.bedId} value={bed.bedId} className="text-xs">
                      {isRtl 
                        ? `الغرفة ${bed.roomNumber} - السرير ${bed.bedNumber} (طابق ${bed.floor})` 
                        : `Room ${bed.roomNumber} - Bed ${bed.bedNumber} (Floor ${bed.floor})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task Type */}
            <div className="space-y-2">
              <label className="text-xs font-black text-foreground">{t("taskType")}</label>
              <Select 
                value={selectedType} 
                onValueChange={handleTypeChange}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine" className="text-xs">{t("routine_clean")}</SelectItem>
                  <SelectItem value="post_discharge" className="text-xs">{t("post_discharge")}</SelectItem>
                  <SelectItem value="deep_clean" className="text-xs">{t("deep_clean")}</SelectItem>
                  <SelectItem value="pre_admission" className="text-xs">{t("pre_admission")}</SelectItem>
                  <SelectItem value="isolation_terminal" className="text-xs">{t("isolation_terminal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-xs font-black text-foreground">{t("priority")}</label>
              <Select 
                value={selectedPriority} 
                onValueChange={handlePriorityChange}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine" className="text-xs">{isRtl ? "عادي (دوري)" : "Routine (Regular)"}</SelectItem>
                  <SelectItem value="urgent" className="text-xs">{isRtl ? "عاجل (تطهير فوري)" : "Urgent (Immediate)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-black text-foreground">{isRtl ? "ملاحظات إضافية" : "Additional Notes"}</label>
              <Textarea
                placeholder={isRtl ? "أضف أي تفاصيل أو متطلبات خاصة بالتعقيم..." : "Add details or specific requirements..."}
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                className="text-xs h-20"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                className="font-black"
              >
                {t("close")}
              </Button>
              <Button
                type="submit"
                className="font-black bg-primary hover:scale-102 transition-all cursor-pointer"
                disabled={actionLoading === "create"}
              >
                {actionLoading === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-1" /> : <Check className="h-4 w-4 mx-1.5" />}
                {isRtl ? "تقديم طلب التنظيف" : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
