"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import type { MediaAsset } from "@/types/dashboard";

export type TelemetrySnapshot = {
  lat: number;
  lon: number;
  altitudeM: number;
  speedMs: number;
  headingDeg: number;
};

export type TelemetryOverlayProps = {
  visible: boolean;
  snapshot?: TelemetrySnapshot;
  video: MediaAsset | null;
};

const DEFAULT_SNAPSHOT: TelemetrySnapshot = {
  lat: 18.922,
  lon: 72.8347,
  altitudeM: 120.4,
  speedMs: 12.5,
  headingDeg: 310,
};

function headingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx] ?? "N";
}

export function TelemetryOverlay({
  visible,
  snapshot = DEFAULT_SNAPSHOT,
  video,
}: TelemetryOverlayProps) {
  const [clock, setClock] = useState("00:00:00");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toISOString().slice(11, 19) + "Z");
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const cells = [
    {
      label: "GPS",
      value: `${snapshot.lat.toFixed(4)}° N`,
      sub: `${snapshot.lon.toFixed(4)}° E`,
    },
    {
      label: "Altitude",
      value: `${snapshot.altitudeM.toFixed(1)} m`,
      sub: "AGL",
    },
    {
      label: "Speed",
      value: `${snapshot.speedMs.toFixed(1)} m/s`,
      sub: "ground",
    },
    {
      label: "Heading",
      value: `${snapshot.headingDeg}°`,
      sub: headingLabel(snapshot.headingDeg),
    },
  ];

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute top-24 right-4 z-40 w-[240px]"
        >
          <div className="glass-panel pointer-events-auto overflow-hidden rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <span className="hud-label">Telemetry HUD</span>
              <span className="font-mono text-[10px] text-emerald-400">{clock}</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-800">
              {cells.map((cell) => (
                <div key={cell.label} className="bg-slate-950/70 px-3 py-3">
                  <p className="hud-label">{cell.label}</p>
                  <p className="mt-1 font-mono text-[13px] text-white">{cell.value}</p>
                  <p className="text-[10px] text-slate-500">{cell.sub}</p>
                </div>
              ))}
            </div>
            <div className="relative h-[92px] bg-black">
              {video?.previewUrl ? (
                <video
                  src={video.previewUrl}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover opacity-80"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,rgba(15,23,42,0.2),rgba(15,23,42,0.9))]">
                  <p className="font-mono text-[9px] tracking-[0.22em] text-slate-500 uppercase">
                    Sync feed · standby
                  </p>
                </div>
              )}
              <span className="absolute top-2 left-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-emerald-400">
                RAW
              </span>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
