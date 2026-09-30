import React, { useState, useEffect } from 'react';
import ModelViewer from './ModelViewer';
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
            /* Dynamic Reconstruction Loading Screen */
            <div className="reconstruction-loading-panel">
              <div className="reconstruction-glow-backdrop"></div>
              
              <div className="reconstruction-loader-card">
                {/* Status Pill Badge */}
                <div className="reconstruction-status-pill">
                  <span className="pulsing-radar-dot"></span>
                  <span>AI RECONSTRUCTION ENGINE ACTIVE</span>
                </div>

                {/* Active Stage Name as descriptive text */}
                <h3 className="active-stage-title">{stage}</h3>
                <p className="active-stage-subtitle">
                  Single-pass multi-view point cloud reconstruction, camera pose optimization & geospatial alignment
                </p>

                {/* Animated Progress Bar */}
                <div className="stage-progress-container">
                  <div className="stage-progress-meta">
                    <span className="stage-progress-label">Current Progress</span>
                    <span className="stage-progress-percent">{progress}%</span>
                  </div>

                  <div className="stage-progress-bar-bg">
                    <div 
                      className="stage-progress-bar-fill" 
                      style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
                    >
                      <span className="stage-progress-shimmer"></span>
                    </div>
                  </div>
                </div>

                {/* Major Milestones Stepper */}
                <div className="pipeline-milestones-stepper">
                  {milestones.map((m, idx) => {
                    const isPassed = progress >= m.threshold;
                    const isCurrent = (progress >= m.threshold) && (idx === milestones.length - 1 || progress < milestones[idx + 1].threshold);
                    const StepIcon = m.icon;

                    return (
                      <div 
                        key={m.name} 
                        className={`milestone-item ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`}
                      >
                        <div className="milestone-icon-bubble">
                          {isPassed && !isCurrent ? (
                            <CheckCircle2 size={13} className="text-emerald-400" />
                          ) : (
                            <StepIcon size={13} />
                          )}
                        </div>
                        <span className="milestone-name">{m.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
