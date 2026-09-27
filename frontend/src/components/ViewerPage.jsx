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
  Maximize2
} from 'lucide-react';
import './ViewerPage.css';

/**
 * Dedicated Full-Page 3D Spatial Reconstruction Inspection View
 */
export default function ViewerPage({
  onBack,
  modelUrl = '/models/model.glb',
  onReload,
  videoFileName = null
}) {
  const [pointSize, setPointSize] = useState(0.03);

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
              <span>DUSt3R 3D Spatial Twin Inspector</span>
            </h2>
            <p className="viewer-subtitle">
              {videoFileName ? `Source: ${videoFileName}` : 'Active Asset: public/models/model.glb'}
            </p>
          </div>
        </div>

        <div className="viewer-topbar-right">
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
            href="/models/model.glb"
            download="reconstructed_model.glb"
            className="btn-viewer-action primary"
            title="Download GLB for Three.js / Cesium / Blender"
          >
            <Download size={15} />
            <span>Download GLB</span>
          </a>
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
              <span>Pipeline: <strong>DUSt3R Multi-View Dense</strong></span>
            </div>
            <div className="stat-item">
              <span>Format: <strong>GLTF / GLB Point Cloud</strong></span>
            </div>
            <div className="stat-item">
              <span>Renderer: <strong>WebGL • Three.js Points</strong></span>
            </div>
            <div className="stat-item">
              <span>Confidence Threshold: <strong>3.0+</strong></span>
            </div>
          </div>

          <div className="stat-item">
            <CheckCircle2 size={15} style={{ color: '#10b981' }} />
            <span>Point Cloud Loaded & Georeferenced</span>
          </div>
        </div>
      </main>
    </div>
  );
}
