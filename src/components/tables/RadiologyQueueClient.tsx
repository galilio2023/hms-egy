"use client";

import React, { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  FileText, 
  Upload, 
  Eye, 
  ExternalLink, 
  Clock, 
  ShieldAlert, 
  User, 
  Layers, 
  Info,
  Calendar,
  AlertOctagon,
  Image as ImageIcon
} from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { submitRadiologyReportAction } from "@/lib/actions/radiology";
import { toast } from "sonner";

interface RadiologyOrder {
  id: string;
  procedureNameAr: string;
  procedureNameEn: string;
  cptCode: string | null;
  priority: string; // routine, urgent, stat
  status: string; // pending, scheduled, completed, cancelled
  clinicalNotes: string | null;
  createdAt: Date;
  patientNameAr: string | null;
  patientNameEn: string | null;
  patientDob: Date | string | null;
  patientGender: string | null;
  patientNumber: string | null;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
  isCritical?: boolean | null;
  findingsAr?: string | null;
  findingsEn?: string | null;
  impressionAr?: string | null;
  impressionEn?: string | null;
  imageUrl?: string | null;
}

interface RadiologyQueueClientProps {
  orders: RadiologyOrder[];
  hospitalSlug: string;
}

export function RadiologyQueueClient({ orders: initialOrders, hospitalSlug }: RadiologyQueueClientProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog / Modal State
  const [selectedOrder, setSelectedOrder] = useState<RadiologyOrder | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Form State
  const [findingsAr, setFindingsAr] = useState("");
  const [findingsEn, setFindingsEn] = useState("");
  const [impressionAr, setImpressionAr] = useState("");
  const [impressionEn, setImpressionEn] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Helper: calculate age
  const getAge = (dobString: any) => {
    if (!dobString) return 0;
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Helper: format date
  const formatDate = (date: any) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filtering Logic
  const filteredOrders = initialOrders.filter((order) => {
    // 1. Search Query Filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchPatientNameAr = order.patientNameAr?.toLowerCase().includes(query);
      const matchPatientNameEn = order.patientNameEn?.toLowerCase().includes(query);
      const matchPatientNumber = order.patientNumber?.toLowerCase().includes(query);
      const matchProcedureAr = order.procedureNameAr.toLowerCase().includes(query);
      const matchProcedureEn = order.procedureNameEn.toLowerCase().includes(query);
      const matchCpt = order.cptCode?.toLowerCase().includes(query);
      
      if (!matchPatientNameAr && !matchPatientNameEn && !matchPatientNumber && !matchProcedureAr && !matchProcedureEn && !matchCpt) {
        return false;
      }
    }

    // 2. Priority Filter
    if (priorityFilter !== "all" && order.priority !== priorityFilter) {
      return false;
    }

    // 3. Status Filter
    if (statusFilter !== "all" && order.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // Calculate Statistics
  const totalCount = initialOrders.length;
  const pendingCount = initialOrders.filter(o => o.status === "pending" || o.status === "scheduled").length;
  const completedCount = initialOrders.filter(o => o.status === "completed").length;
  const criticalCount = initialOrders.filter(o => o.isCritical).length;

  // Open Report Builder
  const handleOpenReportModal = (order: RadiologyOrder) => {
    setSelectedOrder(order);
    setFindingsAr("");
    setFindingsEn("");
    setImpressionAr("");
    setImpressionEn("");
    setImageUrl("");
    setIsCritical(false);
    setValidationError("");
    setIsReportModalOpen(true);
  };

  // Open Report Viewer
  const handleOpenViewModal = (order: RadiologyOrder) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  };

  // Submit Report
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (!findingsAr.trim() || !findingsEn.trim() || !impressionAr.trim() || !impressionEn.trim()) {
      setValidationError(
        isRtl 
          ? "يرجى تعبئة كافة الحقول المطلوبة باللغتين العربية والإنجليزية." 
          : "Please fill in all required fields in both Arabic and English."
      );
      return;
    }

    setValidationError("");
    startTransition(async () => {
      const res = await submitRadiologyReportAction({
        orderId: selectedOrder.id,
        findingsAr,
        findingsEn,
        impressionAr,
        impressionEn,
        imageUrl: imageUrl || undefined,
        isCritical
      });

      if (res.success) {
        toast.success(
          isRtl 
            ? "تم تسجيل تقرير الأشعة بنجاح." 
            : "Radiology report submitted successfully."
        );
        setIsReportModalOpen(false);
        router.refresh();
      } else {
        const errorMessage = "error" in res ? res.error : (isRtl ? "فشل تقديم التقرير." : "Failed to submit report.");
        toast.error(errorMessage);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Scans Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-xs transition-all duration-300 hover:shadow-md">
          <div className="absolute top-0 end-0 p-4 opacity-10">
            <Layers className="h-20 w-20 text-blue-600" />
          </div>
          <div className="flex flex-col gap-1 text-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {isRtl ? "إجمالي الفحوصات" : "Total Scans"}
            </span>
            <span className="text-3xl font-black text-foreground mt-2">{totalCount}</span>
            <span className="text-[10px] text-muted-foreground mt-1">
              {isRtl ? "جميع الطلبات المسجلة في القسم" : "All requested department orders"}
            </span>
          </div>
        </div>

        {/* Pending Scans Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-xs transition-all duration-300 hover:shadow-md">
          <div className="absolute top-0 end-0 p-4 opacity-10">
            <Clock className="h-20 w-20 text-amber-500" />
          </div>
          <div className="flex flex-col gap-1 text-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {isRtl ? "قيد الانتظار" : "Pending Scans"}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-amber-600 dark:text-amber-500">{pendingCount}</span>
              {pendingCount > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1">
              {isRtl ? "بانتظار تدوين التقارير الطبية" : "Awaiting diagnostic reports"}
            </span>
          </div>
        </div>

        {/* Completed Scans Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-xs transition-all duration-300 hover:shadow-md">
          <div className="absolute top-0 end-0 p-4 opacity-10">
            <CheckCircle2 className="h-20 w-20 text-emerald-500" />
          </div>
          <div className="flex flex-col gap-1 text-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {isRtl ? "الفحوصات المكتملة" : "Completed Scans"}
            </span>
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-500 mt-2">{completedCount}</span>
            <span className="text-[10px] text-muted-foreground mt-1">
              {isRtl ? "تم إصدار التقارير الطبية لها" : "Successfully reported scan files"}
            </span>
          </div>
        </div>

        {/* Critical Alerts Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-xs transition-all duration-300 hover:shadow-md">
          <div className="absolute top-0 end-0 p-4 opacity-10">
            <ShieldAlert className="h-20 w-20 text-red-500" />
          </div>
          <div className="flex flex-col gap-1 text-start">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-red-500">
              {isRtl ? "تنبيهات حرجة" : "Critical Alerts"}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-red-600 dark:text-red-500">{criticalCount}</span>
              {criticalCount > 0 && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              )}
            </div>
            <span className="text-[10px] text-red-500/80 mt-1">
              {isRtl ? "نتائج تستدعي تدخل الطبيب فوراً" : "Requires immediate clinical intervention"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filters Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card p-4 border border-border/30 rounded-2xl shadow-xs">
        {/* Search */}
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute top-[13px] start-4 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              isRtl 
                ? "ابحث باسم المريض، الرقم الطبي، كود CPT، أو الفحص..." 
                : "Search by patient name, number, CPT, or scan..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-11 bg-background/50 h-11 border-border/60 rounded-xl"
          />
        </div>

        {/* Filters Selectors */}
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto items-center">
          {/* Priority Filters */}
          <div className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-xl border border-border/20 w-full sm:w-auto">
            <button
              onClick={() => setPriorityFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                priorityFilter === "all" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isRtl ? "كل الأولويات" : "All Priorities"}
            </button>
            <button
              onClick={() => setPriorityFilter("stat")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                priorityFilter === "stat" ? "bg-red-500/10 text-red-600 shadow-xs dark:text-red-400" : "text-muted-foreground hover:text-red-500"
              )}
            >
              {isRtl ? "طارئ جداً" : "Stat"}
            </button>
            <button
              onClick={() => setPriorityFilter("urgent")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                priorityFilter === "urgent" ? "bg-amber-500/10 text-amber-600 shadow-xs dark:text-amber-500" : "text-muted-foreground hover:text-amber-500"
              )}
            >
              {isRtl ? "عاجل" : "Urgent"}
            </button>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-xl border border-border/20 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                statusFilter === "all" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isRtl ? "كل الحالات" : "All Statuses"}
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                statusFilter === "pending" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isRtl ? "الانتظار" : "Pending"}
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                statusFilter === "completed" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isRtl ? "المكتملة" : "Completed"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Queue Table Layout */}
      <div className="rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-4 text-start font-bold text-xs uppercase tracking-wider">
                  {isRtl ? "المريض" : "Patient Details"}
                </th>
                <th className="p-4 text-start font-bold text-xs uppercase tracking-wider">
                  {isRtl ? "الإجراء المطلوب" : "Procedure / CPT"}
                </th>
                <th className="p-4 text-start font-bold text-xs uppercase tracking-wider">
                  {isRtl ? "الأولوية" : "Priority"}
                </th>
                <th className="p-4 text-start font-bold text-xs uppercase tracking-wider">
                  {isRtl ? "الطبيب المعالج" : "Ordering Doctor"}
                </th>
                <th className="p-4 text-start font-bold text-xs uppercase tracking-wider">
                  {isRtl ? "تاريخ الطلب" : "Requested Date"}
                </th>
                <th className="p-4 text-start font-bold text-xs uppercase tracking-wider">
                  {isRtl ? "الحالة" : "Status"}
                </th>
                <th className="p-4 text-center font-bold text-xs uppercase tracking-wider w-[140px]">
                  {isRtl ? "الخيارات" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const patientName = isRtl ? (order.patientNameAr || order.patientNameEn) : (order.patientNameEn || order.patientNameAr);
                  const patientSubName = isRtl ? order.patientNameEn : order.patientNameAr;
                  const procedureName = isRtl ? order.procedureNameAr : order.procedureNameEn;
                  const procedureSubName = isRtl ? order.procedureNameEn : order.procedureNameAr;
                  const doctorName = isRtl ? (order.doctorNameAr || order.doctorNameEn) : (order.doctorNameEn || order.doctorNameAr);

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-border/10 hover:bg-muted/10 transition-colors duration-150 last:border-b-0"
                    >
                      {/* Patient Details */}
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                            <User className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col text-start">
                            <span className="font-black text-foreground text-sm leading-tight">{patientName}</span>
                            {patientSubName && (
                              <span className="text-[10px] text-muted-foreground/80 font-semibold">{patientSubName}</span>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                              <span className="font-bold text-accent">{order.patientNumber}</span>
                              <span>•</span>
                              <span>{getAge(order.patientDob)} {isRtl ? "سنة" : "y/o"}</span>
                              <span>•</span>
                              <span className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                order.patientGender === "male" ? "bg-blue-500" : "bg-pink-500"
                              )} />
                              <span className="uppercase text-[9px] font-sans font-bold">
                                {order.patientGender === "male" 
                                  ? (isRtl ? "ذكر" : "Male") 
                                  : (isRtl ? "أنثى" : "Female")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Procedure / CPT */}
                      <td className="p-4 align-middle">
                        <div className="flex flex-col text-start max-w-[220px]">
                          <span className="font-bold text-foreground text-xs leading-tight">{procedureName}</span>
                          {procedureSubName && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">{procedureSubName}</span>
                          )}
                          {order.cptCode && (
                            <span className="mt-1 font-mono text-[9px] font-black uppercase text-accent border border-accent/20 bg-accent/5 px-1.5 py-0.5 rounded-sm w-fit">
                              CPT {order.cptCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="p-4 align-middle">
                        {order.priority === "stat" ? (
                          <Badge variant="destructive" className="flex items-center gap-1 animate-pulse border-red-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-100 dark:bg-red-400" />
                            {isRtl ? "طارئ جداً" : "Stat"}
                          </Badge>
                        ) : order.priority === "urgent" ? (
                          <Badge variant="warning" className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                            {isRtl ? "عاجل" : "Urgent"}
                          </Badge>
                        ) : (
                          <Badge variant="accent" className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {isRtl ? "عادي" : "Routine"}
                          </Badge>
                        )}
                      </td>

                      {/* Ordering Doctor */}
                      <td className="p-4 align-middle">
                        <div className="flex flex-col text-start text-xs font-semibold">
                          <span className="text-foreground">{doctorName}</span>
                          <span className="text-[9px] text-muted-foreground font-sans mt-0.5">
                            {isRtl ? "العيادات الخارجية" : "Outpatient Clinic"}
                          </span>
                        </div>
                      </td>

                      {/* Requested Date */}
                      <td className="p-4 align-middle text-xs font-medium text-muted-foreground/90 font-mono">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="p-4 align-middle">
                        {order.status === "completed" ? (
                          <Badge variant="success" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {isRtl ? "مكتمل" : "Completed"}
                          </Badge>
                        ) : order.status === "cancelled" ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {isRtl ? "ملغي" : "Cancelled"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1 border-amber-500/20 text-amber-600 dark:text-amber-500 bg-amber-500/5">
                            <Clock className="h-3 w-3 animate-spin [animation-duration:10s]" />
                            {isRtl ? "انتظار الفحص" : "Awaiting Scan"}
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 align-middle text-center">
                        {order.status === "completed" ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full flex items-center justify-center gap-1.5 border-border/80 hover:bg-muted/40 font-bold"
                            onClick={() => handleOpenViewModal(order)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{isRtl ? "عرض التقرير" : "View Report"}</span>
                          </Button>
                        ) : order.status === "cancelled" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="w-full flex items-center justify-center gap-1.5 font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
                            onClick={() => handleOpenReportModal(order)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>{isRtl ? "تدوين النتيجة" : "Write Report"}</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <Clock className="h-10 w-10 text-muted-foreground/50" />
                      <h4 className="font-bold text-foreground text-sm">
                        {isRtl ? "لا توجد طلبات أشعة مطابقة" : "No Matching Radiology Orders"}
                      </h4>
                      <p className="text-xs text-muted-foreground/80 leading-normal">
                        {isRtl 
                          ? "لم نجد أي طلبات فحص أشعة نشطة تطابق معايير التصفية والبحث الحالية." 
                          : "No radiology requests match your active filters or search terms."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Write Report Dialog */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="max-w-xl bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
          <form onSubmit={handleSubmitReport}>
            <DialogHeader onClose={() => setIsReportModalOpen(false)} className="px-6 py-4">
              <DialogTitle>
                {isRtl ? "تدوين تقرير فحص الأشعة" : "Write Radiology Diagnosis Report"}
              </DialogTitle>
              <DialogDescription>
                {isRtl 
                  ? "تسجيل النتائج والتشخيص الطبي النهائي لفحص المريض" 
                  : "Submit findings, impressions, and files for this radiology order."}
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin text-start">
                {/* Patient Summary Widget */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border/30 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        {isRtl ? "المريض" : "Patient"}
                      </span>
                      <span className="font-black text-foreground text-sm">
                        {isRtl ? (selectedOrder.patientNameAr || selectedOrder.patientNameEn) : (selectedOrder.patientNameEn || selectedOrder.patientNameAr)}
                      </span>
                      <span className="font-mono text-xs text-accent mt-0.5">{selectedOrder.patientNumber}</span>
                    </div>

                    {selectedOrder.priority === "stat" ? (
                      <Badge variant="destructive" className="animate-pulse">
                        {isRtl ? "طارئ جداً" : "Stat"}
                      </Badge>
                    ) : selectedOrder.priority === "urgent" ? (
                      <Badge variant="warning">{isRtl ? "عاجل" : "Urgent"}</Badge>
                    ) : (
                      <Badge variant="outline">{isRtl ? "روتين" : "Routine"}</Badge>
                    )}
                  </div>

                  <div className="border-t border-border/30 pt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">{isRtl ? "الفحص المطلوب:" : "Procedure:"}</span>
                      <span className="font-bold text-foreground">
                        {isRtl ? selectedOrder.procedureNameAr : selectedOrder.procedureNameEn}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">{isRtl ? "الرمز CPT:" : "CPT Code:"}</span>
                      <span className="font-bold text-foreground font-mono">{selectedOrder.cptCode || "—"}</span>
                    </div>
                  </div>

                  {selectedOrder.clinicalNotes && (
                    <div className="border-t border-border/30 pt-2 text-xs">
                      <span className="text-muted-foreground block">{isRtl ? "ملاحظات سريرية:" : "Clinical Notes:"}</span>
                      <span className="text-foreground leading-relaxed italic">{selectedOrder.clinicalNotes}</span>
                    </div>
                  )}
                </div>

                {/* Validation Error Banner */}
                {validationError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {/* Fields */}
                <div className="space-y-4">
                  {/* Findings Ar */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/80 block">
                      {isRtl ? "النتائج الطبية (بالعربية) *" : "Diagnostic Findings (Arabic) *"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "اكتب تفاصيل النتائج الطبية للفحص هنا..." : "Describe detailed scan findings in Arabic..."}
                      value={findingsAr}
                      onChange={(e) => setFindingsAr(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Findings En */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/80 block">
                      {isRtl ? "النتائج الطبية (بالإنجليزية) *" : "Diagnostic Findings (English) *"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "Describe detailed scan findings in English..." : "Describe detailed scan findings in English..."}
                      value={findingsEn}
                      onChange={(e) => setFindingsEn(e.target.value)}
                      rows={3}
                      className="resize-none font-sans"
                      dir="ltr"
                    />
                  </div>

                  {/* Impression Ar */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/80 block">
                      {isRtl ? "التشخيص والخلاصة (بالعربية) *" : "Diagnostic Impression (Arabic) *"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "ملخص الحالة أو التشخيص النهائي باللغة العربية..." : "Summarize diagnostic impression in Arabic..."}
                      value={impressionAr}
                      onChange={(e) => setImpressionAr(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  {/* Impression En */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/80 block">
                      {isRtl ? "التشخيص والخلاصة (بالإنجليزية) *" : "Diagnostic Impression (English) *"}
                    </label>
                    <Textarea
                      placeholder={isRtl ? "Summarize diagnostic impression in English..." : "Summarize diagnostic impression in English..."}
                      value={impressionEn}
                      onChange={(e) => setImpressionEn(e.target.value)}
                      rows={2}
                      className="resize-none font-sans"
                      dir="ltr"
                    />
                  </div>

                  {/* Image URL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/80 block flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{isRtl ? "رابط صورة الأشعة (PACS / Web View) - اختياري" : "PACS / Scan Image Preview URL (Optional)"}</span>
                    </label>
                    <Input
                      placeholder="https://pacs.hospital.org/viewer/scan-id"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      dir="ltr"
                      className="font-mono text-xs"
                    />
                  </div>

                  {/* Critical Value Toggle */}
                  <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/5 flex items-start gap-3 transition-all">
                    <input
                      type="checkbox"
                      id="critical-toggle"
                      checked={isCritical}
                      onChange={(e) => setIsCritical(e.target.checked)}
                      className="h-4.5 w-4.5 rounded-sm border-red-500/40 text-red-600 focus:ring-red-500 mt-0.5 cursor-pointer accent-red-600"
                    />
                    <div className="flex flex-col gap-1 cursor-pointer select-none" onClick={() => setIsCritical(!isCritical)}>
                      <label htmlFor="critical-toggle" className="text-xs font-black text-red-600 dark:text-red-400 cursor-pointer">
                        {isRtl ? "إرسال تنبيه نتيجة حرجة (Critical Value Alert)" : "Trigger Critical Value Alert"}
                      </label>
                      <p className="text-[10px] text-red-500 leading-normal font-medium">
                        {isRtl 
                          ? "تفعيل هذا الخيار سيرسل إشعاراً عاجلاً بإنذار أحمر للطبيب المعالج لمراجعة المريض فوراً لخطورة الحالة."
                          : "Checking this will send an immediate, high-priority visual system notification directly to the ordering physician."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="px-6 py-4">
              <Button 
                type="submit" 
                disabled={isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-6"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
                    <span>{isRtl ? "جاري التقديم..." : "Submitting..."}</span>
                  </span>
                ) : (
                  <span>{isRtl ? "تقديم التقرير واعتماده" : "Submit & Approve Report"}</span>
                )}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsReportModalOpen(false)}
                className="border-border hover:bg-muted/40 font-bold"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. View Report Dialog */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-xl bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader onClose={() => setIsViewModalOpen(false)} className="px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              <span>{isRtl ? "تقرير فحص الأشعة المعتمد" : "Approved Radiology Diagnosis"}</span>
            </DialogTitle>
            <DialogDescription>
              {isRtl ? "تفاصيل ونتائج التشخيص السريري الرسمي" : "Official diagnostic records and findings."}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin text-start">
              {/* Patient Details Bar */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border/20 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{isRtl ? "المريض:" : "Patient:"}</span>
                  <span className="font-black text-foreground">
                    {isRtl ? (selectedOrder.patientNameAr || selectedOrder.patientNameEn) : (selectedOrder.patientNameEn || selectedOrder.patientNameAr)}
                  </span>
                  <span className="font-mono text-[10px] text-accent font-bold mt-0.5">{selectedOrder.patientNumber}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">{isRtl ? "الفحص:" : "Procedure:"}</span>
                  <span className="font-bold text-foreground">
                    {isRtl ? selectedOrder.procedureNameAr : selectedOrder.procedureNameEn}
                  </span>
                  {selectedOrder.cptCode && (
                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">CPT {selectedOrder.cptCode}</span>
                  )}
                </div>
              </div>

              {/* Critical Value Alert Banner */}
              {selectedOrder.isCritical && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 flex items-start gap-3">
                  <AlertOctagon className="h-5 w-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black uppercase">
                      {isRtl ? "🚨 قيمة حرجة (Critical Value Alert)" : "🚨 Critical Value Alert"}
                    </span>
                    <span className="text-[10px] leading-relaxed">
                      {isRtl 
                        ? "تم تحديد هذا الفحص كقيمة حرجة وتم إرسال تنبيه عاجل للطبيب المعالج." 
                        : "This report contains a critical clinical finding. The ordering doctor has been alerted."}
                    </span>
                  </div>
                </div>
              )}

              {/* Diagnostic Findings */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-foreground/80 uppercase border-b border-border/40 pb-1.5 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-accent" />
                    <span>{isRtl ? "النتائج الطبية (Findings)" : "Diagnostic Findings"}</span>
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/10 border border-border/10 rounded-lg text-sm leading-relaxed text-start">
                      <span className="text-[9px] text-muted-foreground block mb-1 font-bold">ARABIC</span>
                      <p className="whitespace-pre-wrap">{selectedOrder.findingsAr || "—"}</p>
                    </div>
                    <div className="p-3 bg-muted/10 border border-border/10 rounded-lg text-sm leading-relaxed text-start" dir="ltr">
                      <span className="text-[9px] text-muted-foreground block mb-1 font-bold">ENGLISH</span>
                      <p className="whitespace-pre-wrap font-sans">{selectedOrder.findingsEn || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Impressions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-foreground/80 uppercase border-b border-border/40 pb-1.5 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{isRtl ? "الخلاصة والتشخيص (Impression)" : "Diagnostic Impression"}</span>
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/10 border border-border/10 rounded-lg text-sm leading-relaxed text-start">
                      <span className="text-[9px] text-muted-foreground block mb-1 font-bold">ARABIC</span>
                      <p className="whitespace-pre-wrap font-semibold">{selectedOrder.impressionAr || "—"}</p>
                    </div>
                    <div className="p-3 bg-muted/10 border border-border/10 rounded-lg text-sm leading-relaxed text-start" dir="ltr">
                      <span className="text-[9px] text-muted-foreground block mb-1 font-bold">ENGLISH</span>
                      <p className="whitespace-pre-wrap font-sans font-semibold">{selectedOrder.impressionEn || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Scan Image Link */}
                {selectedOrder.imageUrl && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-foreground/80 uppercase border-b border-border/40 pb-1.5 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{isRtl ? "صورة الأشعة المرفقة" : "Scan Image Attachment"}</span>
                    </h4>
                    <div className="p-4 rounded-xl border border-border/30 bg-muted/10 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-accent" />
                        <div className="flex flex-col text-start">
                          <span className="text-xs font-bold text-foreground">PACS / Diagnostic Image</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[240px]">{selectedOrder.imageUrl}</span>
                        </div>
                      </div>
                      <a 
                        href={selectedOrder.imageUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground hover:bg-muted/80 transition-colors gap-1 shadow-2xs shrink-0"
                      >
                        <span>{isRtl ? "فتح الصورة" : "Open Scan"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsViewModalOpen(false)}
              className="border-border hover:bg-muted/40 font-bold w-full sm:w-auto"
            >
              {isRtl ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
