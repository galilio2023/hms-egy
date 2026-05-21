"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import NextTopLoader from "nextjs-toploader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <NextTopLoader color="#0ea5e9" showSpinner={false} />
      
      {/* Sidebar Navigation */}
      <Sidebar isMobileOpen={isMobileSidebarOpen} setIsMobileOpen={setIsMobileSidebarOpen} />

      {/* Main Panel */}
      <div className="flex flex-col flex-1 h-full overflow-hidden relative">
        {/* Top Navigation Header Bar */}
        <TopBar 
          onSearchClick={() => setIsCommandPaletteOpen(true)} 
          onMobileMenuClick={() => setIsMobileSidebarOpen(true)}
        />

        {/* Scrollable Viewport Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>

      {/* Global Command Palette search bar overlay */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        setIsOpen={setIsCommandPaletteOpen} 
      />
    </div>
  );
}
