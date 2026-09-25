import { Loader2, CheckCircle2 } from "lucide-react";
import { PipelineStage } from "@/types/dashboard";

interface Props {
  stage: PipelineStage;
}

const STAGES = [
  { id: 'uploading', label: 'Ingesting Drone Data' },
  { id: 'preprocessing', label: 'Extracting Keyframes & Masking' },
  { id: 'reconstructing', label: '3D Point Cloud Reconstruction' },
  { id: 'georeferencing', label: 'Geo-spatial Alignment' },
  { id: 'exporting', label: 'Generating Textures & Tiles' }
];

export function ProcessingStatusModal({ stage }: Props) {
  if (stage === 'idle' || stage === 'complete') return null;

  const currentIndex = STAGES.findIndex(s => s.id === stage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-panel rounded-xl p-8 w-[400px] shadow-2xl">
        <h3 className="text-lg text-slate-100 font-semibold mb-6 uppercase tracking-wider text-center">Pipeline Active</h3>
        
        <div className="flex flex-col gap-4">
          {STAGES.map((s, idx) => {
            const isCompleted = idx < currentIndex;
            const isActive = idx === currentIndex;
            
            return (
              <div key={s.id} className={`flex items-center gap-3 ${isActive ? 'text-cyan-400' : isCompleted ? 'text-slate-500' : 'text-slate-700'}`}>
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="w-5 h-5 border-2 border-slate-700 rounded-full" />
                )}
                <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
