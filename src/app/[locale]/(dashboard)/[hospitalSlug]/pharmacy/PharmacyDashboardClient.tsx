"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Pill, 
  Package, 
  Activity, 
  AlertTriangle, 
  ClipboardList,
  Plus,
  ArrowUpRight
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Link } from "@/i18n/routing";

interface PharmacyDashboardClientProps {
  initialData: {
    pendingPrescriptions: any[];
    lowStock: any[];
    recentTransactions: any[];
  };
  hospitalSlug: string;
  locale: string;
}

export default function PharmacyDashboardClient({
  initialData,
  hospitalSlug,
  locale,
}: PharmacyDashboardClientProps) {
  const t = useTranslations("pharmacy");
  const isRtl = locale === "ar";

  const prescriptionColumns: ColumnDef<any>[] = [
    {
      accessorKey: "patientName",
      header: t("patient"),
      cell: ({ row }) => {
        const name = isRtl ? row.original.patientNameAr : row.original.patientNameEn;
        return (
          <div className="flex flex-col">
            <span className="font-bold">{name}</span>
            <span className="text-xs text-muted-foreground">{row.original.patientNumber}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "doctorName",
      header: t("doctor"),
      cell: ({ row }) => (isRtl ? row.original.doctorNameAr : row.original.doctorNameEn),
    },
    {
      accessorKey: "itemCount",
      header: t("medication"),
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-primary/5">
          {row.original.itemCount} {t("unit")}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("date"),
      cell: ({ row }) => (
        <span className="text-xs font-medium">
          {format(new Date(row.original.createdAt), "HH:mm")}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <Button asChild size="sm" variant="accent" className="h-8 rounded-lg shadow-sm">
          <Link href={`/${hospitalSlug}/pharmacy/dispense/${row.original.id}`}>
            {t("dispense")}
          </Link>
        </Button>
      ),
    },
  ];

  const lowStockColumns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: t("medication"),
      cell: ({ row }) => (isRtl ? row.original.nameAr : row.original.nameEn),
    },
    {
      accessorKey: "stockCount",
      header: t("stockCount"),
      cell: ({ row }) => (
        <span className={row.original.stockCount === 0 ? "text-destructive font-bold" : "text-amber-600 font-bold"}>
          {row.original.stockCount}
        </span>
      ),
    },
    {
      accessorKey: "minStockLevel",
      header: t("minStock"),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary">
          <Plus className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title={t("title")}
      subtitle={t("description")}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild className="rounded-xl shadow-xs">
            <Link href={`/${hospitalSlug}/pharmacy/inventory`}>
              <Package className="me-2 h-4 w-4" />
              {t("viewInventory")}
            </Link>
          </Button>
          <Button variant="accent" asChild className="rounded-xl shadow-md px-5">
            <Link href={`/${hospitalSlug}/pharmacy/dispense`}>
              <Plus className="me-2 h-4 w-4" />
              {t("dispenseMedication")}
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-primary/5 border-primary/10 rounded-2xl border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary/70">{t("pendingPrescriptions")}</CardTitle>
            <div className="bg-primary/10 p-2 rounded-lg">
              <ClipboardList className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{initialData.pendingPrescriptions.length}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {isRtl ? "وصفات بانتظار الصرف" : "Prescriptions awaiting fulfillment"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/10 rounded-2xl border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-700/70">{t("lowStock")}</CardTitle>
            <div className="bg-amber-500/10 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-600">{initialData.lowStock.length}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {isRtl ? "أدوية تحت حد الطلب" : "Items below minimum level"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-teal-500/5 border-teal-500/10 rounded-2xl border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-teal-700/70">{t("recentActivity")}</CardTitle>
            <div className="bg-teal-500/10 p-2 rounded-lg">
              <Activity className="h-4 w-4 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-teal-600">{initialData.recentTransactions.length}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {isRtl ? "عمليات اليوم" : "Total operations today"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border-border/40 overflow-hidden shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/30 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                {t("prescriptionQueue")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-primary hover:bg-primary/10">
                {isRtl ? "عرض الكل" : "View All"}
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <DataTable 
                columns={prescriptionColumns} 
                data={initialData.pendingPrescriptions}
                searchKey="patientName"
                searchPlaceholder={t("noPendingPrescriptions")}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border-border/40 overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                {t("inventoryAlerts")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {initialData.lowStock.length > 0 ? (
                <DataTable 
                  columns={lowStockColumns} 
                  data={initialData.lowStock}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                  {t("noInventoryAlerts")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40 overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-600" />
                {t("recentActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {initialData.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm border-b border-border/20 pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {isRtl ? tx.medicationNameAr : tx.medicationNameEn}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0 uppercase font-black">
                          {tx.type.replace('_', ' ')}
                        </Badge>
                        <span className={cn(
                          "text-xs font-black",
                          tx.quantity > 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {tx.quantity > 0 ? "+" : ""}{tx.quantity}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      {format(new Date(tx.createdAt), "HH:mm")}
                    </span>
                  </div>
                ))}
                {initialData.recentTransactions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                    {isRtl ? "لا يوجد نشاط مؤخراً" : "No recent activity"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
