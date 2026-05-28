"use client";

import React, { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Structured ICD-10 object interface
interface Icd10Code {
  code: string;
  nameEn: string;
  nameAr: string;
  category: string;
}

// Module-level caching to prevent expensive re-parsing and index re-building on component re-mounts
let cachedIcdData: Icd10Code[] | null = null;
let cachedFuse: Fuse<Icd10Code> | null = null;
let icdLoadingPromise: Promise<{ data: Icd10Code[], fuse: Fuse<Icd10Code> }> | null = null;

interface Icd10SearchPickerProps {
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  locale?: string;
}

// Representative list of the top 8 most common clinical codes in Egyptian outpatient clinics
const COMMON_EGYPT_CODES = [
  { code: "I10", labelAr: "ضغط الدم الأساسي", labelEn: "Essential Hypertension" },
  { code: "E11.9", labelAr: "السكري النوع الثاني", labelEn: "Type 2 Diabetes" },
  { code: "M54.5", labelAr: "آلام أسفل الظهر", labelEn: "Low Back Pain" },
  { code: "N39.0", labelAr: "التهاب المسالك البولية", labelEn: "Urinary Tract Infection" },
  { code: "K29.7", labelAr: "التهاب المعدة", labelEn: "Gastritis" },
  { code: "J45.909", labelAr: "حالة ربو عادية", labelEn: "Bronchial Asthma" },
  { code: "J06.9", labelAr: "عدوى جهاز تنفسي علوي", labelEn: "Acute URI" },
  { code: "E66.9", labelAr: "السمنة العامة", labelEn: "General Obesity" }
];

export function Icd10SearchPicker({ selectedCodes, onChange, locale = "ar" }: Icd10SearchPickerProps) {
  const isRtl = locale === "ar";
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<Icd10Code[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [icdData, setIcdData] = useState<Icd10Code[]>(cachedIcdData || []);
  const [fuse, setFuse] = useState<Fuse<Icd10Code> | null>(cachedFuse);

  // Initialize Fuse.js once by dynamically importing the dataset
  useEffect(() => {
    const loadData = async () => {
      // If already cached in module memory, skip expensive import and index building
      if (cachedIcdData && cachedFuse) {
        return;
      }

      if (!icdLoadingPromise) {
        icdLoadingPromise = (async () => {
          try {
            const data = (await import("@db/clinical-data/icd10-ar.json")).default as Icd10Code[];
            const fuseInstance = new Fuse(data, {
              keys: [
                { name: "code", weight: 0.6 },
                { name: "nameEn", weight: 0.2 },
                { name: "nameAr", weight: 0.2 }
              ],
              threshold: 0.35,
              ignoreLocation: true
            });
            cachedIcdData = data;
            cachedFuse = fuseInstance;
            return { data, fuse: fuseInstance };
          } catch (error) {
            console.error("Failed to load ICD-10 data:", error);
            throw error;
          }
        })();
      }

      try {
        const { data, fuse: fuseInstance } = await icdLoadingPromise;
        setIcdData(data);
        setFuse(fuseInstance);
      } catch {
        // Error handled in promise
      }
    };
    
    loadData();
  }, []);

  // Debounce the input query changes by 200ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  useEffect(() => {
    if (!fuse || !debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const searchResults = fuse.search(debouncedQuery).slice(0, 15).map(r => r.item);
    
    setResults(searchResults);
  }, [debouncedQuery, fuse]);

  // Toggle code selection
  const handleToggleCode = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter((c) => c !== code));
    } else {
      onChange([...selectedCodes, code]);
    }
  };

  // Find rich data of selected codes for rendering badges
  const selectedCodeDetails = useMemo(() => {
    return selectedCodes.map((code) => {
      const match = icdData.find((item) => item.code === code);
      return match || { code, nameEn: code, nameAr: code, category: "Unspecified" };
    });
  }, [selectedCodes, icdData]);

  return (
    <div className="space-y-3 text-start">
      <label className="block text-xs font-black uppercase text-foreground/80 tracking-wider">
        {isRtl ? "رموز التشخيص الطبية (ICD-10)" : "ICD-10 Diagnostic Codes"}
      </label>

      {/* Render Selected Codes as Removable Badges */}
      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-border/30 bg-muted/25 min-h-10">
          {selectedCodeDetails.map((item) => (
            <Badge
              key={item.code}
              variant="outline"
              className="flex items-center gap-1.5 py-1 px-2.5 text-xs font-bold rounded-lg border-primary/20 bg-primary/5 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 cursor-pointer group transition-all duration-200"
              onClick={() => handleToggleCode(item.code)}
            >
              <span className="font-mono tracking-wider font-extrabold text-[10px] bg-primary/10 px-1 py-0.5 rounded text-primary">
                {item.code}
              </span>
              <span className="truncate max-w-[200px]">
                {isRtl ? item.nameAr : item.nameEn}
              </span>
              <X className="w-3 h-3 group-hover:text-destructive shrink-0 transition-colors" />
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input wrapper */}
      <div className="relative">
        <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground transition-colors duration-200 start-3.5">
          <Search className="w-4 h-4" />
        </div>
        <Input
          type="text"
          placeholder={isRtl ? "ابحث برمز التشخيص أو الاسم بالعربية أو الإنجليزية..." : "Search by code, English, or Arabic diagnosis..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full h-11 bg-background/50 border-border/50 text-xs font-semibold focus:ring-primary/20 transition-all duration-300 rounded-xl ps-10 pe-4 text-start"
        />

        {/* Floating Local Fuzzy Search Results Dropdown */}
        {isFocused && query.trim() !== "" && (
          <div
            onMouseDown={(e) => e.preventDefault()} // Prevents focus loss on the input when clicking results
            className="absolute z-50 start-0 end-0 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border/40 bg-background/95 backdrop-blur-md shadow-lg scrollbar-none animate-in fade-in duration-100"
          >
            {results.length === 0 ? (              <div className="p-4 text-center text-xs font-semibold text-muted-foreground">
                {isRtl ? "لا توجد نتائج مطابقة" : "No matching diagnosis found"}
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {results.map((item) => {
                  const isSelected = selectedCodes.includes(item.code);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => handleToggleCode(item.code)}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-start transition-colors duration-150 font-semibold",
                        isSelected
                          ? "bg-primary/5 text-primary"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[10px] font-extrabold text-accent shrink-0 bg-accent/5 px-2 py-0.5 rounded border border-accent/10">
                          {item.code}
                        </span>
                        <div className="truncate flex flex-col gap-0.5">
                          <span className="font-bold text-foreground truncate">
                            {isRtl ? item.nameAr : item.nameEn}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {isRtl ? item.nameEn : item.nameAr}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ms-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Egyptian Clinics Common Codes Quick-select section */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          {isRtl ? "التشخيصات الأكثر شيوعاً في مصر" : "Most Common Egyptian Clinical Diagnoses"}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_EGYPT_CODES.map((item) => {
            const isSelected = selectedCodes.includes(item.code);
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleToggleCode(item.code)}
                className={cn(
                  "text-[10px] font-black h-7 rounded-lg border px-2.5 transition-all duration-200 cursor-pointer flex items-center gap-1",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-muted/10 border-border/30 text-foreground/80 hover:bg-muted/40 hover:border-border"
                )}
              >
                <span className="font-mono tracking-wider opacity-90">{item.code}</span>
                <span>•</span>
                <span>{isRtl ? item.labelAr : item.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
