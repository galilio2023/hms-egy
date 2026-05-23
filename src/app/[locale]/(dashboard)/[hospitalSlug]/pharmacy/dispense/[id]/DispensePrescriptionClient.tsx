"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Pill, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Barcode, 
  Camera, 
  ChevronLeft, 
  Trash2, 
  Loader2, 
  Save, 
  DollarSign, 
  Layers 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dispensePrescription } from "@/lib/actions/pharmacy";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/routing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// We import Html5Qrcode dynamically to avoid server-side window undefined error
let Html5Qrcode: any = null;
if (typeof window !== "undefined") {
  import("html5-qrcode").then((mod) => {
    Html5Qrcode = mod.Html5Qrcode;
  });
}

interface MedicationItem {
  id: string; // prescriptionItem id
  medicationId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string | null;
  dispensedCount: number;
  status: string;
  medicationNameAr: string;
  medicationNameEn: string;
  genericName: string;
  form: string;
  strength: string;
  barcode: string | null;
  stockCount: number;
  price: string | number;
}

interface PrescriptionDetails {
  id: string;
  createdAt: string | Date;
  status: string;
  notes: string | null;
  hasDdiOverride: boolean;
  ddiOverrideReason: string | null;
  patientId: string;
  patientNameAr: string;
  patientNameEn: string;
  patientNumber: string;
  nationalId: string | null;
  gender: string | null;
  birthDate: string | Date | null;
  allergies: string[] | null;
  chronicConditions: string[] | null;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
  doctorRole: string | null;
  items: MedicationItem[];
}

interface DispensePrescriptionClientProps {
  prescription: PrescriptionDetails;
  hospitalSlug: string;
  locale: string;
}

