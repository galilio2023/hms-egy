"use client";

import React, { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { searchPatientsAction } from "@/lib/actions/patients";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { GOVERNORATES } from "@/lib/utils/egypt";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  Eye, 
  FileCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientDirectoryClientProps {
  initialPatients: any[];
  hospitalSlug: string;
}

export function PatientDirectoryClient({ initialPatients, hospitalSlug }: PatientDirectoryClientProps) {
  const t = useTranslations("patients");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();

  const [patients, setPatients] = useState<any[]>(initialPatients);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Additional Filter states
  const [selectedGov, setSelectedGov] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [onlyUhis, setOnlyUhis] = useState(false);

  // Search execution via Server Action
  const handleSearch = (queryValue: string) => {
    setSearchQuery(queryValue);
    startTransition(async () => {
      const res = await searchPatientsAction(queryValue);
      if (res.success && "data" in res) {
        setPatients(res.data || []);
      }
    });
  };

  // Helper: calculate age
  const getAge = (dobString: string | Date) => {
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

  // Local Filter logic matching the directory filters
  const filteredPatients = patients.filter((p) => {
    if (selectedGov && p.governorate !== selectedGov) return false;
    if (selectedGender && p.gender !== selectedGender) return false;
    if (onlyUhis && !p.isUhisActive) return false;
    return true;
  });

  // Table columns definition
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "patientNumber",
      header: t("patientNumber"),
      cell: ({ row }) => (
        <span className="font-mono font-bold text-accent tracking-wider text-xs">
          {row.original.patientNumber}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: isRtl ? "اسم المريض" : "Patient Name",
      cell: ({ row }) => {
        const primaryName = isRtl ? row.original.nameAr : row.original.nameEn;
        const secondaryName = isRtl ? row.original.nameEn : row.original.nameAr;
        return (
          <div className="flex flex-col gap-0.5 text-start">
            <span className="font-black text-foreground text-sm">{primaryName}</span>
            <span className="text-[10px] text-muted-foreground/75 font-semibold tracking-wide">{secondaryName}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "identity",
      header: isRtl ? "الهوية / الرقم القومي" : "Identity / NID",
      cell: ({ row }) => {
        const nid = row.original.nationalId;
        const passport = row.original.passportNumber;
        return (
          <div className="flex flex-col gap-1 text-start">
            {nid ? (
              <span className="font-mono text-[11px] font-bold text-muted-foreground tracking-widest">{nid}</span>
            ) : passport ? (
              <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-5 w-fit">
                ✈ {passport}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground/50">—</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "contactPhone",
      header: t("phone"),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5 text-start font-mono text-[11px] font-semibold text-foreground/80">
          <span>{row.original.contactPhone}</span>
          {row.original.email && (
            <span className="text-[9px] text-muted-foreground/70 lowercase font-sans">{row.original.email}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "ageGender",
      header: isRtl ? "العمر والجنس" : "Age / Gender",
      cell: ({ row }) => {
        const age = getAge(row.original.dob);
        const gender = row.original.gender;
        return (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-foreground">{age} {isRtl ? "عام" : "y/o"}</span>
            <span className={cn(
              "w-2 h-2 rounded-full",
              gender === "male" ? "bg-blue-500" : "bg-pink-500"
            )} />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">
              {gender === "male" ? t("male") : t("female")}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "insurance",
      header: t("insuranceProvider"),
      cell: ({ row }) => {
        const isUhis = row.original.isUhisActive;
        
        if (isUhis) {
          return (
            <Badge variant="success" className="text-[10px] font-extrabold flex items-center gap-1 py-0.5 w-fit">
              <FileCheck className="w-3 h-3" />
              <span>{isRtl ? "تأمين شامل" : "UHIS"}</span>
            </Badge>
          );
        }

        return (
          <Badge variant="secondary" className="text-[10px] font-bold py-0.5 w-fit bg-gray-100 border border-gray-200 text-gray-700">
            {isRtl ? "نقدي / كاش" : "Cash / Self-Pay"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: isRtl ? "عرض الملف" : "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${hospitalSlug}/patients/${row.original.id}`)}
          className="gap-1.5 h-8 text-xs font-bold"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{isRtl ? "ملف المريض" : "View"}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header controls with search and filters */}
      <Card className="border border-border/30 shadow-md bg-background">
        <CardContent className="p-5 space-y-4">
          
          {/* Main search bar + new patient button */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute top-[13px] start-4 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="ps-11 h-11 text-start"
              />
              {isPending && (
                <div className="absolute top-[14px] end-4">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <Button
              variant="accent"
              onClick={() => router.push(`/${hospitalSlug}/patients/new`)}
              className="gap-2 h-11 px-5 shadow-lg shadow-accent/15 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              <span>{t("addPatient")}</span>
            </Button>
          </div>

          {/* Luxury filters grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/20">
            {/* Governorate filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{t("governorate")}</label>
              <select
                dir={isRtl ? "rtl" : "ltr"}
                value={selectedGov}
                onChange={(e) => setSelectedGov(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{isRtl ? "جميع المحافظات" : "All Governorates"}</option>
                {Object.values(GOVERNORATES).map((gov) => (
                  <option key={gov.code} value={gov.code}>
                    {isRtl ? gov.ar : gov.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{t("gender")}</label>
              <select
                dir={isRtl ? "rtl" : "ltr"}
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{isRtl ? "كل الأجناس" : "All Genders"}</option>
                <option value="male">{t("male")}</option>
                <option value="female">{t("female")}</option>
              </select>
            </div>

            {/* UHIS status toggle */}
            <div className="flex items-center justify-start sm:justify-end gap-3 h-full pt-4">
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl hover:bg-muted/30 border border-transparent hover:border-border/30 transition duration-150">
                <input
                  type="checkbox"
                  checked={onlyUhis}
                  onChange={(e) => setOnlyUhis(e.target.checked)}
                  className="w-4.5 h-4.5 text-accent rounded border-border focus:ring-accent"
                />
                <span className="text-xs font-bold text-foreground">
                  {isRtl ? "التأمين الشامل فقط" : "UHIS Registrants Only"}
                </span>
              </label>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Patients Data Table Grid */}
      <div className="bg-background rounded-2xl">
        <DataTable
          columns={columns}
          data={filteredPatients}
          onRowClick={(row) => router.push(`/${hospitalSlug}/patients/${row.id}`)}
        />
      </div>
    </div>
  );
}
