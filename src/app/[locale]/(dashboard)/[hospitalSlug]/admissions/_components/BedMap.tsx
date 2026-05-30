import React from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedIcon } from "lucide-react";
import { BedCard } from "./BedCard";

interface BedData {
  bedId: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved" | "quarantine" | "pending_cleaning";
  patientNameAr: string | null;
  patientNameEn: string | null;
  patientNumber: string | null;
}

interface RoomData {
  id: string;
  roomNumber: string;
  type: string;
  floor: string;
  wing: string | null;
  beds: BedData[];
}

interface BedMapProps {
  roomsWithBeds: RoomData[];
  locale: string;
}

export async function BedMap({ roomsWithBeds, locale }: BedMapProps) {
  const t = await getTranslations({ locale, namespace: "admissions" });
  const isRtl = locale === "ar";

  if (roomsWithBeds.length === 0) {
    return (
      <Card className="rounded-2xl border border-border/60 p-12 bg-card text-center">
        <CardContent className="flex flex-col items-center justify-center space-y-4 p-0">
          <div className="p-4 rounded-full bg-muted text-muted-foreground">
            <BedIcon className="h-12 w-12" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {isRtl ? "لم يتم تعريف أية غرف أو أسرة بعد في هذه المنشأة" : "No Rooms or Beds Registered Yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {isRtl 
              ? "يرجى التوجه لإعدادات المستشفى أو الدعم لإضافة غرف وأسرة للقسم الداخلي." 
              : "Please configure your hospital wards and add clinical rooms under the system configuration guide."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {roomsWithBeds.map((room) => (
        <Card key={room.id} className="rounded-2xl border border-border/60 shadow-sm bg-card overflow-hidden text-start">
          <CardHeader className="bg-muted/30 border-b border-border/60 py-4 px-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-foreground text-lg">
                  {isRtl ? `غرفة ${room.roomNumber}` : `Room ${room.roomNumber}`}
                </span>
                <Badge variant="outline" className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground border-border capitalize">
                  {room.type}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{isRtl ? `الطابق: ${room.floor}` : `Floor: ${room.floor}`}</span>
                {room.wing && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{isRtl ? `الجناح: ${room.wing}` : `Wing: ${room.wing}`}</span>
                  </>
                )}
              </div>
            </div>
            <Badge className="rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs border-none font-bold">
              {isRtl ? `${room.beds.length} أسرة` : `${room.beds.length} Beds`}
            </Badge>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {room.beds.map((bed) => (
                <BedCard 
                  key={bed.bedId} 
                  bed={bed} 
                  locale={locale} 
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
