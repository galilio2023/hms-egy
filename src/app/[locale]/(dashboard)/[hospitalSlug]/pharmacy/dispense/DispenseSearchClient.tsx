"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout/PageShell";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Link, useRouter } from "@/i18n/routing";
import { Pill, Search, ClipboardList, Scan, Loader2, ArrowRight } from "lucide-react";
import { searchActivePrescriptions } from "@/lib/actions/pharmacy";
import { toast } from "sonner";
import { latinizeNumerals } from "@/lib/utils/egypt";

interface PrescriptionSummary {
  id: string;
  createdAt: string | Date;
  status: string;
  patientNameAr: string;
  patientNameEn: string;
  patientNumber: string;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
  itemCount: number;
}

interface DispenseSearchClientProps {
  initialPrescriptions: PrescriptionSummary[];
  hospitalSlug: string;
  locale: string;
}

export default function DispenseSearchClient({
  initialPrescriptions,
  hospitalSlug,
  locale,
}: DispenseSearchClientProps) {
  const t = useTranslations("pharmacy");
  const isRtl = locale === "ar";
  const router = useRouter();
  
  const [query, setQuery] = useState("");
  const [prescriptionsData, setPrescriptionsData] = useState<PrescriptionSummary[]>(initialPrescriptions);
  const [isPending, startTransition] = useTransition();
  const [barcodeInput, setBarcodeInput] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = latinizeNumerals(query.trim());
    startTransition(async () => {
      const res = await searchActivePrescriptions(cleanQuery);
      if (res.success && "data" in res && res.data) {
        setPrescriptionsData(res.data);
      } else {
        toast.error("error" in res ? String(res.error) : "Search failed");
      }
    });
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBarcode = latinizeNumerals(barcodeInput.trim());
    if (!cleanBarcode) return;

    // Check if the barcode input is a valid UUID (version agnostic to support v7)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(cleanBarcode)) {
      toast.success(isRtl ? "تم التعرف على رمز الوصفة" : "Prescription code recognized");
      router.push(`/${hospitalSlug}/pharmacy/dispense/${cleanBarcode}`);
    } else {
      // Treat as a general search query
      setQuery(cleanBarcode);
      startTransition(async () => {
        const res = await searchActivePrescriptions(cleanBarcode);
        if (res.success && "data" in res && res.data && res.data.length > 0) {
          setPrescriptionsData(res.data);
          toast.success(isRtl ? `تم العثور على ${res.data.length} وصفة` : `Found ${res.data.length} prescriptions`);
        } else {
          toast.error(isRtl ? "رمز غير معروف ولم يتم العثور على نتائج" : "Unknown code and no results found");
        }
      });
    }
    setBarcodeInput("");
  };

  const columns: ColumnDef<PrescriptionSummary>[] = [
    {
      accessorKey: "patientName",
      header: t("patient"),
      cell: ({ row }) => {
        const name = isRtl ? row.original.patientNameAr : row.original.patientNameEn;
        return (
          <div className="flex flex-col">
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{name}</span>
            <span className="text-xs text-muted-foreground">{row.original.patientNumber}</span>
          </div>
        );
      },
    },
    {
      id: "doctorName",
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
        <span className="text-xs font-medium" suppressHydrationWarning>
          {format(new Date(row.original.createdAt), "yyyy-MM-dd HH:mm")}
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

  return (
    <PageShell
      title={isRtl ? "صرف الأدوية" : "Dispense Medications"}
      subtitle={isRtl ? "صرف الوصفات الطبية للمرضى باستخدام الباركود" : "Dispense patient prescriptions using barcodes"}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8" dir={isRtl ? "rtl" : "ltr"}>
        {/* Barcode Quick Dispense Card */}
        <Card className="lg:col-span-1 border border-border/40 shadow-sm rounded-2xl bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <Scan className="h-5 w-5" />
              {isRtl ? "المسح السريع للباركود" : "Quick Barcode Scan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isRtl 
                ? "امسح باركود الوصفة الطبية (أو كود المريض) باستخدام جهاز القارئ مباشرة للصرف الفوري." 
                : "Scan the prescription barcode (or patient code) using a hardware scanner to open it instantly."}
            </p>
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <Input
                placeholder={isRtl ? "امسح أو اكتب رمز الوصفة..." : "Scan or type prescription ID..."}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="h-12 bg-background border-primary/20 rounded-xl focus-visible:ring-primary/40 font-mono text-center"
                autoFocus
              />
              <Button type="submit" size="xs" className="absolute end-1 top-1 h-10 w-10 rounded-lg">
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Prescription Search Card */}
        <Card className="lg:col-span-2 border border-border/40 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              {isRtl ? "بحث الوصفات الطبية" : "Search Prescriptions"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isRtl ? "ابحث باسم المريض، الرقم الطبي أو رقم الوصفة..." : "Search by patient name, number, or prescription ID..."}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="ps-10 h-12 rounded-xl"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-6 rounded-xl font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRtl ? "بحث" : "Search")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Main Prescription Queue */}
      <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
        <CardHeader className="bg-muted/30 border-b border-border/10 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {isRtl ? "طابور الوصفات المعلقة" : "Pending Prescriptions Queue"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={prescriptionsData}
            searchKey="patientName"
            searchPlaceholder={t("noPendingPrescriptions")}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
