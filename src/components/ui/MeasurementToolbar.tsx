import { Ruler, Square, ArrowUpToLine, Download } from "lucide-react";

export function MeasurementToolbar() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10 glass-panel rounded-full px-4 py-2 flex items-center gap-6 shadow-2xl">
      <button className="text-slate-400 hover:text-cyan-400 transition-colors group relative">
        <Ruler className="w-5 h-5" />
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Distance (m)</span>
      </button>
      <button className="text-slate-400 hover:text-cyan-400 transition-colors group relative">
        <Square className="w-5 h-5" />
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Area (m²)</span>
      </button>
      <button className="text-slate-400 hover:text-cyan-400 transition-colors group relative">
        <ArrowUpToLine className="w-5 h-5" />
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Height Clearance</span>
      </button>
      <div className="w-px h-5 bg-slate-700"></div>
      <button className="text-slate-400 hover:text-emerald-400 transition-colors group relative flex items-center gap-2">
        <Download className="w-5 h-5" />
        <span className="text-sm font-medium">Export</span>
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">.las / .obj / .tif</span>
      </button>
    </div>
  );
}
