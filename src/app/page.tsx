"use client";

import { useCallback, useState } from "react";

import { TopNavbar } from "@/components/layout/TopNavbar";
import { Viewport3D } from "@/components/layout/Viewport3D";
import { ProcessingStatusModal } from "@/components/modals/ProcessingStatusModal";
import { IngestionDrawer } from "@/components/ui/IngestionDrawer";
import { MeasurementToolbar } from "@/components/ui/MeasurementToolbar";
import { TelemetryOverlay } from "@/components/ui/TelemetryOverlay";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  GisExportFormat,
  MeasurementTool,
  MediaAsset,
  VizMode,
  GISExportResponse,
} from "@/types/dashboard";

export default function DashboardPage() {
  const [ingestionOpen, setIngestionOpen] = useState(false);
  const [telemetryVisible, setTelemetryVisible] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<MediaAsset | null>(null);
  const [telemetry, setTelemetry] = useState<MediaAsset | null>(null);
  const [activeTool, setActiveTool] = useState<MeasurementTool | null>("distance");
  const [vizMode, setVizMode] = useState<VizMode>("mesh");
  const [exportHint, setExportHint] = useState<string | null>(null);
  const [tilesetUrl, setTilesetUrl] = useState<string | null>(null);
  const [exportUrls, setExportUrls] = useState<Record<string, string> | null>(null);

  const startReconstruction = useCallback(async () => {
    if (!video) return;

    setIngestionOpen(false);
    setProcessing(true);
    setProgress(0);

    try {
      // Step 1: Upload video and optional telemetry (0-20%)
      setProgress(5);
      const form = new FormData();
      form.append("video_file", video.file);
      if (telemetry) {
        form.append("telemetry_file", telemetry.file);
      }

      const uploadResponse = await fetch("http://localhost:8000/api/v1/upload", {
        method: "POST",
        body: form,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const uploadData = await uploadResponse.json();
      const videoId = uploadData.video_id;
      setProgress(20);

      // Step 2: Preprocess video (extract keyframes) (20-40%)
      const preprocessResponse = await fetch("http://localhost:8000/api/v1/preprocess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ video_id: videoId }),
      });

      if (!preprocessResponse.ok) {
        throw new Error("Preprocessing failed");
      }

      setProgress(40);

      // Step 3: Reconstruct 3D point cloud (40-60%)
      const reconstructResponse = await fetch("http://localhost:8000/api/v1/reconstruct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_id: videoId,
          use_dynamic_masking: true,
        }),
      });

      if (!reconstructResponse.ok) {
        throw new Error("Reconstruction failed");
      }

      const reconstructData = await reconstructResponse.json();
      console.log("Reconstruction complete:", reconstructData);
      setProgress(60);

      // Step 4: Georeference point cloud (60-80%)
      const georeferenceResponse = await fetch("http://localhost:8000/api/v1/georeference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_id: videoId,
          ply_filename: `${videoId}_raw_dense_cloud.ply`,
        }),
      });

      if (!georeferenceResponse.ok) {
        throw new Error("Georeferencing failed");
      }

      const georeferenceData = await georeferenceResponse.json();
      console.log("Georeferencing complete:", georeferenceData);
      setProgress(80);

      // Step 5: Export GIS formats (80-100%)
      const exportResponse = await fetch("http://localhost:8000/api/v1/export_gis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_id: videoId,
          export_formats: ["las", "obj", "geotiff", "3dtiles"],
        }),
      });

      if (!exportResponse.ok) {
        throw new Error("GIS export failed");
      }

      const exportData: GISExportResponse = await exportResponse.json();
      console.log("GIS export complete:", exportData);
      setExportUrls(exportData.export_urls);
      
      // Set tileset URL for CesiumJS
      if (exportData.export_urls["3dtiles"]) {
        setTilesetUrl(`http://localhost:8000${exportData.export_urls["3dtiles"]}`);
      }

      setProgress(100);

      // Complete processing after a short delay
      setTimeout(() => {
        setProcessing(false);
        setProgress(0);
      }, 500);
    } catch (error) {
      console.error("Reconstruction error:", error);
      setProcessing(false);
      setProgress(0);
    }
  }, [video, telemetry]);

  const handleExport = useCallback((format: GisExportFormat) => {
    if (!exportUrls || !exportUrls[format]) {
      setExportHint(`No export available for .${format}`);
      window.setTimeout(() => setExportHint(null), 2200);
      return;
    }

    // Download the file
    const downloadUrl = `http://localhost:8000${exportUrls[format]}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `model.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportHint(`Downloaded .${format}`);
    window.setTimeout(() => setExportHint(null), 2200);
  }, [exportUrls]);

  return (
    <TooltipProvider delayDuration={120}>
      <main className="relative h-[100vh] w-[100vw] overflow-hidden bg-[#0B0F17]">
        <Viewport3D vizMode={vizMode} activeTool={activeTool} tilesetUrl={tilesetUrl} />

        <TopNavbar
          telemetryVisible={telemetryVisible}
          onToggleTelemetry={() => setTelemetryVisible((v) => !v)}
          onNewDronePass={() => setIngestionOpen(true)}
        />

        <TelemetryOverlay visible={telemetryVisible} video={video} />

        <MeasurementToolbar
          activeTool={activeTool}
          vizMode={vizMode}
          onToolChange={setActiveTool}
          onVizModeChange={setVizMode}
          onExport={handleExport}
        />

        <IngestionDrawer
          open={ingestionOpen}
          onClose={() => setIngestionOpen(false)}
          video={video}
          telemetry={telemetry}
          onVideoChange={setVideo}
          onTelemetryChange={setTelemetry}
          onStartReconstruction={startReconstruction}
        />

        <ProcessingStatusModal open={processing} progress={progress} />

        {exportHint ? (
          <div className="glass-panel absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 font-mono text-[10px] tracking-[0.18em] text-slate-200 uppercase">
            {exportHint}
          </div>
        ) : null}
      </main>
    </TooltipProvider>
  );
}
