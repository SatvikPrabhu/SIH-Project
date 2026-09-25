"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";

import type { MeasurementTool, VizMode } from "@/types/dashboard";

const MUMBAI = { lon: 72.8347, lat: 18.922 };

export type Viewport3DProps = {
  vizMode: VizMode;
  activeTool: MeasurementTool | null;
  tilesetUrl?: string | null;
};

type CesiumNS = typeof import("cesium");

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
    Cesium?: CesiumNS;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && window.Cesium) {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cesium script failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function bootCesium(): Promise<CesiumNS> {
  const localBase = "/cesium";
  window.CESIUM_BASE_URL = `${localBase}/`;
  loadCss(`${localBase}/Widgets/widgets.css`);

  try {
    await loadScript(`${localBase}/Cesium.js`);
  } catch {
    const cdn = "https://cesium.com/downloads/cesiumjs/releases/1.145/Build/Cesium";
    window.CESIUM_BASE_URL = `${cdn}/`;
    loadCss(`${cdn}/Widgets/widgets.css`);
    await loadScript(`${cdn}/Cesium.js`);
  }

  if (!window.Cesium) {
    throw new Error("Cesium global not available");
  }
  return window.Cesium;
}

export function Viewport3D({ vizMode, activeTool, tilesetUrl }: Viewport3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<InstanceType<CesiumNS["Viewer"]> | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const tilesetRef = useRef<InstanceType<CesiumNS["Cesium3DTileset"]> | null>(null);
  const loadedModelRef = useRef<InstanceType<CesiumNS["Cesium3DTileset"]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let viewer: InstanceType<CesiumNS["Viewer"]> | null = null;

    const start = async () => {
      if (!hostRef.current) return;
      try {
        const Cesium = await bootCesium();
        if (cancelled || !hostRef.current) return;

        const dummyCredits = document.createElement("div");
        dummyCredits.style.display = "none";

        // Viewer options are version-sensitive (Ion vs TMS). Keep this untyped
        // so Phase 2 can swap in Ion tokens / 3D Tiles without fighting the shell.
        const viewerOptions: Record<string, unknown> = {
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          vrButton: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: dummyCredits,
          shouldAnimate: false,
        };

        try {
          const tms = await Cesium.TileMapServiceImageryProvider.fromUrl(
            Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
          );
          viewerOptions.baseLayer = Cesium.ImageryLayer.fromProviderAsync
            ? await Cesium.ImageryLayer.fromProviderAsync(Promise.resolve(tms))
            : new Cesium.ImageryLayer(tms);
        } catch {
          // Proceed with Cesium defaults; Ion will no-op without a token.
        }

        viewer = new Cesium.Viewer(
          hostRef.current,
          viewerOptions as ConstructorParameters<CesiumNS["Viewer"]>[1],
        );

        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0B0F17");
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0B0F17");
        viewer.scene.globe.enableLighting = true;
        viewer.scene.fog.enabled = true;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.hueShift = -0.18;
          viewer.scene.skyAtmosphere.saturationShift = -0.12;
          viewer.scene.skyAtmosphere.brightnessShift = -0.28;
        }

        if (viewer.imageryLayers.length > 0) {
          const layer = viewer.imageryLayers.get(0);
          if (layer) {
            layer.brightness = 0.55;
            layer.saturation = 0.35;
            layer.contrast = 1.15;
          }
        }

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(MUMBAI.lon, MUMBAI.lat, 2800),
          orientation: {
            heading: Cesium.Math.toRadians(20),
            pitch: Cesium.Math.toRadians(-42),
            roll: 0,
          },
        });

        const track = [
          [72.828, 18.918],
          [72.832, 18.921],
          [72.8347, 18.922],
          [72.838, 18.925],
          [72.841, 18.927],
        ];

        viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights(
              track.flatMap(([lon, lat], i) => [lon, lat, 120 + i * 8]),
            ),
            width: 2.5,
            material: Cesium.Color.fromCssColorString("#3B82F6"),
          },
        });

        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(MUMBAI.lon, MUMBAI.lat, 120.4),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString("#10B981"),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
        });

        viewer.scene.requestRender();
        viewerRef.current = viewer;
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void start();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Load 3D tileset when URL is provided
  useEffect(() => {
    if (!tilesetUrl || !viewerRef.current) return;

    const loadTileset = async () => {
      const Cesium = window.Cesium;
      if (!Cesium) return;

      try {
        // Remove existing tileset if any
        if (tilesetRef.current) {
          viewerRef.current?.scene.primitives.remove(tilesetRef.current);
          tilesetRef.current = null;
          loadedModelRef.current = null;
        }

        // Load new tileset
        const tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl);
        tilesetRef.current = tileset;
        loadedModelRef.current = tileset;
        viewerRef.current?.scene.primitives.add(tileset);
        setModelLoaded(true);

        // Wait for tileset to be ready before flying to it
        // @ts-expect-error - readyPromise exists in Cesium but not in TypeScript types
        if (tileset.readyPromise) {
          tileset.readyPromise.then(() => {
            // Fly to the tileset with proper offset
            viewerRef.current?.flyTo(tileset, {
              duration: 2.0,
              offset: new Cesium.HeadingPitchRange(0, -0.785398, 500),
            });
          }).catch((error: Error) => {
            console.error("Tileset ready promise failed:", error);
          });
        } else {
          // Fallback: fly immediately if readyPromise not available
          viewerRef.current?.flyTo(tileset, {
            duration: 2.0,
            offset: new Cesium.HeadingPitchRange(0, -0.785398, 500),
          });
        }
      } catch (error) {
        console.error("Failed to load 3D tileset:", error);
      }
    };

    loadTileset();
  }, [tilesetUrl]);

  // Manual fly to model function
  const handleFocusModel = () => {
    if (loadedModelRef.current && viewerRef.current) {
      const Cesium = window.Cesium;
      if (!Cesium) return;
      viewerRef.current.flyTo(loadedModelRef.current, {
        duration: 1.5,
        offset: new Cesium.HeadingPitchRange(0, -0.785398, 500),
      });
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0B0F17]">
      <div ref={hostRef} className="absolute inset-0 h-full w-full" />

      {!ready && !failed ? (
        <div className="tactical-grid pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="font-mono text-[11px] tracking-[0.28em] text-slate-500 uppercase">
            Initializing globe…
          </p>
        </div>
      ) : null}

      {failed ? <FallbackGlobe /> : null}

      {/* Focus Model Button */}
      {modelLoaded && ready ? (
        <button
          onClick={handleFocusModel}
          className="pointer-events-auto absolute top-4 right-4 flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-900/80 px-4 py-2 font-mono text-[10px] tracking-widest uppercase text-slate-300 backdrop-blur-md transition-all hover:bg-slate-800/80 hover:text-white hover:border-slate-600"
        >
          <Crosshair className="h-3 w-3" />
          Focus Model
        </button>
      ) : null}

      <div className="pointer-events-none absolute bottom-24 left-6 font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">
        {vizMode === "mesh" ? "Viz // 3D Mesh" : "Viz // Point Cloud"}
        {activeTool ? `  ·  Tool // ${activeTool}` : ""}
      </div>
    </div>
  );
}

function FallbackGlobe() {
  return (
    <div className="tactical-grid absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(59,130,246,0.18),transparent_42%),radial-gradient(circle_at_50%_45%,#0f172a_0%,#0B0F17_62%)]" />
      <div className="absolute top-1/2 left-1/2 h-[38vmin] w-[38vmin] -translate-x-1/2 -translate-y-[58%] rounded-full border border-blue-500/20 shadow-[0_0_80px_rgba(59,130,246,0.15)]" />
      <div className="absolute top-[46%] left-1/2 h-px w-[55vmin] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
      <p className="absolute bottom-28 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-slate-500 uppercase">
        Canvas fallback · Cesium loader idle
      </p>
    </div>
  );
}
