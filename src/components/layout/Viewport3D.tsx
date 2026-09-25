"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

export default function Viewport3D() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 z-0 bg-slate-950 flex flex-col items-center justify-center">
      {/* Placeholder for actual CesiumJS Viewer */}
      <Globe className="w-16 h-16 text-slate-800 mb-4 animate-pulse" />
      <div className="text-slate-600 tracking-widest uppercase text-sm">
        Cesium3D Engine Ready - Awaiting Model Stream
      </div>
      
      {/* Grid overlay for aesthetic */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
    </div>
  );
}
