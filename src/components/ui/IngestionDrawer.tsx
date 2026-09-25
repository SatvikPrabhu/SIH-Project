import { Upload, FileVideo, FileJson, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
}

export function IngestionDrawer({ isOpen, onClose, onStart }: Props) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-14 right-0 bottom-0 w-96 glass-panel z-40 border-l shadow-2xl flex flex-col transform transition-transform duration-300">
      <div className="p-4 border-b border-slate-800/80 flex justify-between items-center">
        <h2 className="text-sm uppercase tracking-widest text-slate-200">Data Ingestion</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      
      <div className="p-6 flex flex-col gap-6 flex-1">
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">1. Drone Video (Required)</label>
          <div className="border border-dashed border-slate-700 rounded-lg p-8 flex flex-col items-center justify-center text-slate-500 hover:border-cyan-500/50 hover:bg-slate-800/30 transition-colors cursor-pointer">
            <FileVideo className="w-8 h-8 mb-2" />
            <span className="text-sm">Drop .mp4 or .mov</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">2. Telemetry (Optional)</label>
          <div className="border border-dashed border-slate-700 rounded-lg p-8 flex flex-col items-center justify-center text-slate-500 hover:border-cyan-500/50 hover:bg-slate-800/30 transition-colors cursor-pointer">
            <FileJson className="w-8 h-8 mb-2" />
            <span className="text-sm">Drop .srt or .json</span>
            <span className="text-xs mt-2 text-slate-600 text-center">Optional - Synthetic GPS will generate if omitted</span>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <button 
          onClick={onStart}
          className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Start 3D Reconstruction
        </button>
      </div>
    </div>
  );
}
