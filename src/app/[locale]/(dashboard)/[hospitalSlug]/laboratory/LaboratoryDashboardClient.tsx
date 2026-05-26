"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import {
  FlaskConical,
  Activity,
  AlertCircle,
  Search,
  ClipboardList,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  Beaker,
  Stethoscope,
  Loader2
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeSearchTerm } from "@/lib/utils/egypt";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { acknowledgeCriticalAlert } from "@/lib/actions/laboratory";
import { toast } from "sonner";

interface LabOrder {
  id: string;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  patientNameAr: string;
  patientNameEn: string;
  patientNumber: string;
  doctorNameAr: string;
  doctorNameEn: string;
}

interface CriticalAlert {
  id: string;
  notifiedAt: Date;
  patientNameAr: string;
  patientNameEn: string;
  patientNumber: string;
  doctorNameAr: string;
  doctorNameEn: string;
  notes: string | null;
}

interface LaboratoryDashboardClientProps {
  locale: string;
  hospitalSlug: string;
  hospitalId: string;
  pendingOrders: LabOrder[];
  processingOrders: LabOrder[];
  recentCompleted: LabOrder[];
  criticalAlerts: CriticalAlert[];
  activeTab: string;
}

export default function LaboratoryDashboardClient({
  locale,
  hospitalSlug,
  hospitalId,
  pendingOrders,
  processingOrders,
  recentCompleted,
  criticalAlerts,
  activeTab: initialTab,
}: LaboratoryDashboardClientProps) {
  const t = useTranslations("laboratory");
  const isRtl = locale === "ar";
  const router = useRouter();
  const dateLocale = locale === "ar" ? ar : enUS;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<string>>(new Set());

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledgingIds((prev) => new Set(prev).add(alertId));
    try {
      const res = await acknowledgeCriticalAlert(alertId);
      if (res.success) {
        toast.success(isRtl ? "تم تأكيد المتابعة بنجاح" : "Acknowledgment successful");
      } else {
        const errorMessage = "error" in res ? res.error : "Failed to acknowledge";
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setAcknowledgingIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const filterOrders = (orders: LabOrder[]) => {
    if (!searchQuery.trim()) return orders;
    const normalizedQuery = normalizeSearchTerm(searchQuery);
    return orders.filter(
      (o) =>
        normalizeSearchTerm(o.patientNameAr).includes(normalizedQuery) ||
        normalizeSearchTerm(o.patientNameEn).includes(normalizedQuery) ||
        normalizeSearchTerm(o.patientNumber).includes(normalizedQuery) ||
        normalizeSearchTerm(o.id).includes(normalizedQuery)
    );
  };

  const filteredPending = useMemo(() => filterOrders(pendingOrders), [pendingOrders, searchQuery]);
  const filteredProcessing = useMemo(() => filterOrders(processingOrders), [processingOrders, searchQuery]);
  const filteredCompleted = useMemo(() => filterOrders(recentCompleted), [recentCompleted, searchQuery]);

  const avgTat = useMemo(() => {
    const completedWithTat = recentCompleted.filter(o => o.updatedAt && o.status === "completed");
    if (completedWithTat.length === 0) return null;
    const totalMinutes = completedWithTat.reduce((acc, curr) => {
      const diff = new Date(curr.updatedAt!).getTime() - new Date(curr.createdAt).getTime();
      return acc + (diff / (1000 * 60));
    }, 0);
    return Math.round(totalMinutes / completedWithTat.length);
  }, [recentCompleted]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "stat":
        return <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-lg">{t("stat")}</Badge>;
      case "urgent":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] rounded-lg">{t("urgent")}</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-500 font-bold text-[10px] rounded-lg">{t("routine")}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="text-slate-600 font-bold text-[10px] rounded-lg">{t("pending")}</Badge>;
      case "collected":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-bold text-[10px] rounded-lg">{t("collected")}</Badge>;
      case "processing":
        return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-bold text-[10px] rounded-lg">{t("processing")}</Badge>;
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold text-[10px] rounded-lg">{t("completed")}</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-[10px] rounded-lg">{status}</Badge>;
    }
  };

  const OrderCard = ({ order }: { order: LabOrder }) => (
    <div key={order.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex gap-4 items-start flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
            <Beaker className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                {isRtl ? order.patientNameAr : order.patientNameEn}
              </h3>
              {getPriorityBadge(order.priority)}
              {getStatusBadge(order.status)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                {order.patientNumber}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Stethoscope className="w-3 h-3" />
                {isRtl ? order.doctorNameAr : order.doctorNameEn}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(order.createdAt, "HH:mm", { locale: dateLocale })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {order.status === "pending" && (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl h-9 px-4">
              {t("collectSample")}
            </Button>
          )}
          {(order.status === "collected" || order.status === "processing") && (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl h-9 px-4" onClick={() => router.push(`/${hospitalSlug}/laboratory/results/${order.id}`)}>
              {t("enterResults")}
            </Button>
          )}
          {order.status === "completed" && (
            <>
              <Button variant="outline" size="sm" className="font-bold text-xs rounded-xl h-9 px-4 border-slate-200 dark:border-slate-800">
                <Printer className="w-4 h-4 me-2 text-slate-400" />
                {t("printReport")}
              </Button>
              <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                <ChevronRight className={cn("w-4 h-4 text-slate-400", isRtl && "rotate-180")} />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── HEADER ────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            {t("title")}
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder") || "Search patients..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl ps-9"
            />
          </div>
        </div>
      </div>

      {/* ── METRICS STRIP ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg shadow-indigo-500/5 overflow-hidden relative rounded-2xl bg-white dark:bg-slate-950">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("pendingOrders")}</span>
              <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{pendingOrders.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-amber-500/5 overflow-hidden relative rounded-2xl bg-white dark:bg-slate-950">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("processingOrders")}</span>
              <span className="text-4xl font-black text-amber-500 dark:text-amber-400 mt-2">{processingOrders.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-emerald-500/5 overflow-hidden relative rounded-2xl bg-white dark:bg-slate-950">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("completedOrders")}</span>
                <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{recentCompleted.length}</span>
              </div>
              {avgTat !== null && (
                <div className="text-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t("avgTat")}</span>
                  <div className="flex items-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-xl font-black">{avgTat}</span>
                    <span className="text-[10px] font-bold uppercase">{isRtl ? "دقيقة" : "Min"}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-0 shadow-lg overflow-hidden relative rounded-2xl transition-all",
          criticalAlerts.length > 0 
            ? "bg-rose-600 shadow-rose-500/20 ring-4 ring-rose-500/10 animate-pulse" 
            : "bg-white dark:bg-slate-950 shadow-slate-500/5"
        )}>
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                criticalAlerts.length > 0 ? "text-rose-100" : "text-slate-400"
              )}>
                {t("criticalAlerts")}
              </span>
              <span className={cn(
                "text-4xl font-black mt-2",
                criticalAlerts.length > 0 ? "text-white" : "text-slate-300 dark:text-slate-700"
              )}>
                {criticalAlerts.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CRITICAL ALERTS BOARD (Only if active) ─────────────────── */}
      {criticalAlerts.length > 0 && (
        <Card className="border-2 border-rose-500/20 bg-rose-50/30 dark:bg-rose-950/20 rounded-2xl overflow-hidden shadow-xl shadow-rose-500/10">
          <CardHeader className="bg-rose-500/10 border-b border-rose-500/10 p-4">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-5 h-5 animate-bounce" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">{t("criticalValueAlerts")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-rose-500/10">
            {criticalAlerts.map((alert) => (
              <div key={alert.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="font-bold text-rose-900 dark:text-rose-100 text-sm">
                    {isRtl ? alert.patientNameAr : alert.patientNameEn} ({alert.patientNumber})
                  </h4>
                  <p className="text-xs font-medium text-rose-600/80 mt-1">
                    {isRtl ? alert.doctorNameAr : alert.doctorNameEn} • {format(alert.notifiedAt, "HH:mm", { locale: dateLocale })}
                  </p>
                  {alert.notes && <p className="text-[11px] mt-2 font-bold text-rose-800 dark:text-rose-300 bg-rose-500/5 p-2 rounded-lg italic">"{alert.notes}"</p>}
                </div>
                <Button 
                  size="sm" 
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl h-8 px-4 shrink-0 shadow-lg shadow-rose-500/20"
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={acknowledgingIds.has(alert.id)}
                >
                  {acknowledgingIds.has(alert.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRtl ? "تأكيد المتابعة" : "Acknowledge Follow-up")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── ORDERS TABS ────────────────────────── */}
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-2xl h-12 w-full md:w-auto grid grid-cols-3 md:flex md:items-center mb-6 border border-slate-200 dark:border-slate-800">
          <TabsTrigger value="pending" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm font-bold text-xs px-6 py-2">
            {t("pendingOrders")}
            <Badge className="ms-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black border-0 rounded-lg text-[10px]">
              {pendingOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="processing" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm font-bold text-xs px-6 py-2">
            {t("processingOrders")}
            <Badge className="ms-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-black border-0 rounded-lg text-[10px]">
              {processingOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm font-bold text-xs px-6 py-2">
            {t("completedOrders")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPending.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm font-bold flex flex-col items-center gap-3">
                  <ClipboardList className="w-12 h-12 opacity-10" />
                  {t("noOrders")}
                </div>
              ) : (
                filteredPending.map((order) => <OrderCard key={order.id} order={order} />)
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="processing" className="mt-0">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProcessing.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm font-bold flex flex-col items-center gap-3">
                  <Activity className="w-12 h-12 opacity-10" />
                  {t("noOrders")}
                </div>
              ) : (
                filteredProcessing.map((order) => <OrderCard key={order.id} order={order} />)
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCompleted.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm font-bold flex flex-col items-center gap-3">
                  <CheckCircle2 className="w-12 h-12 opacity-10" />
                  {t("noOrders")}
                </div>
              ) : (
                filteredCompleted.map((order) => <OrderCard key={order.id} order={order} />)
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
