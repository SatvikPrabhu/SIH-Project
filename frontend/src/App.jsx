import React, { useState, useRef, useEffect } from 'react';
import Navbar from './components/Navbar';
import ModelViewer from './components/ModelViewer';
import {
  Upload,
  FileVideo,
  Video,
  CheckCircle2,
  X,
  Play,
  Sparkles,
  Layers,
  Compass,
  Camera,
  Box,
  Zap,
  RefreshCw,
  Sliders,
  ChevronRight,
  Database,
  Globe2,
  Box,
  RotateCcw
} from 'lucide-react';
import heroBgVideo from './assets/HomePageGIF.mp4';
import './App.css';


export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [backendOnline, setBackendOnline] = useState(false);

  // 3D Model Viewer State & Cache-Busting Key
  const [showViewer, setShowViewer] = useState(false);
  const [modelKey, setModelKey] = useState(Date.now());

  // Pipeline Settings
  const [fps, setFps] = useState(2);
  const [segmentationEnabled, setSegmentationEnabled] = useState(true);
  const [resolution, setResolution] = useState('1080p');

  const fileInputRef = useRef(null);

  // Check backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/health', { method: 'GET' });
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      loadVideo(file);
    }
  };

  const loadVideo = (file) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setProgress(0);
    setIsProcessing(false);
    setCurrentStep(0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      loadVideo(file);
    }
  };

  const handleSelectSample = (sampleName) => {
    const mockFile = {
      name: `${sampleName}.mp4`,
      size: 42 * 1024 * 1024,
      type: 'video/mp4',
      lastModified: Date.now()
    };
    setVideoFile(mockFile);
    setVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
    setProgress(0);
    setIsProcessing(false);
    setCurrentStep(0);
  };

  const handleClearVideo = () => {
    if (videoUrl && !videoUrl.startsWith('http')) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl('');
    setIsProcessing(false);
    setProgress(0);
    setCurrentStep(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Toggle or reload 3D Model Viewer with timestamp cache-buster
  const handleToggleViewer = () => {
    setShowViewer(true);
    setModelKey(Date.now());
  };

  const handleCloseViewer = () => {
    setShowViewer(false);
  };

  const startPipelineSimulation = async () => {
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep(1);

    const steps = [
      { step: 1, duration: 2000 }, // Keyframe & Blur Filtering
      { step: 2, duration: 2500 }, // Structure from Motion (SfM)
      { step: 3, duration: 1800 }, // GPS Georeferencing (Sim3)
      { step: 4, duration: 3200 }, // 3D Gaussian Splatting Training
      { step: 5, duration: 1800 }, // Multi-Format Export
    ];

    let totalDuration = steps.reduce((acc, curr) => acc + curr.duration, 0);
    let elapsed = 0;

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(steps[i].step);
      const stepDuration = steps[i].duration;
      const intervalMs = 100;
      const ticks = stepDuration / intervalMs;

      for (let t = 0; t < ticks; t++) {
        await new Promise((res) => setTimeout(res, intervalMs));
        elapsed += intervalMs;
        setProgress(Math.min(100, Math.round((elapsed / totalDuration) * 100)));
      }
    }

    setIsProcessing(false);
    // Automatically reveal the 3D Viewer upon pipeline completion
    setShowViewer(true);
    setModelKey(Date.now());
  };

  return (
    <div className="app-container" id="home">
      {/* 1. Simple Navbar */}
      <Navbar backendOnline={backendOnline} />

      {/* 2. Hero & Video Upload Section with 3D Earth Background */}
      <main className="hero-section" id="upload-section">
        {/* 3D Google Earth Background Video Loop */}
        <div className="hero-video-bg-container">
          <video
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={heroBgVideo} type="video/mp4" />
          </video>
          <div className="hero-video-overlay"></div>
        </div>

        <div className="hero-glow-sphere sphere-1"></div>
        <div className="hero-glow-sphere sphere-2"></div>
        <div className="hero-grid-pattern"></div>

        <div className="hero-content">
          {/* Semi-transparent Glass Card for Hero Heading */}
          <div className="hero-text-card">
            {/* Placeholder Title in the Center */}
            <h1 className="hero-title">
              Transform Aerial Drone Videos into <br />
              <span className="text-gradient">Interactive 3D Geospatial Twins</span>
            </h1>

            {/* Center Subtitle */}
            <p className="hero-subtitle">
              Upload multi-view drone footage to automatically extract motion-aware keyframes,
              segment semantic terrain with YOLOv8, and reconstruct dense 3D point clouds with Dust3R.
            </p>
          </div>

          {/* Upload Area / Big Upload Video Button */}
          <div className="upload-container" id="upload-section">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
              className="hidden-file-input"
            />

            {!videoFile ? (
              /* Dropzone with Big Upload Button */
              <div
                className={`upload-dropzone ${isDragging ? 'dropzone-drag' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* BIG UPLOAD VIDEO BUTTON */}
                <button
                  type="button"
                  className="big-upload-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-icon-circle">
                    <Upload size={28} />
                  </div>
                  <div className="upload-text-group">
                    <span className="upload-primary-text">Upload Drone Video</span>
                    <span className="upload-secondary-text">Click to browse or drag & drop files here</span>
                  </div>
                </button>

                {/* Formats & File Limit */}
                <div className="dropzone-format-tags">
                  <span className="format-tag">MP4</span>
                  <span className="format-tag">MOV</span>
                  <span className="format-tag">AVI</span>
                  <span className="format-tag">MKV</span>
                  <span className="format-divider">•</span>
                  <span className="format-note">Supports 4K / 1080p aerial footage</span>
                </div>
              </div>
            ) : (
              /* Selected Video Preview Card */
              <div className="selected-video-card">
                <div className="video-card-header">
                  <div className="video-info-group">
                    <div className="video-icon-badge">
                      <FileVideo size={22} />
                    </div>
                    <div>
                      <h4 className="video-filename">{videoFile.name}</h4>
                      <p className="video-meta">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB • Ready for 3D Reconstruction
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="remove-video-btn"
                    onClick={handleClearVideo}
                    title="Remove Video"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Video Player & Pipeline Config Grid */}
                <div className="preview-body-grid">
                  <div className="video-player-container">
                    <video
                      src={videoUrl}
                      controls
                      className="video-player"
                      muted
                      playsInline
                    />
                  </div>

                  {/* Settings Panel */}
                  <div className="pipeline-settings-panel">
                    <h5 className="settings-title">
                      <Sliders size={16} />
                      <span>Pipeline Settings</span>
                    </h5>

                    <div className="setting-row">
                      <label>Keyframe Sampling Rate</label>
                      <div className="pill-selector">
                        {[1, 2, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            className={`pill-opt ${fps === val ? 'selected' : ''}`}
                            onClick={() => setFps(val)}
                          >
                            {val} FPS
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="setting-row">
                      <label>YOLOv8 AI Masking</label>
                      <button
                        type="button"
                        className={`toggle-btn ${segmentationEnabled ? 'active' : ''}`}
                        onClick={() => setSegmentationEnabled(!segmentationEnabled)}
                      >
                        <span className="toggle-slider"></span>
                        <span className="toggle-label">{segmentationEnabled ? 'Enabled' : 'Disabled'}</span>
                      </button>
                    </div>

                    <div className="setting-row">
                      <label>3D Reconstruction Mode</label>
                      <span className="setting-badge-highlight">Dust3R Multi-View Dense</span>
                    </div>

                    {/* Progress Bar (if processing) */}
                    {isProcessing && (
                      <div className="progress-container">
                        <div className="progress-meta">
                          <span className="progress-step-text">
                            {currentStep === 1 && "Uploading video frames..."}
                            {currentStep === 2 && `Extracting keyframes at ${fps} FPS...`}
                            {currentStep === 3 && "Running YOLOv8 semantic segmentation..."}
                            {currentStep === 4 && "Reconstructing 3D point cloud with Dust3R..."}
                            {currentStep === 5 && "Exporting Cesium 3D Tiles & PLY..."}
                          </span>
                          <span className="progress-percentage">{progress}%</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    )}

                    {/* Process Action Button */}
                    <button
                      type="button"
                      className={`process-launch-btn ${isProcessing ? 'disabled' : ''}`}
                      onClick={progress === 100 ? handleToggleViewer : startPipelineSimulation}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw size={18} className="spin-anim" />
                          <span>Processing Pipeline ({progress}%)...</span>
                        </>
                      ) : progress === 100 ? (
                        <>
                          <CheckCircle2 size={18} className="text-emerald" />
                          <span>3D Model Ready • View in 3D Viewport</span>
                        </>
                      ) : (
                        <>
                          <Zap size={18} />
                          <span>Start 3D Reconstruction Pipeline</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress & Stepper (if processing) */}
                {isProcessing && (
                  <div className="pipeline-progress-box">
                    <div className="progress-info-row">
                      <span className="step-name-text">
                        {currentStep === 1 && "Step 1/5: Extracting keyframes & filtering blur..."}
                        {currentStep === 2 && "Step 2/5: Estimating camera poses (SfM)..."}
                        {currentStep === 3 && "Step 3/5: Aligning with GPS coordinates (Sim3)..."}
                        {currentStep === 4 && "Step 4/5: Training 3D Gaussian Splats..."}
                        {currentStep === 5 && "Step 5/5: Exporting 3D Mesh & Cesium Tiles..."}
                      </span>
                      <span className="progress-percent font-mono">{progress}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Process Action Button */}
                <button
                  type="button"
                  className={`start-pipeline-btn ${isProcessing ? 'disabled' : ''}`}
                  onClick={startReconstruction}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="spin-icon" />
                      <span>Reconstructing 3D Model ({progress}%)...</span>
                    </>
                  ) : progress === 100 ? (
                    <>
                      <CheckCircle2 size={18} className="text-emerald" />
                      <span>3D Model Ready • Download Assets Below</span>
                    </>
                  ) : (
                    <>
                      <Zap size={18} />
                      <span>Process Video & Reconstruct in 3D</span>
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 3D Model Inspection & Viewport Controller Section */}
          <section className="inspection-section" id="model-inspection">
            {/* Top Action Bar */}
            <div className="inspection-header-bar">
              <div className="inspection-title-group">
                <div className="inspection-icon-badge">
                  <Box size={22} />
                </div>
                <div>
                  <h3 className="inspection-heading">
                    3D Spatial Reconstruction Inspector
                  </h3>
                  <p className="inspection-subheading">
                    Real-time WebGL/Three.js rendering for DUSt3R point clouds and exported GLBs
                  </p>
                </div>
              </div>

              <div className="inspection-actions-group">
                <button
                  type="button"
                  className={`btn-view-model ${showViewer ? 'active-reload' : ''}`}
                  onClick={handleToggleViewer}
                >
                  {showViewer ? (
                    <>
                      <RotateCcw size={16} />
                      <span>Reload / View Reconstruction</span>
                    </>
                  ) : (
                    <>
                      <Eye size={16} />
                      <span>View Generated Model</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Viewer Active or Empty State Placeholder */}
            {showViewer ? (
              <div className="viewer-active-wrapper">
                <button
                  type="button"
                  className="btn-close-viewport"
                  onClick={handleCloseViewer}
                  title="Close 3D Viewport"
                >
                  <X size={14} />
                  <span>Close Viewport ✕</span>
                </button>
                <ModelViewer modelUrl={`/models/model.glb?v=${modelKey}`} />
              </div>
            ) : (
              <div className="viewer-empty-state-card">
                <div className="empty-state-icon">
                  <Layers size={26} />
                </div>
                <h4 className="empty-state-title">No Active 3D Session Open</h4>
                <p className="empty-state-desc">
                  Click <strong>"View Generated Model"</strong> above to inspect <code>public/models/model.glb</code> or trigger a reconstruction pipeline.
                </p>
                <button
                  type="button"
                  className="btn-view-model"
                  onClick={handleToggleViewer}
                >
                  <Eye size={15} />
                  <span>View Generated Model</span>
                </button>
              </div>
            )}
          </section>

          {/* Quick Metrics & Feature Highlights */}
          <div className="features-highlight-grid" id="features">
            <div className="feature-card">
              <div className="feature-icon-wrapper cyan">
                <Video size={22} />
              </div>
              <h3>Intelligent Keyframing</h3>
              <p>Extracts sharp, motion-compensated frames while filtering out blurry or redundant viewpoints.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper purple">
                <Cpu size={22} />
              </div>
              <h3>YOLOv8 AI Masking</h3>
              <p>Performs instant instance segmentation on dynamic objects, terrain features, and structures.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper emerald">
                <Layers size={22} />
              </div>
              <h3>Dust3R 3D Point Cloud</h3>
              <p>Generates dense 3D point clouds without manual camera calibration or extrinsic pose matrices.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper blue">
                <Globe2 size={22} />
              </div>
              <h3>Cesium GIS Integration</h3>
              <p>Exports georeferenced LAS, GeoTIFF, and 3D Tiles for sub-meter GIS geospatial mapping.</p>
            </div>
          </div>
        </div>
      </main>

      {/* 3. How the Project Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <span className="section-badge">PIPELINE ARCHITECTURE</span>
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              From a single drone video pass to high-density, georeferenced 3D digital twins in 5 automated steps.
            </p>
          </div>

          {/* 5-Step Workflow Cards Grid */}
          <div className="steps-grid" id="pipeline">
            {/* Step 1 */}
            <div className="workflow-card">
              <div className="step-number-tag">01</div>
              <div className="workflow-icon-box cyan">
                <Video size={22} />
              </div>
              <h3 className="workflow-title">Video & Telemetry Ingestion</h3>
              <p className="workflow-desc">
                Ingests standard 4K or 1080p drone footage alongside time-synchronized GPS metadata (embedded DJI SRT subtitles or flight logs).
              </p>
            </div>

            {/* Step 2 */}
            <div className="workflow-card">
              <div className="step-number-tag">02</div>
              <div className="workflow-icon-box emerald">
                <Camera size={22} />
              </div>
              <h3 className="workflow-title">Blur Filtering & Keyframing</h3>
              <p className="workflow-desc">
                Calculates Laplacian sharpness variance across frames, automatically discarding motion-blurred frames to preserve crisp visual details.
              </p>
            </div>

            {/* Step 3 */}
            <div className="workflow-card">
              <div className="step-number-tag">03</div>
              <div className="workflow-icon-box purple">
                <Layers size={22} />
              </div>
              <h3 className="workflow-title">Structure from Motion (SfM)</h3>
              <p className="workflow-desc">
                Extracts visual feature tie-points and matches sequential frames to solve exact camera position trajectories and initial sparse 3D geometry.
              </p>
            </div>

            {/* Step 4 */}
            <div className="workflow-card">
              <div className="step-number-tag">04</div>
              <div className="workflow-icon-box amber">
                <Compass size={22} />
              </div>
              <h3 className="workflow-title">GPS Metric Georeferencing</h3>
              <p className="workflow-desc">
                Applies the Umeyama 7-DOF Sim(3) algorithm to rigidly scale and align the reconstructed model with real-world UTM coordinates (≤ 1m accuracy).
              </p>
            </div>

            {/* Step 5 */}
            <div className="workflow-card">
              <div className="step-number-tag">05</div>
              <div className="workflow-icon-box blue">
                <Box size={22} />
              </div>
              <h3 className="workflow-title">3D Gaussian Splats & Export</h3>
              <p className="workflow-desc">
                Trains high-density 3D Gaussian Splats and exports standard deliverables: Textured OBJ Meshes, ASPRS LAS LiDAR, DSM GeoTIFFs, and Cesium 3D Tiles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Footer */}
      <footer className="simple-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <Box size={18} className="text-emerald" />
            <span>Geo3D Vision</span>
            <span className="footer-divider">•</span>
            <span className="footer-meta">Single-Pass Drone 3D Reconstruction</span>
          </div>

          <div className="footer-tech">
            <span className="tech-tag">FastAPI</span>
            <span className="tech-tag">PyTorch</span>
            <span className="tech-tag">Dust3R / 3DGS</span>
            <span className="tech-tag">CesiumJS</span>
          </div>

          <div className="footer-copy">
            <a href="https://github.com/SatvikPrabhu/SIH-Project" target="_blank" rel="noreferrer" className="footer-gh-link">
              GitHub (SatvikPrabhu/SIH-Project)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
