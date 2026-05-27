"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout/PageShell";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  AlertTriangle, 
  MoreHorizontal,
  History,
  Edit2
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { 
  adjustStock, 
  getMedicationHistory 
} from "@/lib/actions/pharmacy";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input as UiInput } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format } from "date-fns";

interface Medication {
  id: string;
  nameAr: string;
  nameEn: string;
  genericName: string;
  form: string;
  strength: string;
  stockCount: number;
  minStockLevel: number;
  price: string | number;
  isActive: boolean;
  barcode: string | null;
}

interface PharmacyInventoryClientProps {
  initialData: Medication[];
  hospitalSlug: string;
  locale: string;
}

export default function PharmacyInventoryClient({
  initialData,
  hospitalSlug,
  locale,
}: PharmacyInventoryClientProps) {
  const t = useTranslations("pharmacy");
  const isRtl = locale === "ar";
  const [data, setData] = useState<Medication[]>(initialData);

  // Dialog States
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  // Adjustment Form State
  const [adjType, setAdjType] = useState<"stock_in" | "adjustment" | "waste" | "return">("stock_in");
  const [adjQuantity, setAdjQuantity] = useState(1);
  const [adjNotes, setAdjNotes] = useState("");

interface HistoryItem {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  performerNameAr: string | null;
  performerNameEn: string | null;
  createdAt: string | Date;
}

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const openAdjust = (med: Medication) => {
    setSelectedMed(med);
    setAdjType("stock_in");
    setAdjQuantity(1);
    setAdjNotes("");
    setIsAdjustDialogOpen(true);
  };

  const openHistory = async (med: Medication) => {
    setSelectedMed(med);
    setIsHistoryDialogOpen(true);
    setIsLoadingHistory(true);
    const res = await getMedicationHistory(med.id);
    if (res.success && "data" in res) {
      setHistory(res.data || []);
    } else {
      toast.error("error" in res ? String(res.error) : "Failed to load history");
    }
    setIsLoadingHistory(false);
  };

  const handleAdjust = async () => {
    if (!selectedMed) return;
    if (adjQuantity <= 0 && adjType === "stock_in") {
      toast.error(isRtl ? "يجب أن تكون الكمية أكبر من صفر." : "Quantity must be greater than zero.");
      return;
    }

    setIsActionPending(true);
    const res = await adjustStock({
      medicationId: selectedMed.id,
      type: adjType,
      quantity: adjType === "stock_in" || adjType === "return" ? adjQuantity : -adjQuantity,
      notes: adjNotes,
    });

    if (res.success) {
      toast.success(isRtl ? "تم تحديث المخزون بنجاح." : "Stock updated successfully.");
      setIsAdjustDialogOpen(false);
      // Refresh local data (simplistic approach)
      setData(prev => prev.map(m => 
        m.id === selectedMed.id 
          ? { ...m, stockCount: m.stockCount + (adjType === "stock_in" || adjType === "return" ? adjQuantity : -adjQuantity) }
          : m
      ));
    } else {
      toast.error("error" in res ? String(res.error) : "Failed to update stock");
    }
    setIsActionPending(false);
  };

  const columns: ColumnDef<Medication>[] = [
    {
      id: "name",
      header: t("medication"),
      cell: ({ row }) => {
        const name = isRtl ? row.original.nameAr : row.original.nameEn;
        return (
          <div className="flex flex-col">
            <span className="font-bold text-sm">{name}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-black">{row.original.genericName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "form",
      header: t("form"),
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize text-[10px] font-bold">
          {row.original.form}
        </Badge>
      ),
    },
    {
      accessorKey: "strength",
      header: t("strength"),
    },
    {
      accessorKey: "stockCount",
      header: t("stockCount"),
      cell: ({ row }) => {
        const count = row.original.stockCount;
        const low = count <= row.original.minStockLevel;
        return (
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-black text-lg",
              count === 0 ? "text-destructive" : low ? "text-amber-500" : "text-emerald-600"
            )}>
              {count}
            </span>
            {low && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      header: t("price"),
      cell: ({ row }) => (
        <div className="font-bold text-sm">
          {row.original.price} <span className="text-[10px] text-muted-foreground">{t("egp")}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="xs" 
            className="h-8 w-8 text-amber-600 hover:bg-amber-50"
            onClick={() => openAdjust(row.original)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="xs" 
            className="h-8 w-8 text-primary"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="xs" 
            className="h-8 w-8 text-muted-foreground"
            onClick={() => openHistory(row.original)}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const metrics = useMemo(() => {
    return {
      total: data.length,
      lowStock: data.filter(m => m.stockCount <= m.minStockLevel && m.stockCount > 0).length,
      outOfStock: data.filter(m => m.stockCount === 0).length,
    };
  }, [data]);

  return (
    <PageShell
      title={t("viewInventory")}
      subtitle={isRtl ? "إدارة المخزون وتتبع مستويات الأدوية" : "Manage stock levels and track medication inventory"}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl shadow-xs">
             <Filter className="me-2 h-4 w-4" />
             {isRtl ? "تصفية" : "Filter"}
          </Button>
          <Button variant="accent" className="rounded-xl shadow-md px-5">
            <Plus className="me-2 h-4 w-4" />
            {isRtl ? "إضافة دواء" : "Add Medication"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-primary/5 border-primary/10 rounded-2xl border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-primary/60 tracking-wider">
                  {isRtl ? "إجمالي الأدوية" : "Total Medications"}
                </p>
                <div className="text-3xl font-black text-primary">{metrics.total}</div>
              </div>
              <div className="bg-primary/10 p-3 rounded-xl">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/10 rounded-2xl border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-amber-600/60 tracking-wider">
                  {t("lowStock")}
                </p>
                <div className="text-3xl font-black text-amber-600">{metrics.lowStock}</div>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-500/5 border-rose-500/10 rounded-2xl border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-rose-600/60 tracking-wider">
                  {t("outOfStock")}
                </p>
                <div className="text-3xl font-black text-rose-600">{metrics.outOfStock}</div>
              </div>
              <div className="bg-rose-500/10 p-3 rounded-xl">
                <Package className="h-6 w-6 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/40 overflow-hidden shadow-sm">
        <CardContent className="pt-6">
          <DataTable 
            columns={columns} 
            data={data}
            searchKey="nameEn"
            searchPlaceholder={isRtl ? "البحث في المخزون..." : "Search inventory..."}
          />
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {isRtl ? "تعديل المخزون" : "Adjust Stock"}
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              {selectedMed && (isRtl ? selectedMed.nameAr : selectedMed.nameEn)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ps-1">{t("status")}</label>
              <Select value={adjType} onValueChange={(v) => setAdjType(v as "stock_in" | "adjustment" | "waste" | "return")}>
                <SelectTrigger className="h-12 rounded-xl border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_in">{isRtl ? "إضافة مخزون" : "Stock In"}</SelectItem>
                  <SelectItem value="adjustment">{isRtl ? "تعديل يدوي" : "Manual Adjustment"}</SelectItem>
                  <SelectItem value="return">{isRtl ? "مرتجع" : "Return"}</SelectItem>
                  <SelectItem value="waste">{isRtl ? "هالك / تالف" : "Waste / Damage"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ps-1">{isRtl ? "الكمية" : "Quantity"}</label>
              <UiInput 
                type="number" 
                className="h-12 rounded-xl text-lg font-black"
                value={adjQuantity}
                onChange={(e) => setAdjQuantity(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ps-1">{isRtl ? "ملاحظات" : "Notes"}</label>
              <Textarea 
                placeholder={isRtl ? "سبب التعديل..." : "Adjustment reason..."}
                className="rounded-xl min-h-[80px]"
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setIsAdjustDialogOpen(false)}>
              {t("close")}
            </Button>
            <Button 
              variant="accent" 
              className="rounded-xl font-black px-6 shadow-md"
              onClick={handleAdjust}
              disabled={isActionPending}
            >
              {isActionPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isRtl ? "تحديث المخزون" : "Update Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {isRtl ? "سجل العمليات" : "Transaction History"}
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              {selectedMed && (isRtl ? selectedMed.nameAr : selectedMed.nameEn)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground animate-pulse">
                  {isRtl ? "جارِ تحميل السجل..." : "Loading history..."}
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground font-medium">
                {isRtl ? "لا يوجد سجل لهذه المادة" : "No history found for this item."}
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((tx) => (
                  <div key={tx.id} className="p-4 rounded-2xl border border-border/40 bg-muted/20 flex items-center justify-between group hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-2 rounded-xl shrink-0",
                        tx.quantity > 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      )}>
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 h-4">
                            {tx.type.replace('_', ' ')}
                          </Badge>
                          <span className={cn(
                            "text-sm font-black",
                            tx.quantity > 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {tx.quantity > 0 ? "+" : ""}{tx.quantity}
                          </span>
                        </div>
                        {tx.notes && <p className="text-[11px] text-muted-foreground line-clamp-1">{tx.notes}</p>}
                        <div className="text-[10px] text-slate-400 font-medium">
                          {isRtl ? tx.performerNameAr : tx.performerNameEn} • {format(new Date(tx.createdAt), "yyyy/MM/dd HH:mm")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-border/10">
            <Button variant="outline" className="rounded-xl font-bold w-full" onClick={() => setIsHistoryDialogOpen(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

// Minimal Loader2 for local use
function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={cn("animate-spin", className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

