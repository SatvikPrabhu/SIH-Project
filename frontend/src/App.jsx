import React, { useState, useRef, useEffect } from 'react';
import Navbar from './components/Navbar';
import ModelViewer from './components/ModelViewer';
import { 
  Upload, 
  Video, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Compass, 
  Eye, 
  FileVideo, 
  X, 
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
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/health', { method: 'GET' });
        if (res.ok) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch (err) {
        setBackendOnline(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
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
      { step: 1, duration: 1200 }, // Uploading
      { step: 2, duration: 1800 }, // Keyframe Extraction (FPS)
      { step: 3, duration: 2000 }, // YOLOv8 Segmentation
      { step: 4, duration: 2500 }, // Dust3R 3D Point Cloud Reconstruction
      { step: 5, duration: 1000 }, // Cesium 3D Tiles Export
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
    <div className="homepage-wrapper">
      {/* Basic Navbar */}
      <Navbar backendOnline={backendOnline} />

      {/* Main Hero Container */}
      <main className="hero-section" id="home">
        {/* Background Video Layer */}
        <div className="hero-video-bg-wrapper">
          <video
            className="hero-video-element"
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
              id="video-upload-input"
            />

            {!videoFile ? (
              <div 
                className={`dropzone-box ${isDragging ? 'dropzone-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="dropzone-glow"></div>
                
                {/* BIG UPLOAD VIDEO BUTTON */}
                <button 
                  type="button" 
                  className="big-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  id="main-upload-video-button"
                >
                  <div className="btn-icon-circle">
                    <Upload size={28} className="upload-icon-anim" />
                  </div>
                  <div className="btn-text-content">
                    <span className="btn-main-text">Upload Video</span>
                    <span className="btn-sub-text">Click to browse or drop video files</span>
                  </div>
                </button>

                {/* Dropzone helper info */}
                <div className="dropzone-meta">
                  <span className="meta-pill">MP4</span>
                  <span className="meta-pill">MOV</span>
                  <span className="meta-pill">AVI</span>
                  <span className="meta-pill">MKV</span>
                  <span className="meta-divider">•</span>
                  <span className="meta-size">Up to 4K / 500MB</span>
                </div>

                {/* Sample Test Video Quick Select */}
                <div className="sample-videos-wrapper">
                  <span className="sample-label">Or try a sample drone dataset:</span>
                  <div className="sample-btn-group">
                    <button 
                      type="button" 
                      className="sample-btn"
                      onClick={() => handleSelectSample('drone_urban_quarry')}
                    >
                      <Video size={13} />
                      <span>Urban Survey 4K</span>
                    </button>
                    <button 
                      type="button" 
                      className="sample-btn"
                      onClick={() => handleSelectSample('mountain_topography')}
                    >
                      <Video size={13} />
                      <span>Terrain Topography</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Selected Video Panel & Pipeline Controller */
              <div className="video-preview-card">
                <div className="preview-header">
                  <div className="file-info-col">
                    <div className="file-icon-badge">
                      <FileVideo size={24} />
                    </div>
                    <div>
                      <h4 className="file-name">{videoFile.name}</h4>
                      <p className="file-details">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB • Ready for 3D Reconstruction
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="clear-btn" 
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

      {/* Footer */}
      <footer className="footer-container" id="tech">
        <div className="footer-content">
          <div className="footer-left">
            <div className="footer-logo">
              <Box size={18} />
              <span>Geo3D Vision</span>
            </div>
            <p className="footer-desc">
              AI-driven multi-view 3D digital twin platform for smart city surveys, disaster response, and drone analytics.
            </p>
          </div>
          <div className="footer-tech-stack">
            <span className="tech-badge">FastAPI</span>
            <span className="tech-badge">PyTorch</span>
            <span className="tech-badge">Dust3R</span>
            <span className="tech-badge">YOLOv8</span>
            <span className="tech-badge">CesiumJS</span>
            <span className="tech-badge">Vite React</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Geo3D Vision • <a href="https://github.com/SatvikPrabhu/SIH-Project" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>GitHub (SatvikPrabhu/SIH-Project)</a></span>
          <a href="#home" className="back-to-top">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
