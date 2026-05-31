"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWaitingList } from "@/lib/actions/appointments";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface WaitingListEntry {
  id: string;
  patientId: string;
  patientNameAr?: string;
  patientNameEn?: string;
  departmentId: string;
  preferredDoctorId?: string | null;
  notes?: string | null;
}

interface WaitingListSidebarProps {
  locale: string;
}

export function WaitingListSidebar({ locale }: WaitingListSidebarProps) {
  const t = useTranslations("appointments");
  const isRtl = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);

  const loadWaitingList = useCallback(async () => {
    const res = await getWaitingList();
    if (res.success && "data" in res) {
      setWaitingList(res.data as WaitingListEntry[]);
    }
  }, []);

  useEffect(() => {
    loadWaitingList();
  }, [loadWaitingList]);

  const handleScheduleClick = (entry: WaitingListEntry) => {
    const params = new URLSearchParams(searchParams);
    params.set("scheduleWaitingId", entry.id);
    params.set("scheduleDoctorId", entry.preferredDoctorId || "");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <aside className="w-80 border border-border/40 rounded-2xl bg-card p-4 flex flex-col gap-4 shadow-sm shrink-0 self-stretch text-start max-h-[800px] overflow-y-auto">
      <header className="border-b border-border/30 pb-3 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            {t("waitingList")}
          </h3>
        </div>
        <Badge className="bg-amber-500 text-white border-none font-bold text-[10px] h-5 px-1.5">
          {waitingList.length}
        </Badge>
      </header>

      <div className="flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-thin">
        {waitingList.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground/70 italic">
            {isRtl ? "طابور الانتظار فارغ حالياً." : "Waiting queue is clear."}
          </div>
        ) : (
          waitingList.map((entry) => (
            <Card key={entry.id} className="border-border/30 bg-muted/20 shadow-2xs">
              <CardContent className="p-3 space-y-2 flex flex-col items-start">
                <div className="flex justify-between items-start gap-2 w-full">
                  <span className="font-black text-xs text-foreground">
                    {isRtl ? entry.patientNameAr : entry.patientNameEn}
                  </span>
                </div>
                <Button
                  size="xs"
                  className="w-full text-[10px] font-black mt-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => handleScheduleClick(entry)}
                >
                  <CalendarIcon className="h-3 w-3 me-1" />
                  {isRtl ? "جدولة الموعد وتسكينه" : "Schedule Patient"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </aside>
  );
}
