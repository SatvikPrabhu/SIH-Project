import { Activity, MapPin, Plus } from "lucide-react";

export function Navbar({ onOpenIngestion }: { onOpenIngestion: () => void }) {
  return (
    <nav className="absolute top-0 w-full h-14 z-50 glass-panel flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="font-bold text-xl tracking-wider text-cyan-400">AERO3D</div>
        <div className="text-xs text-slate-400 uppercase tracking-widest mt-1 border-l border-slate-700 pl-3">GIS Recon Engine</div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Online</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/50 px-2 py-1 rounded">
          <MapPin className="w-3 h-3 text-cyan-400" />
          <span>UTM Zone Auto</span>
        </div>
        <button 
          onClick={onOpenIngestion}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Drone Pass
        </button>
      </div>
    </nav>
  );
}
