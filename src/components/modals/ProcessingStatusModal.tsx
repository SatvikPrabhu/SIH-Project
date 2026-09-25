"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Progress } from "@/components/ui/progress";
import { PROCESSING_STAGES } from "@/types/dashboard";

export type ProcessingStatusModalProps = {
  open: boolean;
  progress: number;
};

export function ProcessingStatusModal({ open, progress }: ProcessingStatusModalProps) {
  const stageIndex = Math.min(
    PROCESSING_STAGES.length - 1,
    Math.floor((progress / 100) * PROCESSING_STAGES.length),
  );
  const stage = PROCESSING_STAGES[stageIndex];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[80] flex items-center justify-center bg-black/45"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            className="glass-panel w-[min(92vw,420px)] rounded-3xl px-6 py-6 shadow-2xl"
          >
            <p className="hud-label">Reconstruction</p>
            <h2 className="mt-1 font-mono text-sm tracking-[0.14em] text-white uppercase">
              Rendering scene
            </h2>
            <p className="mt-3 text-xs text-slate-400">{stage?.label}</p>
            <div className="mt-4">
              <Progress value={progress} />
              <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
                <span>PIPELINE</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