export default function DispensePrescriptionClient({
  prescription,
  hospitalSlug,
  locale,
}: DispensePrescriptionClientProps) {
  const t = useTranslations("pharmacy");
  const isRtl = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dispensing items state
  const [items, setItems] = useState<
    (MedicationItem & { verified: boolean; qtyToDispense: number })[]
  >(
    prescription.items.map((item) => ({
      ...item,
      verified: false,
      // Default dispense quantity is 1 or something reasonable
      qtyToDispense: item.stockCount > 0 ? 1 : 0,
    }))
  );

  // Scanner inputs
  const [manualBarcode, setManualBarcode] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const qrScannerRef = useRef<any>(null);

  // Auto-focus barcode input
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Age calculation
  const getAge = (birthDate: Date | string | null) => {
    if (!birthDate) return "";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Sound feedback simulation using browser synthesiser
  const playBeep = (type: "success" | "error") => {
    if (typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "success") {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("Audio Context not supported", e);
    }
  };

  // Handle scanned/typed barcode matching
  const verifyBarcode = (barcode: string) => {
    const code = barcode.trim().toLowerCase();
    if (!code) return;

    // Find if barcode matches any medication in the list
    const matchedIndex = items.findIndex(
      (item) =>
        (item.barcode && item.barcode.trim().toLowerCase() === code) ||
        item.medicationId.toLowerCase() === code
    );

    if (matchedIndex !== -1) {
      const matchedItem = items[matchedIndex];
      
      if (matchedItem.stockCount <= 0) {
        playBeep("error");
        toast.error(
          isRtl 
            ? `عذراً، هذا الدواء (${matchedItem.medicationNameAr}) غير متوفر في المخزون.` 
            : `Sorry, this medication (${matchedItem.medicationNameEn}) is out of stock.`
        );
        return;
      }

      playBeep("success");
      toast.success(
        isRtl 
          ? `تم التحقق من الدواء: ${matchedItem.medicationNameAr}` 
          : `Verified medication: ${matchedItem.medicationNameEn}`
      );

      setItems((prev) =>
        prev.map((item, idx) => {
          if (idx === matchedIndex) {
            return {
              ...item,
              verified: true,
              qtyToDispense: item.qtyToDispense === 0 ? 1 : item.qtyToDispense,
            };
          }
          return item;
        })
      );
    } else {
      playBeep("error");
      toast.error(
        isRtl 
          ? `عذراً، الرمز (${barcode}) لا يطابق أي دواء في هذه الوصفة.` 
          : `Sorry, code (${barcode}) does not match any medication in this prescription.`
      );
    }
  };

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyBarcode(manualBarcode);
    setManualBarcode("");
    // Re-focus input
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Initialize and close camera scanner
  useEffect(() => {
    if (isCameraOpen && Html5Qrcode) {
      const startScanner = async () => {
        try {
          // Add a short delay to ensure the DOM element #reader is mounted
          await new Promise((resolve) => setTimeout(resolve, 300));
          
          const html5QrCode = new Html5Qrcode("reader");
          qrScannerRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width: number, height: number) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              },
            },
            (decodedText: string) => {
              verifyBarcode(decodedText);
              setIsCameraOpen(false); // Close after successful scan
            },
            (errorMessage: string) => {
              // Verbose scanning error, silent ignore
            }
          );
        } catch (err) {
          console.error("Camera scan start error:", err);
          toast.error(isRtl ? "فشل تشغيل الكاميرا." : "Failed to open camera.");
          setIsCameraOpen(false);
        }
      };

      startScanner();
    }

    return () => {
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current
          .stop()
          .then(() => {
            qrScannerRef.current = null;
          })
          .catch((err: any) => console.error("Scanner stop error:", err));
      }
    };
  }, [isCameraOpen]);

  // Adjust dispensing quantities
  const updateQty = (id: string, val: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, Math.min(item.stockCount, val));
          return { ...item, qtyToDispense: newQty };
        }
        return item;
      })
    );
  };

  // Checkbox toggle verification
  const toggleVerify = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, verified: !item.verified };
        }
        return item;
      })
    );
  };

  // Financial summary
  const totalCost = items
    .filter((i) => i.verified)
    .reduce((sum, item) => sum + Number(item.price) * item.qtyToDispense, 0);

  // Submit dispensing
  const handleDispenseSubmit = () => {
    const verifiedItems = items.filter((i) => i.verified && i.qtyToDispense > 0);

    if (verifiedItems.length === 0) {
      toast.error(
        isRtl 
          ? "الرجاء التحقق من دواء واحد على الأقل وتحديد كميته قبل الصرف." 
          : "Please verify at least one medication and set its quantity before dispensing."
      );
      return;
    }

    startTransition(async () => {
      const res = await dispensePrescription(
        prescription.id,
        verifiedItems.map((i) => ({
          prescriptionItemId: i.id,
          medicationId: i.medicationId,
          quantity: i.qtyToDispense,
        }))
      );

      if (res.success) {
        toast.success(isRtl ? "تم صرف الأدوية بنجاح وتحديث المخزون." : "Medication dispensed and stock updated successfully.");
        router.push(`/${hospitalSlug}/pharmacy`);
      } else {
        toast.error("error" in res ? String(res.error) : "Failed to dispense");
      }
    });
  };

  const patientName = isRtl ? prescription.patientNameAr : prescription.patientNameEn;
  const doctorName = isRtl ? prescription.doctorNameAr : prescription.doctorNameEn;
  const doctorRole = prescription.doctorRole || "";

  return (
    <PageShell
      title={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" asChild className="h-8 w-8 rounded-lg">
            <Link href={`/${hospitalSlug}/pharmacy/dispense`}>
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </Button>
          <span>{isRtl ? "تفاصيل وصرف الوصفة الطبية" : "Prescription Details & Dispensation"}</span>
        </div>
      }
      subtitle={isRtl ? `وصفة رقم: #${prescription.id.slice(0, 8)}` : `Prescription ID: #${prescription.id.slice(0, 8)}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" dir={isRtl ? "rtl" : "ltr"}>
        
        {/* Left Section: Patient & Doctor Info + Checklist */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Patient Banner */}
          <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden">
            <div className="bg-primary/5 px-6 py-4 border-b border-border/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-full">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">{patientName}</h3>
                  <p className="text-xs text-muted-foreground">{t("patient")} #{prescription.patientNumber}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-muted-foreground">{isRtl ? "الهوية الوطنية: " : "National ID: "}</span>
                  <span className="font-bold">{prescription.nationalId || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRtl ? "العمر: " : "Age: "}</span>
                  <span className="font-bold">{getAge(prescription.birthDate)} {isRtl ? "سنة" : "years"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRtl ? "الجنس: " : "Gender: "}</span>
                  <span className="font-bold">{prescription.gender === "male" ? (isRtl ? "ذكر" : "Male") : (isRtl ? "أنثى" : "Female")}</span>
                </div>
              </div>
            </div>

            <CardContent className="pt-4 space-y-3">
              {/* Allergy Alert */}
              {prescription.allergies && prescription.allergies.length > 0 ? (
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex gap-3 items-center">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="text-xs">
                    <span className="font-black text-destructive block mb-0.5">
                      {isRtl ? "تنبيه الحساسية السريرية!" : "Clinical Allergy Alert!"}
                    </span>
                    <span className="font-medium text-destructive/80">
                      {isRtl 
                        ? `المريض يعاني من حساسية تجاه: ${prescription.allergies.join("، ")}` 
                        : `Patient is allergic to: ${prescription.allergies.join(", ")}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-600 font-bold">
                  ✓ {isRtl ? "لا توجد حساسية دوائية مسجلة للمريض" : "No documented allergies for this patient"}
                </div>
              )}

              {prescription.chronicConditions && prescription.chronicConditions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 items-center">
                  <span className="text-xs font-bold text-muted-foreground">{isRtl ? "الأمراض المزمنة:" : "Chronic Conditions:"}</span>
                  {prescription.chronicConditions.map((cond, index) => (
                    <Badge key={index} variant="secondary" className="text-[10px] rounded-lg">
                      {cond}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Doctor Details & Prescription Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-border/40 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase">{t("doctor")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-bold text-slate-800 dark:text-slate-100">{doctorName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{doctorRole}</div>
              </CardContent>
            </Card>

            <Card className="border border-border/40 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase">{isRtl ? "تعليمات الطبيب" : "Doctor's Notes"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 italic">
                  {prescription.notes || (isRtl ? "لا توجد ملاحظات" : "No notes provided")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* DDI override warning if exists */}
          {prescription.hasDdiOverride && (
            <Card className="border-amber-500/20 bg-amber-500/5 shadow-none rounded-2xl">
              <CardContent className="pt-4 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-black text-amber-800 dark:text-amber-500 block">
                    {isRtl ? "تنبيه: تم تجاوز التداخلات الدوائية" : "Notice: Clinical Alerts Overridden"}
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    {isRtl ? `المبرر الطبي للطبيب: ${prescription.ddiOverrideReason}` : `Doctor's medical justification: ${prescription.ddiOverrideReason}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prescription Medications Checklist */}
          <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/10 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                {isRtl ? "قائمة الأدوية الموصوفة" : "Prescribed Medication Checklist"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border/20 text-xs font-bold text-muted-foreground uppercase text-start">
                      <th className="px-6 py-4 text-start">{t("medication")}</th>
                      <th className="px-6 py-4 text-start">{isRtl ? "التعليمات والجرعة" : "Instructions & Dosage"}</th>
                      <th className="px-6 py-4 text-center">{isRtl ? "حالة المخزون" : "Stock Status"}</th>
                      <th className="px-6 py-4 text-center">{isRtl ? "الكمية للصرف" : "Qty to Dispense"}</th>
                      <th className="px-6 py-4 text-center">{isRtl ? "حالة التحقق" : "Verification"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {items.map((item) => {
                      const medName = isRtl ? item.medicationNameAr : item.medicationNameEn;
                      const hasLowStock = item.stockCount <= 0;
                      
                      return (
                        <tr 
                          key={item.id}
                          className={cn(
                            "transition-all duration-300",
                            item.verified 
                              ? "bg-emerald-500/5 hover:bg-emerald-500/10" 
                              : "hover:bg-muted/20"
                          )}
                        >
                          <td className="px-6 py-4 text-start">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-100">{medName}</span>
                              <span className="text-[11px] text-muted-foreground">{item.genericName} • {item.strength}</span>
                              {item.barcode && (
                                <span className="text-[10px] font-mono text-primary flex items-center gap-1 mt-0.5">
                                  <Barcode className="h-3 w-3" /> {item.barcode}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-start">
                            <div className="text-xs space-y-0.5">
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{item.dosage}</span>
                                <span className="mx-1 text-slate-400">|</span>
                                <span className="font-medium text-slate-600 dark:text-slate-400">{item.frequency}</span>
                                <span className="mx-1 text-slate-400">|</span>
                                <span className="font-bold text-primary">{item.durationDays} {isRtl ? "أيام" : "days"}</span>
                              </div>
                              {item.instructions && (
                                <p className="text-[11px] italic text-muted-foreground">{item.instructions}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {hasLowStock ? (
                              <Badge variant="destructive" className="rounded-lg text-[10px] font-bold">
                                {isRtl ? "نفذ من المخزون" : "Out of stock"} (0)
                              </Badge>
                            ) : (
                              <div className="flex flex-col items-center">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "rounded-lg text-[10px] font-bold",
                                    item.stockCount <= 5 ? "text-amber-600 border-amber-500/30 bg-amber-500/5" : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                                  )}
                                >
                                  {item.stockCount} {isRtl ? "متوفر" : "in stock"}
                                </Badge>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 max-w-[100px] mx-auto">
                              <Button
                                variant="outline"
                                size="xs"
                                className="h-7 w-7 rounded-md"
                                onClick={() => updateQty(item.id, item.qtyToDispense - 1)}
                                disabled={item.qtyToDispense <= 0 || !item.verified}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                className="h-7 w-12 text-center text-xs px-1 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={item.qtyToDispense}
                                onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 0)}
                                disabled={!item.verified}
                              />
                              <Button
                                variant="outline"
                                size="xs"
                                className="h-7 w-7 rounded-md"
                                onClick={() => updateQty(item.id, item.qtyToDispense + 1)}
                                disabled={item.qtyToDispense >= item.stockCount || !item.verified}
                              >
                                +
                              </Button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center">
                              {item.verified ? (
                                <button 
                                  onClick={() => toggleVerify(item.id)}
                                  className="text-emerald-600 hover:text-rose-600 flex items-center gap-1 text-xs font-black cursor-pointer transition-colors"
                                >
                                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                                  <span>{isRtl ? "تم التحقق" : "Verified"}</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => toggleVerify(item.id)}
                                  className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs font-semibold cursor-pointer transition-colors"
                                  disabled={hasLowStock}
                                >
                                  <div className="h-4 w-4 rounded-full border border-border/40 shrink-0" />
                                  <span>{isRtl ? "مسح للتحقق" : "Verify item"}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Section: Barcode Scanner inputs + Checkout Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* Barcode scanner console */}
          <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-primary/5 to-background">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Barcode className="h-4 w-4 text-primary" />
                {isRtl ? "قارئ الباركود" : "Barcode Scanner"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <form onSubmit={handleManualBarcodeSubmit} className="space-y-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {isRtl 
                    ? "وجه قارئ الباركود اليدوي للمسح مباشرة، أو اكتب باركود الدواء يدوياً للتحقق." 
                    : "Focus on the input field and scan the medication barcode using your scanner gun."}
                </p>
                <Input
                  ref={barcodeInputRef}
                  placeholder={isRtl ? "مسح الباركود للمطابقة..." : "Scan barcode to verify..."}
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="h-10 text-center font-mono text-sm bg-background border-primary/20 rounded-xl"
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary" className="flex-1 text-xs font-bold rounded-xl h-10">
                    {isRtl ? "تحقق" : "Verify"}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="h-10 w-10 shrink-0 rounded-xl"
                    onClick={() => setIsCameraOpen(true)}
                  >
                    <Camera className="h-4 w-4 text-slate-700" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Checkout Invoice Summary */}
          <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/10 pb-4">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {isRtl ? "ملخص الصرف والرسوم" : "Dispensing Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="text-xs space-y-2.5 font-medium text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>{isRtl ? "الوصفات المحققة:" : "Verified items:"}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {items.filter(i => i.verified).length} / {items.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? "إجمالي وحدات الصرف:" : "Total units dispensing:"}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {items.filter(i => i.verified).reduce((sum, item) => sum + item.qtyToDispense, 0)} {isRtl ? "وحدة" : "units"}
                  </span>
                </div>
                <div className="border-t border-border/20 pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{isRtl ? "التكلفة الإجمالية:" : "Total Cost:"}</span>
                  <span className="text-lg font-black text-primary" suppressHydrationWarning>
                    {totalCost.toFixed(2)} {t("egp")}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleDispenseSubmit}
                disabled={isPending || items.filter((i) => i.verified && i.qtyToDispense > 0).length === 0}
                className="w-full h-12 rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all duration-300"
                variant="accent"
              >
                {isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                {isRtl ? "تأكيد وصرف الوصفة" : "Confirm & Dispense"}
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Camera scan scanner modal */}
      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-border/40">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {isRtl ? "مسح الباركود بالكاميرا" : "Camera Barcode Scanner"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isRtl 
                ? "وجه كاميرا الهاتف أو الكمبيوتر نحو باركود الدواء لمطابقته." 
                : "Point your device's camera towards the medication barcode to verify."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center bg-slate-950 p-2 rounded-xl overflow-hidden aspect-square relative max-w-sm mx-auto w-full">
            <div id="reader" className="w-full h-full bg-slate-900 rounded-lg"></div>
            <div className="absolute inset-0 border-[30px] border-black/35 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-primary border-dashed rounded-lg animate-pulse" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
