"use client";

import React, { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Html5QrcodeScanner, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, Keyboard, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
  title?: string;
}

export function BarcodeScanner({ onScan, onClose, title }: BarcodeScannerProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const [manualInput, setManualInput] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);

  // 1. Initialize HTML5 Camera Scanner
  useEffect(() => {
    if (!isCameraActive) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
        scannerRef.current = null;
      }
      return;
    }

    const scannerContainerId = "hms-barcode-reader-viewport";

    const scanner = new Html5QrcodeScanner(
      scannerContainerId,
      { 
        fps: 15, 
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778, // 16:9 for clean landscape mobile alignment
        showTorchButtonIfSupported: true,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Successful scan
        onScan(decodedText);
        scanner.clear().catch(err => console.error(err));
        if (onClose) onClose();
      },
      (errorMessage) => {
        // Non-critical frame-level error (e.g., barcode not in focus yet)
        // We do not want to flood the UI, so we just log silently
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner on unmount", err));
      }
    };
  }, [isCameraActive, onScan, onClose]);

  // 2. Physical Handheld Scanner Gun Emulation Mode (Keyboard listener)
  // Physical scanners act like standard keyboards but type extremely fast and end with an "Enter" key stroke.
  useEffect(() => {
    let strokeBuffer = "";
    let lastStrokeTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastStrokeTime;
      lastStrokeTime = currentTime;

      // If the stroke took longer than 40ms, it is highly likely human typing, not a scanner gun.
      // We clear the buffer and treat it as fresh.
      if (timeDiff > 40) {
        strokeBuffer = "";
      }

      // Ignore modifiers
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt") return;

      if (e.key === "Enter") {
        if (strokeBuffer.length > 3) {
          e.preventDefault();
          onScan(strokeBuffer);
          strokeBuffer = "";
          if (onClose) onClose();
        }
      } else {
        strokeBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      if (onClose) onClose();
    }
  };

  return (
    <div className="flex flex-col space-y-4 w-full">
      {/* Title Header area */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent animate-pulse" />
          <span className="font-black text-sm">
            {title || (isRtl ? "قارئ الباركود والرموز الطبية" : "Barcode & QR Clinical Scanner")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isCameraActive ? "default" : "outline"}
            size="xs"
            onClick={() => setIsCameraActive(true)}
            className="gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>{isRtl ? "الكاميرا" : "Camera"}</span>
          </Button>
          <Button
            variant={!isCameraActive ? "default" : "outline"}
            size="xs"
            onClick={() => setIsCameraActive(false)}
            className="gap-1.5"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span>{isRtl ? "إدخال يدوي" : "Manual Input"}</span>
          </Button>
        </div>
      </div>

      {/* Main scanning surface */}
      {isCameraActive ? (
        <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-black aspect-video flex flex-col items-center justify-center">
          <div id="hms-barcode-reader-viewport" className="w-full h-full" />
          
          {/* Green Laser line animation wrapper */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center z-10">
            <div className="w-[80%] h-[150px] border-2 border-dashed border-accent/40 rounded-xl relative">
              {/* Laser line itself */}
              <div className="absolute start-0 end-0 h-0.5 bg-accent shadow-[0_0_10px_#14b8a6] animate-pulse top-1/2" />
            </div>
            <span className="text-[10px] text-white/75 font-semibold bg-black/60 px-2.5 py-1 rounded-full mt-4 backdrop-blur-xs">
              {isRtl ? "ضع الرمز الطبي داخل المربع" : "Position barcode inside the viewport"}
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-4 py-4 animate-slide-up">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {isRtl ? "الرقم التسلسلي للملف أو الدواء" : "Serial Reference or Medication Barcode"}
            </label>
            <Input
              autoFocus
              placeholder={isRtl ? "مثال: 6223000... أو رقم الملف الطبي" : "e.g., 6223000... or clinical file number"}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="accent" className="w-full">
            {isRtl ? "تأكيد وإدخال الرمز" : "Confirm Code Entry"}
          </Button>
        </form>
      )}

      {/* Gun Scanner helper notice */}
      <div className="flex items-start gap-2.5 p-3.5 bg-muted/40 border border-border/20 rounded-xl text-[11px] leading-relaxed text-muted-foreground">
        <AlertCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <p>
          {isRtl 
            ? "يدعم هذا النظام القراءة التلقائية عبر مسدسات مسح الباركود السريعة (USB Scanner) من أي شاشة - ما عليك سوى التوصيل والمسح مباشرة."
            : "This module fully supports rapid USB laser scanning guns out-of-the-box. Simply plug in the scanner and trigger it from any view."
          }
        </p>
      </div>
    </div>
  );
}
