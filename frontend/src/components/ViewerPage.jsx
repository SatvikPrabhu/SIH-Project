import React, { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import './ViewerPage.css';

/**
 * Dedicated Full-Page 3D Spatial Reconstruction Inspection View
 */
export default function ViewerPage({
  onBack,
  modelUrl = '/models/model.glb',
  onReload,
  videoFileName = null,
  jobStatus = 'COMPLETED',
  jobProgress = 100,
  jobError = null
}) {
  const [pointSize, setPointSize] = useState(0.03);
  const isProcessing = jobStatus === 'PROCESSING';

  // Base download path stripping cache query
  const downloadHref = modelUrl ? modelUrl.split('?')[0] : '/models/model.glb';

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
            <div className="hud-badge" style={{ padding: '8px 16px', background: 'rgba(37, 99, 235, 0.2)' }}>
              <RefreshCw size={14} className="spin-anim" />
              <span>Pipeline Running ({jobProgress}%)...</span>
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
          <ModelViewer modelUrl={modelUrl} pointSize={pointSize} />
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
              <span>Status: <strong style={{ color: jobStatus === 'FAILED' ? '#f87171' : '#38bdf8' }}>{jobStatus}</strong></span>
            </div>
          </div>

          <div className="stat-item">
            {jobStatus === 'FAILED' ? (
              <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} />
                <span>Reconstruction encountered an error</span>
              </span>
            ) : isProcessing ? (
              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} className="spin-anim" />
                <span>Python pipeline executing ({jobProgress}%)...</span>
              </span>
            ) : (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} />
                <span>3D Point Cloud Generated & Georeferenced</span>
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
