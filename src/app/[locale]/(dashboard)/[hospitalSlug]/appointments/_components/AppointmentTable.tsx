"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, Eye } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Appointment {
  id: string;
  patientId: string;
  patientNameAr?: string;
  patientNameEn?: string;
  patientNumber?: string;
  patientPhone?: string;
  doctorId: string;
  doctorNameAr?: string;
  doctorNameEn?: string;
  departmentId: string;
  departmentNameAr?: string;
  departmentNameEn?: string;
  scheduledDate: string | Date;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
}

interface AppointmentTableProps {
  data: Appointment[];
  locale: string;
}

export function AppointmentTable({ data, locale }: AppointmentTableProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleRowClick = (app: Appointment) => {
    const params = new URLSearchParams(searchParams);
    params.set("selectedAppId", app.id);
    router.push(`${pathname}?${params.toString()}`);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-none font-bold py-0.5">{isRtl ? "مؤكد" : "Scheduled"}</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-none font-bold py-0.5">{isRtl ? "مكتمل" : "Completed"}</Badge>;
      case "cancelled":
        return <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-none font-bold py-0.5">{isRtl ? "ملغي" : "Cancelled"}</Badge>;
      case "no_show":
        return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-none font-bold py-0.5">{isRtl ? "غائب" : "No Show"}</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-600 border border-gray-500/20 shadow-none font-bold py-0.5">{status}</Badge>;
    }
  };

  const renderTypeBadge = (type: string) => {
    switch (type) {
      case "checkup":
      case "consultation":
        return <Badge variant="outline" className="text-violet-600 border-violet-500/20 bg-violet-500/5 text-xs font-semibold">{t("checkup")}</Badge>;
      case "follow_up":
        return <Badge variant="outline" className="text-indigo-600 border-indigo-500/20 bg-indigo-500/5 text-xs font-semibold">{t("follow_up")}</Badge>;
      case "procedure":
        return <Badge variant="outline" className="text-rose-600 border-rose-500/20 bg-rose-500/5 text-xs font-semibold">{t("procedure")}</Badge>;
      case "telemedicine":
        return <Badge variant="outline" className="text-teal-600 border-teal-500/20 bg-teal-500/5 text-xs font-semibold">{t("telemedicine")}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs font-semibold">{type}</Badge>;
    }
  };

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "scheduledDate",
      header: isRtl ? "التاريخ والوقت" : "Date & Time",
      cell: ({ row }) => {
        const date = new Date(row.original.scheduledDate);
        const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        const start = row.original.startTime.substring(0, 5);
        const end = row.original.endTime.substring(0, 5);
        return (
          <div className="flex flex-col gap-1 text-start">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
              {dateStr}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/80 font-bold flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {start} - {end}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: "patientName",
      header: t("patient"),
      cell: ({ row }) => {
        const name = isRtl ? row.original.patientNameAr : row.original.patientNameEn;
        return (
          <div className="flex flex-col text-start">
            <span className="font-black text-foreground text-sm">{name}</span>
            <span className="text-[10px] text-muted-foreground font-mono font-bold mt-0.5">
              #{row.original.patientNumber}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: "doctorName",
      header: t("doctor"),
      cell: ({ row }) => {
        const name = isRtl ? row.original.doctorNameAr : row.original.doctorNameEn;
        const dept = isRtl ? row.original.departmentNameAr : row.original.departmentNameEn;
        return (
          <div className="flex flex-col text-start gap-0.5">
            <span className="font-bold text-foreground/90 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {name}
            </span>
            <span className="text-[10px] text-accent/90 font-black">{dept}</span>
          </div>
        );
      }
    },
    {
      accessorKey: "type",
      header: t("type"),
      cell: ({ row }) => renderTypeBadge(row.original.type)
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => renderStatusBadge(row.original.status)
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button 
          variant="ghost" 
          size="xs" 
          className="text-muted-foreground hover:text-foreground font-bold text-[10px]"
          onClick={() => handleRowClick(row.original)}
        >
          <Eye className="h-3 w-3 me-1" />
          {isRtl ? "عرض وإدارة" : "View & Edit"}
        </Button>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="patientName"
      searchPlaceholder={t("searchPlaceholder")}
      onRowClick={handleRowClick}
    />
  );
}
