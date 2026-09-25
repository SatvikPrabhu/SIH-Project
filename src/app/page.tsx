"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PipelineStage } from "@/types/dashboard";
import { Navbar } from "@/components/layout/Navbar";
import { IngestionDrawer } from "@/components/ui/IngestionDrawer";
import { MeasurementToolbar } from "@/components/ui/MeasurementToolbar";
import { ProcessingStatusModal } from "@/components/modals/ProcessingStatusModal";

const Viewport3D = dynamic(() => import("@/components/layout/Viewport3D"), { ssr: false });

export default function Dashboard() {
  const [isIngestionOpen, setIsIngestionOpen] = useState(false);
  const [stage, setStage] = useState<PipelineStage>('idle');

  const handleStartReconstruction = () => {
    setIsIngestionOpen(false);
    setStage('uploading');
    
    // Mock progression for demonstration
    const stages: PipelineStage[] = ['uploading', 'preprocessing', 'reconstructing', 'georeferencing', 'exporting', 'complete'];
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < stages.length) {
        setStage(stages[idx]);
      } else {
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <Navbar onOpenIngestion={() => setIsIngestionOpen(true)} />
      
      <Viewport3D />
      
      <MeasurementToolbar />
      
      <IngestionDrawer 
        isOpen={isIngestionOpen} 
        onClose={() => setIsIngestionOpen(false)} 
        onStart={handleStartReconstruction}
      />
      
      <ProcessingStatusModal stage={stage} />
    </main>
  );
}
