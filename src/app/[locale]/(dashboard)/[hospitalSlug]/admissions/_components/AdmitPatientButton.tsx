"use client";

import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface AdmitPatientButtonProps {
  label: string;
}

export function AdmitPatientButton({ label }: AdmitPatientButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleAdmitClick = () => {
    const params = new URLSearchParams(searchParams);
    params.set("admitBedId", "manual"); // 'manual' flag to show select dropdown
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Button
      onClick={handleAdmitClick}
      className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-md shadow-blue-500/10 gap-2"
    >
      <Plus className="h-4 w-4" />
      {label}
    </Button>
  );
}
