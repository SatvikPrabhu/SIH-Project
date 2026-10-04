import React, { useState, useEffect } from 'react';
import ModelViewer from './ModelViewer';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';
import ProgressBar from './ui/ProgressBar';
import AssemblyVisualizer from './ui/AssemblyVisualizer';
import { 
  ArrowLeft, 
  RotateCcw, 
  Download, 
  Box, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  Sparkles, 
  Maximize2, 
  RefreshCw, 
  AlertTriangle,
  Cpu,
  Video,
  Camera,
  Compass
} from 'lucide-react';
import './ViewerPage.css';

const API_BASE_URL = 'http://localhost:5000';

/**
 * Dedicated Full-Page 3D Spatial Reconstruction Inspection View
 */
export default function ViewerPage({
  onBack,
  modelUrl = '/models/model.glb',
  onReload,
  videoFileName = null,
  jobId = null,
  jobStatus = 'COMPLETED',
  jobProgress = 100,
  jobStage = 'Reconstruction complete',
  jobError = null,
  totalDuration = null
}) {
  const [pointSize, setPointSize] = useState(0.03);

  // Synchronized state for real-time tracking
  const [progress, setProgress] = useState(jobProgress);
  const [stage, setStage] = useState(jobStage || 'Extracting frames & telemetry');
  const [status, setStatus] = useState(jobStatus);
  const [error, setError] = useState(jobError);
  const [duration, setDuration] = useState(totalDuration);

  // Sync state when props change
  useEffect(() => {
    if (jobProgress !== undefined) setProgress(jobProgress);
    if (jobStage) setStage(jobStage);
    if (jobStatus) setStatus(jobStatus);
    if (jobError) setError(jobError);
    if (totalDuration) setDuration(totalDuration);
  }, [jobProgress, jobStage, jobStatus, jobError, totalDuration]);

  // Polling hook to query backend status and dynamically update progress and stage
  useEffect(() => {
    if (!jobId || status === 'COMPLETED' || status === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/drone/status/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.success) {
          if (data.progress !== undefined) setProgress(data.progress);
          if (data.stage) setStage(data.stage);
          if (data.status) setStatus(data.status);
          if (data.error) setError(data.error);
          if (data.totalDuration) setDuration(data.totalDuration);
        }
      } catch (err) {
        // Polling kept silent
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, status]);

  const isProcessing = status === 'PROCESSING';

  // Base download path stripping cache query
  const downloadHref = modelUrl ? modelUrl.split('?')[0] : '/models/model.glb';

  // Pipeline milestone markers
  const milestones = [
    { threshold: 15, name: 'Extracting frames & telemetry', icon: Video },
    { threshold: 30, name: 'Running DUSt3R 3D reconstruction', icon: Layers },
    { threshold: 55, name: 'Optimizing camera poses & scene alignment', icon: Compass },
    { threshold: 75, name: 'Training 3D Gaussian Splatting model', icon: Cpu },
    { threshold: 90, name: 'Poisson mesh reconstruction & GLB export', icon: Box }
  ];

  return (
    <div className="viewer-page-container">
      {/* Top Action Header */}
      <header className="viewer-topbar">
        <div className="viewer-topbar-left">
          <button 
            type="button" 
            className="btn-back-home" 
            onClick={onBack}
            title="Return to Home & Upload Page"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          <div className="viewer-title-group">
            <h2 className="viewer-main-title">
              <Box size={18} className="text-cyan-400" />
              <span>Geo3D Vision • 3D Spatial Inspector</span>
            </h2>
            <p className="viewer-subtitle">
              {videoFileName ? `Source: ${videoFileName}` : `Active Asset: ${downloadHref}`}
            </p>
          </div>
        </div>

        <div className="viewer-topbar-right">
          {isProcessing ? (
            <div className="hud-badge processing-badge" style={{ padding: '8px 16px', background: 'rgba(37, 99, 235, 0.25)' }}>
              <RefreshCw size={14} className="spin-anim" />
              <span>{stage} ({progress}%)</span>
            </div>
          ) : (
            <>
              {onReload && (
                <button
                  type="button"
                  className="btn-viewer-action secondary"
                  onClick={onReload}
                  title="Reload model from disk"
                >
                  <RotateCcw size={15} />
                  <span>Reload 3D Asset</span>
                </button>
              )}

              <a
                href={downloadHref}
                download="reconstructed_model.glb"
                className="btn-viewer-action primary"
                title="Download GLB for Three.js / Cesium / Blender"
              >
                <Download size={15} />
                <span>Download GLB</span>
              </a>
            </>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <main className="viewer-main-content">
        <div className="viewer-stage-box">
          {isProcessing ? (
            /* Immersive Calm Pastel Processing & Assembly Screen */
            <div className="reconstruction-loading-panel">
              <div className="processing-assembly-stage">
                <AssemblyVisualizer progress={progress} width={420} height={260} />
                
                <div className="processing-header-group">
                  <div className="processing-badge">
                    <span className="processing-badge__dot"></span>
                    <span>Reconstruction in Progress</span>
                  </div>
                  <h3 className="processing-stage-title">{stage}</h3>
                  <p className="processing-stage-desc">
                    Synthesizing multi-view visual features, estimating depth coordinates, and assembling spatial geometry.
                  </p>
                </div>

                <div className="processing-progress-box">
                  <ProgressBar progress={progress} showPercent={true} />
                </div>
              </div>

              {/* Refined Pipeline Stages Card */}
              <GlassCard className="processing-stages-card">
                <div className="stages-card-header">
                  <span className="stages-card-title">Pipeline Milestones</span>
                  <span className="stages-card-count tabular-nums">
                    {milestones.filter(m => progress >= m.threshold).length} of {milestones.length}
                  </span>
                </div>

                <div className="stages-list">
                  {milestones.map((m, idx) => {
                    const isPassed = progress >= m.threshold;
                    const isCurrent = (progress >= m.threshold) && (idx === milestones.length - 1 || progress < milestones[idx + 1].threshold);
                    const StepIcon = m.icon;

                    return (
                      <div 
                        key={m.name} 
                        className={`stage-row ${isPassed ? 'is-passed' : ''} ${isCurrent ? 'is-current' : ''}`}
                      >
                        <div className="stage-row__indicator">
                          {isPassed && !isCurrent ? (
                            <CheckCircle2 size={15} className="stage-icon-complete" />
                          ) : (
                            <span className="stage-dot" />
                          )}
                        </div>

                        <span className="stage-row__label">{m.name}</span>

                        {isCurrent && (
                          <span className="stage-row__status-tag">Active</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          ) : status === 'FAILED' ? (
            /* Graceful Error State */
            <div className="reconstruction-error-panel">
              <GlassCard className="error-card">
                <div className="error-icon-box">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="error-title">Reconstruction Paused</h3>
                <p className="error-desc">
                  {error || 'The system could not complete the reconstruction from the uploaded video. Please verify the video quality and try again.'}
                </p>
                <div className="error-actions">
                  <Button variant="secondary" onClick={onBack}>
                    Back to Dashboard
                  </Button>
                </div>
              </GlassCard>
            </div>
          ) : (
            <ModelViewer modelUrl={modelUrl} pointSize={pointSize} />
          )}
        </div>

        {/* Metadata & Controls Strip */}
        <div className="viewer-meta-strip">
          <div className="meta-stats-list">
            <div className="stat-item">
              <span className="cyan-dot"></span>
              <span>Pipeline: <strong>DUSt3R + 3DGS Master</strong></span>
            </div>
            <div className="stat-item">
              <span>Format: <strong>GLTF / GLB Point Cloud</strong></span>
            </div>
            <div className="stat-item">
              <span>Renderer: <strong>WebGL • Three.js Points</strong></span>
            </div>
            <div className="stat-item">
              <span>Status: <strong style={{ color: status === 'FAILED' ? '#f87171' : isProcessing ? '#38bdf8' : '#34d399' }}>{status}</strong></span>
            </div>
            {duration && (
              <div className="stat-item">
                <span>Duration: <strong>{duration}</strong></span>
              </div>
            )}
          </div>

          <div className="stat-item">
            {status === 'FAILED' ? (
              <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} />
                <span>{error || 'Reconstruction encountered an error'}</span>
              </span>
            ) : isProcessing ? (
              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} className="spin-anim" />
                <span>{stage} ({progress}%)</span>
              </span>
            ) : (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} />
                <span>3D Point Cloud Generated & Georeferenced {duration ? `(${duration})` : ''}</span>
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
