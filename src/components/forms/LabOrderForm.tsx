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
  FlaskConical, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Loader2,
  Save,
  Beaker,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { searchLabTests, createLabOrder } from "@/lib/actions/laboratory";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LabTest {
  id: string;
  nameAr: string;
  nameEn: string;
  loincCode: string | null;
  unit: string | null;
  normalRange: string | null;
}

interface LabOrderFormProps {
  patientId: string;
  onSuccess?: (orderId: string) => void;
}

export function LabOrderForm({ patientId, onSuccess }: LabOrderFormProps) {
  const t = useTranslations("laboratory");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const hospitalSlug = params.hospitalSlug as string;
  
  const isRtl = locale === "ar";
  const [isPending, startTransition] = useTransition();

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LabTest[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Order States
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [priority, setPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");

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
        const res = await searchLabTests(searchQuery);
        if (active && res.success && res.data) {
          setSearchResults(res.data as LabTest[]);
        }
      } catch (err) {
        console.error("Lab search error:", err);
      }
      setIsSearching(false);
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const addTest = (test: LabTest) => {
    if (selectedTests.some(t => t.id === test.id)) {
      toast.error(isRtl ? "هذا الفحص مضاف بالفعل" : "Test already added");
      return;
    }
    setSelectedTests([...selectedTests, test]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeTest = (id: string) => {
    setSelectedTests(selectedTests.filter(t => t.id !== id));
  };

  const handleSubmit = () => {
    if (selectedTests.length === 0) {
      toast.error(isRtl ? "يرجى اختيار فحص واحد على الأقل" : "Please select at least one test");
      return;
    }

    startTransition(async () => {
      const res = await createLabOrder({
        patientId,
        testIds: selectedTests.map(t => t.id),
        priority,
        clinicalNotes
      });

      if (res.success) {
        toast.success(isRtl ? "تم إرسال طلب المختبر بنجاح" : "Lab order created successfully");
        if (onSuccess && "orderId" in res) onSuccess(res.orderId as string);
        router.push(`/${locale}/${hospitalSlug}/patients/${patientId}`);
      } else {
        const errorMessage = "error" in res ? res.error : "Failed to create lab order";
        toast.error(errorMessage);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="bg-indigo-500/5 border-b border-border/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black">
            <FlaskConical className="h-6 w-6 text-indigo-600" />
            {t("orderLabs") || (isRtl ? "طلب فحوصات مخبرية" : "Order Laboratory Tests")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          
          {/* Test Search */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchTestPlaceholder") || (isRtl ? "البحث عن فحص (اسم أو كود LOINC)..." : "Search tests by name or LOINC...")}
                className="ps-10 h-12 rounded-xl shadow-xs border-indigo-100 focus-visible:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div className="absolute end-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <Card className="absolute z-50 w-full mt-2 rounded-xl shadow-xl border-border/40 max-h-64 overflow-y-auto bg-white dark:bg-slate-900">
                <CardContent className="p-2">
                  {searchResults.map((test) => (
                    <button
                      key={test.id}
                      className="w-full text-start p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex items-center justify-between group"
                      onClick={() => addTest(test)}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{isRtl ? test.nameAr : test.nameEn}</span>
                        {test.loincCode && (
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tight">
                            {t("loinc")}: {test.loincCode}
                          </span>
                        )}
                      </div>
                      <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Selected Tests List */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ps-1">
              {t("selectedTests") || (isRtl ? "الفحوصات المختارة" : "Selected Tests")}
            </label>
            {selectedTests.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                <Beaker className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-medium">
                  {isRtl ? "لم يتم اختيار فحوصات بعد" : "No tests selected yet"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTests.map((test) => (
                  <div key={test.id} className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/20 flex items-center justify-between group">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{isRtl ? test.nameAr : test.nameEn}</p>
                      <p className="text-[10px] font-mono text-slate-500 uppercase">{test.loincCode || "No LOINC"}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg shrink-0"
                      onClick={() => removeTest(test.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ps-1">
                {t("priority")}
              </label>
              <Select value={priority} onValueChange={(val) => setPriority(val as "routine" | "urgent" | "stat")}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="Select Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">{t("routine")}</SelectItem>
                  <SelectItem value="urgent">{t("urgent")}</SelectItem>
                  <SelectItem value="stat">{t("stat")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ps-1">
                {t("clinicalNotes") || (isRtl ? "ملاحظات إكلينيكية" : "Clinical Notes")}
              </label>
              <Textarea 
                placeholder={isRtl ? "اذكر أي ملاحظات إكلينيكية مهمة للمختبر..." : "Any relevant clinical notes for the lab..."}
                className="min-h-[44px] rounded-xl border-slate-200 dark:border-slate-800 text-sm py-2"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
              />
            </div>
          </div>

          <Button 
            className="w-full h-14 rounded-2xl font-black text-lg shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Save className="me-2 h-5 w-5" />}
            {isRtl ? "تأكيد طلب المختبر" : "Confirm Lab Order"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
