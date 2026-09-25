"use client";

import { motion } from "framer-motion";
import { Activity, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TopNavbarProps = {
  telemetryVisible: boolean;
  onToggleTelemetry: () => void;
  onNewDronePass: () => void;
};

export function TopNavbar({
  telemetryVisible,
  onToggleTelemetry,
  onNewDronePass,
}: TopNavbarProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute top-4 left-4 right-4 z-50 flex items-start justify-between"
    >
      <div className="pointer-events-auto glass-panel flex items-center gap-4 rounded-2xl px-4 py-2.5 shadow-2xl">
        <div>
          <p className="font-mono text-[13px] font-semibold tracking-[0.22em] text-white">
            AERO3D
            <span className="ml-2 text-slate-500">//</span>
            <span className="ml-2 text-slate-300">NTRO-26158</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] tracking-[0.18em] text-emerald-400 uppercase">
              System Ready
            </span>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          type="button"
          variant="glass"
          size="pill"
          onClick={onToggleTelemetry}
          aria-pressed={telemetryVisible}
          className={cn(
            "font-mono text-[11px] tracking-widest uppercase",
            telemetryVisible && "border-blue-500/40 text-blue-300",
          )}
        >
          <Activity />
          HUD
        </Button>
        <Button
          type="button"
          size="pill"
          onClick={onNewDronePass}
          className="font-mono text-[11px] tracking-widest uppercase shadow-lg shadow-blue-500/20"
        >
          <Plus />
          New Drone Pass
        </Button>
      </div>
    </motion.header>
  );
}
