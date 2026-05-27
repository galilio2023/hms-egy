"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Pill, 
  Search, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  ChevronRight,
  ChevronDown,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { searchMedications, runDdiCheck, createPrescription } from "@/lib/actions/pharmacy";
import { DdiResult, Interaction, AllergyAlert } from "@/lib/pharmacy/ddi";
import { toast } from "sonner";

interface Medication {
  id: string;
  nameAr: string;
  nameEn: string;
  genericName: string;
  form: string;
  strength: string;
}

interface PrescriptionItem {
  medicationId: string;
  medicationName: string;
  medicationGeneric: string;
  dosage: string;
  frequency: string;
  durationDays: number | "";
  instructions: string;
}

interface PrescriptionWriterProps {
  patientId: string;
  onSuccess?: (rxId: string) => void;
}

export function PrescriptionWriter({ patientId, onSuccess }: PrescriptionWriterProps) {
  const t = useTranslations("pharmacy");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const hospitalSlug = params.hospitalSlug as string;
  
  const isRtl = locale === "ar";
  const [isPending, startTransition] = useTransition();

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Medication[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Prescription States
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [notes, setNotes] = useState("");
  const [hasDdiOverride, setHasDdiOverride] = useState(false);
  const [ddiOverrideReason, setDdiOverrideReason] = useState("");

  // DDI Analysis States
  const [ddiResult, setDdiResult] = useState<DdiResult | null>(null);
  const [isCheckingDdi, setIsCheckingDdi] = useState(false);

  // Debounced search
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/clinical/medications?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (active && json.data) {
          setSearchResults(json.data);
        }
      } catch (err) {
        console.error("Search error:", err);
      }
      setIsSearching(false);
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Debounced DDI check
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (items.length === 0) {
        setDdiResult(null);
        return;
      }
      setIsCheckingDdi(true);
      const res = await runDdiCheck(patientId, items.map(i => ({
        medicationId: i.medicationId,
        dosage: i.dosage,
        frequency: i.frequency,
        durationDays: i.durationDays === "" ? 1 : i.durationDays
      })));
      if (active && res.success && "data" in res) {
        setDdiResult(res.data);
      }
      setIsCheckingDdi(false);
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [items, patientId]);

  const addMedication = (med: Medication) => {
    // Check if already added
    if (items.some(i => i.medicationId === med.id)) {
      toast.error(t("medAddedError"));
      return;
    }

    const newItem: PrescriptionItem = {
      medicationId: med.id,
      medicationName: isRtl ? med.nameAr : med.nameEn,
      medicationGeneric: med.genericName,
      dosage: "",
      frequency: "",
      durationDays: 7,
      instructions: "",
    };

    setItems([...items, newItem]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const updateItem = (index: number, field: keyof PrescriptionItem, value: any) => {
    const newItems = [...items];
    let sanitizedValue = value;
    if (field === "durationDays") {
      // Allow empty string for natural typing experience
      sanitizedValue = value === "" ? "" : (isNaN(parseInt(value)) ? 1 : parseInt(value));
    }
    newItems[index] = { ...newItems[index], [field]: sanitizedValue };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (items.length === 0) {
      toast.error(t("atLeastOneMedError"));
      return;
    }

    // Check for required fields in items
    const incomplete = items.some(i => !i.dosage || !i.frequency || i.durationDays === "");
    if (incomplete) {
      toast.error(t("completeDetailsError"));
      return;
    }

    const invalidDuration = items.some(i => typeof i.durationDays === "number" && i.durationDays <= 0);
    if (invalidDuration) {
      toast.error(isRtl ? "يجب أن تكون مدة العلاج يوماً واحداً على الأقل." : "Duration must be at least 1 day.");
      return;
    }

    // Strict block on contraindicated if not overridden (or even with override if your policy is strict)
    if (ddiResult && !ddiResult.isApproved && !hasDdiOverride) {
      toast.error(t("contraindicatedError"));
      return;
    }

    startTransition(async () => {
      const res = await createPrescription({
        patientId,
        items: items.map(i => ({
          medicationId: i.medicationId,
          dosage: i.dosage,
          frequency: i.frequency,
          durationDays: i.durationDays === "" ? 1 : i.durationDays as number,
          instructions: i.instructions
        })),
        notes,
        hasDdiOverride,
        ddiOverrideReason
      });

      if (res.success) {
        toast.success(t("prescriptionSuccess"));
        if (onSuccess && "rxId" in res) onSuccess(res.rxId as string);
        // Standard redirection to patient profile
        router.push(`/${locale}/${hospitalSlug}/patients/${patientId}`);
      } else {
        toast.error("error" in res ? String(res.error) : "Failed to create prescription");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black">
            <Pill className="h-6 w-6 text-primary" />
            {t("prescriptionWriter")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          
          {/* Medication Search */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchMedicationPlaceholder")}
                className="ps-10 h-12 rounded-xl shadow-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div className="absolute end-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <Card className="absolute z-50 w-full mt-2 rounded-xl shadow-lg border-border/40 max-h-64 overflow-y-auto">
                <CardContent className="p-2">
                  {searchResults.map((med) => (
                    <button
                      key={med.id}
                      className="w-full text-start p-3 hover:bg-muted rounded-lg transition-colors flex items-center justify-between group"
                      onClick={() => addMedication(med)}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{isRtl ? med.nameAr : med.nameEn}</span>
                        <span className="text-xs text-muted-foreground">{med.genericName} • {med.strength}</span>
                      </div>
                      <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Prescription Items List */}
          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border/40 rounded-2xl">
                <div className="bg-primary/5 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Pill className="h-6 w-6 text-primary/40" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">
                  {t("noMedsAdded")}
                </p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={item.medicationId} className="group relative p-4 rounded-2xl border border-border/40 bg-background/50 hover:border-primary/20 hover:bg-primary/5 transition-all duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block ps-1">
                        {t("medication")}
                      </label>
                      <div className="font-bold text-sm truncate">{item.medicationName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{item.medicationGeneric}</div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block ps-1">
                        {t("dosage")}
                      </label>
                      <Input 
                        placeholder="1 tablet"
                        className="h-9 rounded-lg text-xs"
                        value={item.dosage}
                        onChange={(e) => updateItem(idx, "dosage", e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block ps-1">
                        {t("frequency")}
                      </label>
                      <Input 
                        placeholder="3x daily"
                        className="h-9 rounded-lg text-xs"
                        value={item.frequency}
                        onChange={(e) => updateItem(idx, "frequency", e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block ps-1">
                        {t("durationDays")}
                      </label>
                      <Input 
                        type="number"
                        className="h-9 rounded-lg text-xs"
                        value={item.durationDays}
                        onChange={(e) => updateItem(idx, "durationDays", e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="xs" 
                        className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="md:col-span-12">
                      <Input 
                        placeholder={t("additionalInstructions")}
                        className="h-8 rounded-lg text-[11px] bg-background/50"
                        value={item.instructions}
                        onChange={(e) => updateItem(idx, "instructions", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DDI & Allergy Alerts Panel */}
          {(isCheckingDdi || ddiResult) && (
            <Card className={cn(
              "rounded-2xl border-0 shadow-none animate-in fade-in slide-in-from-top-4 duration-300",
              ddiResult?.overallRiskLevel === "high" ? "bg-rose-500/5" : 
              ddiResult?.overallRiskLevel === "medium" ? "bg-amber-500/5" : "bg-emerald-500/5"
            )}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className={cn(
                  "text-sm font-black uppercase tracking-wider flex items-center gap-2",
                  ddiResult?.overallRiskLevel === "high" ? "text-rose-600" : 
                  ddiResult?.overallRiskLevel === "medium" ? "text-amber-600" : "text-emerald-600"
                )}>
                  {isCheckingDdi ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("analyzingInteractions")}
                    </>
                  ) : (
                    <>
                      {ddiResult?.overallRiskLevel === "high" ? <AlertTriangle className="h-4 w-4" /> : 
                       ddiResult?.overallRiskLevel === "medium" ? <Info className="h-4 w-4" /> : 
                       <CheckCircle2 className="h-4 w-4" />}
                      {t("safetyAnalysis")}
                    </>
                  )}
                </CardTitle>
                {!isCheckingDdi && ddiResult && (
                  <Badge variant={ddiResult.overallRiskLevel === "high" ? "destructive" : "outline"} className="uppercase text-[10px]">
                    {ddiResult.overallRiskLevel} risk
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {ddiResult && !isCheckingDdi && (
                  <>
                    {/* Interaction Alerts */}
                    {ddiResult.interactions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-muted-foreground uppercase ps-1">
                          {t("detectedInteractions")}
                        </h4>
                        {ddiResult.interactions.map((interaction, i) => (
                          <div key={i} className="flex gap-3 p-3 rounded-xl bg-background/80 shadow-xs border border-border/40">
                            <div className={cn(
                              "p-1.5 rounded-lg shrink-0 h-fit",
                              interaction.severity === "contraindicated" || interaction.severity === "severe" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                            )}>
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-bold">
                                {interaction.drug1} + {interaction.drug2}
                              </div>
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                {isRtl ? interaction.mechanismAr || interaction.effectAr : interaction.mechanismEn || interaction.effectEn}
                              </p>
                              <Badge variant="outline" className="text-[9px] h-4 py-0 uppercase font-bold">
                                {interaction.severity}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Allergy Alerts */}
                    {ddiResult.allergyAlerts.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-muted-foreground uppercase ps-1">
                          {t("allergyAlerts")}
                        </h4>
                        {ddiResult.allergyAlerts.map((allergy, i) => (
                          <div key={i} className="flex gap-3 p-3 rounded-xl bg-background/80 shadow-xs border border-border/40">
                            <div className="bg-rose-100 p-1.5 rounded-lg shrink-0 h-fit text-rose-600">
                              <XCircle className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-bold">
                                {t("potentialAllergy")} {allergy.medication}
                              </div>
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                {t("reactsWithAllergy")} {allergy.allergen}
                              </p>
                              {allergy.notes && <p className="text-[10px] italic text-rose-500">{allergy.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI Enrichment Indicator */}
                    {ddiResult.requiresAiEnrichment && !ddiResult.aiAnalysisAr && !ddiResult.aiAnalysisEn && (
                      <div className="bg-primary/10 p-3 rounded-xl flex items-center gap-3">
                        <Loader2 className="h-4 w-4 text-primary animate-pulse" />
                        <div className="text-[11px] font-medium text-primary-foreground/80">
                          {t("aiEnrichmentWarning")}
                        </div>
                      </div>
                    )}

                    {/* Claude AI Clinical Reasoning Output */}
                    {(ddiResult.aiAnalysisAr || ddiResult.aiAnalysisEn) && (
                      <div className="mt-4 p-4.5 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-2.5 relative overflow-hidden text-start">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,#0d948810_0%,transparent_50%)] pointer-events-none" />
                        <div className="relative flex items-center gap-2 text-xs font-bold text-accent">
                          <Sparkles className="h-4 w-4 text-accent animate-pulse" />
                          <span>
                            {ddiResult.isAiOptimized 
                              ? (isRtl ? "التحليل السريري الذكي (Claude AI)" : "Clinical Safety Intelligence (Claude AI)")
                              : (isRtl ? "التحليل السريري المدمج (قاعدة البيانات)" : "Clinical Safety Analysis (Local Database)")}
                          </span>
                        </div>
                        <div className="text-xs leading-relaxed text-slate-300 font-cairo whitespace-pre-line border-t border-slate-900/60 pt-2.5">
                          {isRtl ? ddiResult.aiAnalysisAr : ddiResult.aiAnalysisEn}
                        </div>
                      </div>
                    )}

                    {/* Safety Clear */}
                    {ddiResult.interactions.length === 0 && ddiResult.allergyAlerts.length === 0 && (
                      <div className="flex items-center gap-2 text-emerald-600 py-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-xs font-bold">
                          {t("noInteractionsFound")}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* DDI Override */}
          {ddiResult && ddiResult.overallRiskLevel === "high" && (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-border/40 space-y-4">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="ddi-override"
                  checked={hasDdiOverride}
                  onChange={(e) => setHasDdiOverride(e.target.checked)}
                  className="w-5 h-5 rounded-lg text-primary focus:ring-primary border-border/40"
                />
                <label htmlFor="ddi-override" className="text-sm font-bold cursor-pointer">
                  {t("overrideAlerts")}
                </label>
              </div>
              
              {hasDdiOverride && (
                <Textarea 
                  placeholder={t("overrideReasonPlaceholder")}
                  className="min-h-[80px] text-xs rounded-xl"
                  value={ddiOverrideReason}
                  onChange={(e) => setDdiOverrideReason(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-muted-foreground ps-1">
              {t("additionalNotes")}
            </label>
            <Textarea 
              placeholder={t("dispensingNotesPlaceholder")}
              className="min-h-[100px] rounded-2xl border-border/40 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button 
            className="w-full h-14 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl transition-all duration-300"
            variant={ddiResult?.overallRiskLevel === "high" && !hasDdiOverride ? "secondary" : "accent"}
            onClick={handleSubmit}
            disabled={isPending || isCheckingDdi || (ddiResult?.overallRiskLevel === "high" && !hasDdiOverride)}
          >
            {isPending || isCheckingDdi ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Save className="me-2 h-5 w-5" />}
            {isCheckingDdi ? t("analyzingInteractions") : t("issuePrescription")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
