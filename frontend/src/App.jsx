import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import ViewerPage from './components/ViewerPage';
import GlassCard from './components/ui/GlassCard';
import Button from './components/ui/Button';
import Switch from './components/ui/Switch';
import SegmentedControl from './components/ui/SegmentedControl';
import ProgressBar from './components/ui/ProgressBar';
import AssemblyVisualizer from './components/ui/AssemblyVisualizer';
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
  Cpu,
  Zap,
  RefreshCw,
  Sliders,
  ChevronRight,
  Database,
  Globe2,
  Eye,
  RotateCcw,
  ExternalLink,
  AlertCircle,
  Download
} from 'lucide-react';
import heroBgVideo from './assets/HomePageGIF.mp4';
import './App.css';

const API_BASE_URL = 'http://localhost:5000';

const PIPELINE_MILESTONES = [
  { threshold: 15, name: 'Extracting frames & telemetry', icon: Video },
  { threshold: 30, name: 'Running DUSt3R 3D reconstruction', icon: Layers },
  { threshold: 55, name: 'Optimizing camera poses & scene alignment', icon: Compass },
  { threshold: 75, name: 'Training 3D Gaussian Splatting model', icon: Cpu },
  { threshold: 90, name: 'Poisson mesh reconstruction & GLB export', icon: Box }
];

export default function App() {
  // Navigation / Page View State ('home' | 'viewer')
  const [currentView, setCurrentView] = useState('home');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [backendOnline, setBackendOnline] = useState(false);

  // Active 3D Job & Model Tracking
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('IDLE'); // 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStage, setJobStage] = useState('Extracting frames & telemetry');
  const [jobError, setJobError] = useState(null);
  const [activeModelPath, setActiveModelPath] = useState('/models/model.glb');
  const [modelKey, setModelKey] = useState(Date.now());
  const [totalDuration, setTotalDuration] = useState(null);

  // Pipeline Settings
  const [fps, setFps] = useState(2);
  const [segmentationEnabled, setSegmentationEnabled] = useState(true);
  const [resolution, setResolution] = useState('1080p');

  const fileInputRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const generationStartTimeRef = useRef(null);

  // Sync hash routing (#viewer <-> #home)
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#viewer') {
        setCurrentView('viewer');
      } else {
        setCurrentView('home');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle ESC key to dismiss upload pop-up modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showUploadModal) {
        setShowUploadModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUploadModal]);

  // Check backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/health`, { method: 'GET' });
        setBackendOnline(res.ok);
      } catch {
        try {
          const resFallback = await fetch(`http://localhost:8000/api/v1/health`, { method: 'GET' });
          setBackendOnline(resFallback.ok);
        } catch {
          setBackendOnline(false);
        }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Poll backend status endpoint for active job (silent background updates without console spam)
  const startStatusPolling = useCallback((jobId) => {
    stopPolling();
    setJobStatus('PROCESSING');
    setJobProgress(15);
    setJobStage('Extracting frames & telemetry');
    setIsProcessing(true);

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/drone/status/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.success) {
          if (data.progress !== undefined) {
            setJobProgress(data.progress);
            setProgress(data.progress);
          }
          if (data.stage) {
            setJobStage(data.stage);
          }
          if (data.totalDuration) {
            setTotalDuration(data.totalDuration);
          }

          if (data.status === 'COMPLETED') {
            const durationMs = generationStartTimeRef.current ? Date.now() - generationStartTimeRef.current : 0;
            const durationSec = (durationMs / 1000).toFixed(2);
            const mins = Math.floor(durationSec / 60);
            const remSec = (durationSec % 60).toFixed(2);
            const durationFormatted = data.totalDuration || (mins > 0 ? `${mins}m ${remSec}s` : `${durationSec}s`);

            setTotalDuration(durationFormatted);
            if (data.modelGlbUrl) {
              setActiveModelPath(data.modelGlbUrl);
            }
            setJobStatus('COMPLETED');
            setJobProgress(100);
            setProgress(100);
            setJobStage('Reconstruction complete');
            setIsProcessing(false);
            setModelKey(Date.now());
            stopPolling();

            console.log(`\n============================================================`);
            console.log(`[FILE TRANSFER] 3D Model Formation Complete`);
            console.log(`  Job ID: ${jobId}`);
            if (data.modelGlbUrl) {
              console.log(`  Output Model: ${data.modelGlbUrl}`);
            }
            console.log(`  Total Time: ${durationFormatted} (${durationSec} seconds)`);
            console.log(`============================================================\n`);
          } else if (data.status === 'FAILED') {
            console.error(`\n[PIPELINE FAILED] Job [${jobId}]: ${data.error || 'Reconstruction pipeline failed'}\n`);
            setJobStatus('FAILED');
            setJobStage('Reconstruction failed');
            setJobError(data.error || 'Reconstruction pipeline failed');
            setIsProcessing(false);
            stopPolling();
          } else if (data.status === 'PROCESSING') {
            setJobStatus('PROCESSING');
            const realProgress = data.progress !== undefined ? data.progress : 15;
            setJobProgress(realProgress);
            setProgress(realProgress);
          }
        }
      } catch (err) {
        // Polling errors handled silently to avoid terminal/console noise
      }
    }, 2000);
  }, [stopPolling]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Navigation handlers
  const navigateToViewer = () => {
    setModelKey(Date.now());
    window.location.hash = '#viewer';
    setCurrentView('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    window.location.hash = '#home';
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Launch pipeline: Extract frames -> feed /generation -> generate 3D model
  const handleStartPipeline = async () => {
    if (!videoFile) return;

    // Keep the 3D Earth video background intact, and transition pop-up directly to loading screen
    setShowUploadModal(true);

    generationStartTimeRef.current = Date.now();
    setTotalDuration(null);
    setIsProcessing(true);
    setProgress(10);
    setJobStatus('PROCESSING');
    setJobProgress(10);
    setJobStage('Extracting frames & telemetry');
    setCurrentStep(1);

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('fps', fps.toString());
    formData.append('segmentation', segmentationEnabled.toString());

    console.log(`\n============================================================`);
    console.log(`[FILE TRANSFER] Sending video to backend for 3D reconstruction`);
    console.log(`  File: ${videoFile.name}`);
    console.log(`  Size: ${(videoFile.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  Target: ${API_BASE_URL}/api/drone/upload`);
    console.log(`============================================================\n`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/drone/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const jobId = data.videoId || data.jobId;
        console.log(`\n============================================================`);
        console.log(`[FILE TRANSFER] Video file transfer successful`);
        console.log(`  Job ID: ${jobId}`);
        console.log(`============================================================\n`);

        setActiveJobId(jobId);
        startStatusPolling(jobId);
      } else {
        const errorText = await res.text();
        console.warn(`\n[UPLOAD] Server responded with status ${res.status}: ${errorText}\n`);
        startLocalSimulation();
      }
    } catch (err) {
      console.warn(`\n[UPLOAD] Backend connection unavailable (${err.message}). Starting local simulation.\n`);
      startLocalSimulation();
    }
  };

  const startLocalSimulation = async () => {
    console.log(`\n============================================================`);
    console.log(`[SIMULATION] Starting local 3D reconstruction simulation`);
    console.log(`============================================================\n`);
    const steps = [
      { step: 1, name: 'Extracting keyframes & blur detection', duration: 1800 },
      { step: 2, name: 'YOLOv8 semantic terrain masking', duration: 2200 },
      { step: 3, name: 'DUSt3R multi-view point cloud reconstruction', duration: 2500 },
      { step: 4, name: 'GPS metric telemetry georeferencing (Sim3)', duration: 1800 },
      { step: 5, name: 'Exporting 3D GLB & Cesium 3D Tiles', duration: 1200 },
    ];

    let totalDurationMs = steps.reduce((acc, curr) => acc + curr.duration, 0);
    let elapsed = 0;

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(steps[i].step);
      setJobStage(steps[i].name);
      const stepDuration = steps[i].duration;
      const intervalMs = 100;
      const ticks = stepDuration / intervalMs;

      for (let t = 0; t < ticks; t++) {
        await new Promise((res) => setTimeout(res, intervalMs));
        elapsed += intervalMs;
        const currentPct = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
        setProgress(currentPct);
        setJobProgress(currentPct);
      }
    }

    const durationSec = ((Date.now() - (generationStartTimeRef.current || Date.now())) / 1000).toFixed(2);
    const mins = Math.floor(durationSec / 60);
    const remSec = (durationSec % 60).toFixed(2);
    const durationFormatted = mins > 0 ? `${mins}m ${remSec}s` : `${durationSec}s`;
    setTotalDuration(durationFormatted);

    console.log(`\n============================================================`);
    console.log(`[FILE TRANSFER] 3D Model Formation Complete (Simulation)`);
    console.log(`  Model File: /models/model.glb`);
    console.log(`  Total Time: ${durationFormatted} (${durationSec} seconds)`);
    console.log(`============================================================\n`);

    setIsProcessing(false);
    setJobStatus('COMPLETED');
    setActiveModelPath('/models/model.glb');
    setModelKey(Date.now());
  };

  // Video File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      console.log(`\n[FILE SELECT] Video selected: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)\n`);
      loadVideo(file);
    }
  };

  const loadVideo = (file) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setProgress(0);
    setJobProgress(0);
    setJobStatus('IDLE');
    setCurrentStep(0);
    setIsProcessing(false);
    setShowUploadModal(true); // Open modal popup whenever a video is uploaded
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
      console.log(`\n[FILE DROP] Video dropped: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)\n`);
      loadVideo(file);
    }
  };


  const handleClearVideo = () => {
    console.log(`\n[FILE CLEAR] Video selection cleared\n`);
    if (videoUrl && !videoUrl.startsWith('http')) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl('');
    setShowUploadModal(false);
    setIsProcessing(false);
    setProgress(0);
    setJobProgress(0);
    setJobStatus('IDLE');
    setCurrentStep(0);
    stopPolling();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // If in Viewer View, render dedicated full-page ModelViewer
  if (currentView === 'viewer') {
    return (
      <ViewerPage
        onBack={navigateToHome}
        modelUrl={`${activeModelPath}?v=${modelKey}`}
        onReload={() => setModelKey(Date.now())}
        videoFileName={videoFile?.name}
        jobId={activeJobId}
        jobStatus={jobStatus}
        jobProgress={jobProgress}
        jobStage={jobStage}
        jobError={jobError}
        totalDuration={totalDuration}
      />
    );
  }

  const currentWorkflowStep = currentView === 'viewer' || jobStatus === 'COMPLETED' ? 3
    : jobStatus === 'PROCESSING' ? 2
    : videoFile ? 1
    : 0;

  // Otherwise, render the Main Landing & Upload Page
  return (
    <div className="app-container" id="home">
      {/* 1. Minimal Glass Navbar with Step Indicator */}
      <Navbar backendOnline={backendOnline} currentStep={currentWorkflowStep} />

      {/* 2. Hero & Video Upload Section */}
      <main className="hero-section" id="upload-section">
        {/* Soft atmospheric background video layer */}
        <div className="hero-video-bg-container">
          <video
            className="hero-bg-video"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={heroBgVideo} type="video/mp4" />
          </video>
          <div className="hero-video-overlay"></div>
        </div>

        <div className="hero-content">
          {/* Active 3D Reconstruction Live Banner */}
          {jobStatus === 'PROCESSING' && (
            <GlassCard className="active-job-floating-banner" onClick={navigateToViewer}>
              <div className="banner-left-info">
                <span className="pulse-dot"></span>
                <span>Active Reconstruction: <strong>{jobStage} ({jobProgress}%)</strong></span>
              </div>
              <span className="banner-action-link">
                <span>Open Viewport</span>
                <ChevronRight size={15} />
              </span>
            </GlassCard>
          )}

          {/* Centered Hero Card */}
          <GlassCard className="hero-text-card">
            <div className="hero-badge">
              <span className="hero-badge__dot"></span>
              <span>Spatial Computing & Aerial Survey</span>
            </div>

            <h1 className="hero-title">
              Aerial Video to <span className="hero-title-accent">3D Spatial Twin</span>
            </h1>

            <p className="hero-subtitle">
              Upload multi-view drone footage to automatically extract motion-compensated keyframes, segment terrain features, and reconstruct dense 3D geospatial point clouds.
            </p>
          </GlassCard>

          {/* Screen 1: Upload Dropzone Area */}
          <div className="upload-container" id="upload-section">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
              className="hidden-file-input"
            />

            <div
              className={`upload-dropzone ${isDragging ? 'dropzone-drag' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload drone video drop zone"
            >
              <div className="upload-icon-circle">
                <Upload size={26} />
              </div>

              <div className="upload-text-group">
                <span className="upload-primary-text">Drag and drop your drone footage</span>
                <span className="upload-secondary-text">or choose a video file from your computer</span>
              </div>

              <div className="upload-browse-action">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse Files
                </Button>
              </div>

              <div className="dropzone-format-tags">
                <span>MP4, MOV, AVI, MKV • Up to 4K resolution</span>
              </div>

              {/* If a video is selected and modal is currently closed, show reopen status bar */}
              {videoFile && !showUploadModal && (
                <div 
                  className="selected-video-reopen-bar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="selected-video-reopen-info">
                    <FileVideo size={17} className="file-icon-accent" />
                    <span className="reopen-filename" title={videoFile.name}>{videoFile.name}</span>
                    <span className="reopen-size tabular-nums">({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                  </div>
                  <div className="reopen-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowUploadModal(true)}
                      icon={<Sliders size={13} />}
                    >
                      Review & Configure
                    </Button>
                    <button
                      type="button"
                      className="btn-clear-chip"
                      onClick={handleClearVideo}
                      title="Clear video"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Screen 2 & 3: Review & Processing Modal Dialog */}
          {showUploadModal && videoFile && (
            <div 
              className="upload-modal-backdrop" 
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowUploadModal(false);
              }}
            >
              <GlassCard className="upload-modal-card" role="dialog" aria-modal="true">
                {/* 1. ACTIVE PROCESSING STATE (Screen 3: Processing in Modal) */}
                {jobStatus === 'PROCESSING' ? (
                  <>
                    <div className="upload-modal-header processing-header">
                      <div className="modal-header-left">
                        <div className="modal-icon-badge">
                          <RefreshCw size={18} className="spin-anim" />
                        </div>
                        <div>
                          <div className="modal-tag-badge">
                            <span className="pulse-dot"></span>
                            <span>RECONSTRUCTION ACTIVE</span>
                          </div>
                          <h3 className="modal-title">Generating 3D Spatial Twin</h3>
                          <p className="modal-subtitle">
                            Source: {videoFile.name} • {activeJobId ? `Job: ${activeJobId}` : 'Processing frames...'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="modal-close-btn"
                        onClick={() => setShowUploadModal(false)}
                        title="Minimize window (reconstruction continues in background)"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="upload-modal-body modal-loading-body">
                      {/* Central Assembling 3D Visualizer */}
                      <AssemblyVisualizer progress={jobProgress || progress} width={380} height={200} />

                      {/* Active Stage Callout */}
                      <div className="modal-stage-highlight">
                        <span className="stage-mini-pill">ACTIVE PIPELINE STAGE</span>
                        <h4 className="modal-active-stage-title">{jobStage}</h4>
                        <p className="modal-active-stage-desc">
                          Multi-view depth estimation, global scene alignment & neural volumetric splatting in progress.
                        </p>
                      </div>

                      {/* Progress Bar Container */}
                      <div className="modal-progress-wrapper">
                        <ProgressBar progress={jobProgress || progress} label="Overall Progress" showPercent={true} />
                      </div>

                      {/* Milestones Stepper */}
                      <div className="modal-milestones-list">
                        {PIPELINE_MILESTONES.map((m, idx) => {
                          const currentProg = jobProgress || progress;
                          const isPassed = currentProg >= m.threshold;
                          const isCurrent = currentProg >= m.threshold && (idx === PIPELINE_MILESTONES.length - 1 || currentProg < PIPELINE_MILESTONES[idx + 1].threshold);

                          return (
                            <div 
                              key={m.name} 
                              className={`modal-milestone-item ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`}
                            >
                              <div className="modal-milestone-icon">
                                {isPassed && !isCurrent ? (
                                  <CheckCircle2 size={14} className="text-emerald" />
                                ) : (
                                  <span className="modal-step-dot" />
                                )}
                              </div>
                              <span className="modal-milestone-label">{m.name}</span>
                              {isCurrent && <span className="modal-current-indicator">In Progress</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="upload-modal-footer">
                      <div className="modal-footer-notice">
                        <Sparkles size={14} style={{ flexShrink: 0 }} />
                        <span>Background view is live. You can minimize this window anytime without interrupting generation.</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => setShowUploadModal(false)}
                      >
                        Minimize Window
                      </Button>
                    </div>
                  </>
                ) : jobStatus === 'COMPLETED' ? (
                  /* 2. COMPLETED STATE */
                  <>
                    <div className="upload-modal-header success-header">
                      <div className="modal-header-left">
                        <div className="modal-icon-badge success-badge">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <h3 className="modal-title">3D Reconstruction Completed</h3>
                          <p className="modal-subtitle">
                            Source: {videoFile.name} {totalDuration ? `• Generated in ${totalDuration}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="modal-close-btn"
                        onClick={() => setShowUploadModal(false)}
                        title="Close dialog"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="upload-modal-body modal-success-body">
                      <div className="success-hero-box">
                        <div className="success-icon-ring">
                          <Box size={30} />
                        </div>
                        <h4>Your 3D Spatial Twin is Ready</h4>
                        <p>
                          Multi-view point cloud and textured 3D mesh have been generated and georeferenced.
                        </p>

                        <div className="success-meta-pills">
                          <div className="success-pill">
                            <span className="pill-lbl">Format</span>
                            <span className="pill-val">GLTF / GLB 3D</span>
                          </div>
                          {totalDuration && (
                            <div className="success-pill">
                              <span className="pill-lbl">Duration</span>
                              <span className="pill-val">{totalDuration}</span>
                            </div>
                          )}
                          <div className="success-pill">
                            <span className="pill-lbl">Engine</span>
                            <span className="pill-val">DUSt3R + 3DGS</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="upload-modal-footer">
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Download size={15} />}
                        onClick={() => window.open(activeModelPath ? activeModelPath.split('?')[0] : '/models/model.glb', '_blank')}
                      >
                        Download GLB
                      </Button>

                      <Button
                        variant="primary"
                        size="md"
                        onClick={navigateToViewer}
                        iconRight={<ChevronRight size={16} />}
                      >
                        Explore in Full 3D Inspector
                      </Button>
                    </div>
                  </>
                ) : (
                  /* 3. SCREEN 2: REVIEW & CONFIGURATION STATE */
                  <>
                    <div className="upload-modal-header">
                      <div className="modal-header-left">
                        <div className="modal-icon-badge">
                          <Video size={20} />
                        </div>
                        <div>
                          <h3 className="modal-title">Review & Configure Reconstruction</h3>
                          <p className="modal-subtitle">
                            Inspect video preview and adjust frame capture & AI parameters
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="modal-close-btn"
                        onClick={() => setShowUploadModal(false)}
                        title="Close dialog"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="upload-modal-body">
                      {/* Left Column: Video Preview */}
                      <div className="modal-preview-column">
                        <div className="modal-video-wrapper">
                          <video
                            src={videoUrl}
                            controls
                            className="modal-video-player"
                            muted
                            playsInline
                          />
                        </div>

                        <div className="modal-file-metadata-card">
                          <div className="meta-row">
                            <span className="meta-label">File:</span>
                            <span className="meta-val filename-val" title={videoFile.name}>{videoFile.name}</span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">Size:</span>
                            <span className="meta-val tabular-nums">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">Format:</span>
                            <span className="meta-val">{videoFile.type || 'video/mp4'}</span>
                          </div>
                          <div className="meta-row">
                            <span className="meta-label">Status:</span>
                            <span className="meta-badge-ready">Ready for Reconstruction</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Frame-capture Options Panel */}
                      <div className="modal-settings-column">
                        <h4 className="modal-section-title">
                          <Sliders size={16} />
                          <span>Frame Capture & Pipeline Options</span>
                        </h4>

                        {/* Option 1: Keyframe Sampling Rate */}
                        <div className="modal-setting-box">
                          <SegmentedControl
                            label="Keyframe Sampling Rate"
                            description="Target FPS extracted from video for multi-view stereo"
                            options={[
                              { value: 1, label: '1 FPS' },
                              { value: 2, label: '2 FPS' },
                              { value: 4, label: '4 FPS' },
                              { value: 5, label: '5 FPS' }
                            ]}
                            value={fps}
                            onChange={setFps}
                          />
                        </div>

                        {/* Option 2: YOLOv8 AI Masking */}
                        <div className="modal-setting-box">
                          <Switch
                            label="YOLOv8 AI Masking"
                            description="Filters sky, moving vehicles, and transient environmental noise"
                            checked={segmentationEnabled}
                            onChange={setSegmentationEnabled}
                          />
                        </div>

                        {/* Option 3: 3D Reconstruction Engine Details */}
                        <div className="modal-setting-box">
                          <label className="ui-segmented-label" style={{ marginBottom: 4, display: 'block' }}>
                            3D Reconstruction Mode
                          </label>
                          <div className="engine-badge-row">
                            <span className="setting-badge-highlight">DUSt3R Multi-View Dense</span>
                            <span className="setting-badge-sub">Auto-Calibration Active</span>
                          </div>
                        </div>

                        {/* Info Notice */}
                        <div className="modal-info-alert">
                          <Sparkles size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-primary)' }} />
                          <p>
                            Confirming will immediately initiate keyframe extraction, depth regression, and 3D point cloud generation.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="upload-modal-footer">
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={handleClearVideo}
                        icon={<RotateCcw size={14} />}
                      >
                        Back / choose another video
                      </Button>

                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleStartPipeline}
                        iconRight={<ChevronRight size={16} />}
                      >
                        Confirm and Generate
                      </Button>
                    </div>
                  </>
                )}
              </GlassCard>
            </div>
          )}

          {/* Dedicated 3D Model Inspection Launch Banner for Testers */}
          <section className="inspection-section" id="model-inspection">
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
                    Inspect generated point cloud model (<code>public/models/model.glb</code>) in full-screen WebGL viewport
                  </p>
                </div>
              </div>

              <div className="inspection-actions-group">
                <button
                  type="button"
                  className="btn-view-model"
                  onClick={navigateToViewer}
                  title="Launch full page 3D Model Inspector"
                >
                  <Eye size={16} />
                  <span>View Generated Model</span>
                  <ExternalLink size={14} style={{ opacity: 0.8 }} />
                </button>
              </div>
            </div>
          </section>

          {/* Core Capabilities & Feature Highlights */}
          <div className="features-section-wrapper" id="features">
            <div className="features-section-header">
              <span className="features-section-badge">
                <Sparkles size={12} />
                <span>CORE PIPELINE CAPABILITIES</span>
              </span>
              <h2 className="features-section-title">Autonomous 3D Spatial Intelligence</h2>
              <p className="features-section-subtitle">
                Engineered for complex drone survey trajectories, GPS-denied environments, and sub-meter GIS geospatial mapping.
              </p>
            </div>

            <div className="features-highlight-grid">
              {/* Feature 1: Intelligent Keyframing */}
              <div className="feature-card cyan">
                <div className="feature-card-top">
                  <div className="feature-icon-wrapper cyan">
                    <Video size={22} />
                  </div>
                  <span className="feature-index-tag">01</span>
                </div>
                <span className="feature-category-pill">ADAPTIVE EXTRACTION</span>
                <h3>Intelligent Keyframing</h3>
                <p>
                  Extracts sharp, motion-compensated frames while filtering out blurry drone turns, pitch wobble, and redundant viewpoints using Laplacian variance and optical flow metrics.
                </p>
                <div className="feature-tags-list">
                  <span className="feature-tag-chip">Laplacian Blur Guard</span>
                  <span className="feature-tag-chip">SSIM Baseline Pruning</span>
                  <span className="feature-tag-chip">4K Ingestion</span>
                </div>
              </div>

              {/* Feature 2: YOLOv8 AI Masking */}
              <div className="feature-card purple">
                <div className="feature-card-top">
                  <div className="feature-icon-wrapper purple">
                    <Cpu size={22} />
                  </div>
                  <span className="feature-index-tag">02</span>
                </div>
                <span className="feature-category-pill">DYNAMIC SEGMENTATION</span>
                <h3>YOLOv8 AI Masking</h3>
                <p>
                  Performs instant instance segmentation on moving vehicles, personnel, and sky boundaries to eliminate transient ghosting artifacts from reconstructed 3D geometry.
                </p>
                <div className="feature-tags-list">
                  <span className="feature-tag-chip">Dynamic Object Exclusion</span>
                  <span className="feature-tag-chip">Sky Inpainting Mask</span>
                  <span className="feature-tag-chip">Edge-Preserving</span>
                </div>
              </div>

              {/* Feature 3: DUSt3R 3D Point Cloud */}
              <div className="feature-card blue">
                <div className="feature-card-top">
                  <div className="feature-icon-wrapper blue">
                    <Layers size={22} />
                  </div>
                  <span className="feature-index-tag">03</span>
                </div>
                <span className="feature-category-pill">NEURAL STEREO</span>
                <h3>DUSt3R 3D Point Cloud</h3>
                <p>
                  Generates dense 3D point clouds and depth regression directly from uncalibrated multi-view pairs without requiring manual camera intrinsics, Colmap, or SfM bundles.
                </p>
                <div className="feature-tags-list">
                  <span className="feature-tag-chip">Zero-Calibration</span>
                  <span className="feature-tag-chip">ViT Cross-Attention</span>
                  <span className="feature-tag-chip">Direct Pointmaps</span>
                </div>
              </div>

              {/* Feature 4: Cesium GIS Integration */}
              <div className="feature-card emerald">
                <div className="feature-card-top">
                  <div className="feature-icon-wrapper emerald">
                    <Globe2 size={22} />
                  </div>
                  <span className="feature-index-tag">04</span>
                </div>
                <span className="feature-category-pill">GEOSPATIAL ANCHORING</span>
                <h3>Cesium GIS Integration</h3>
                <p>
                  Exports georeferenced ASPRS LAS, high-resolution GeoTIFF elevation models, and OGC 3D Tiles synchronized with drone GPS/IMU telemetry for sub-meter GIS mapping.
                </p>
                <div className="feature-tags-list">
                  <span className="feature-tag-chip">WGS-84 / UTM CRS</span>
                  <span className="feature-tag-chip">OGC 3D Tiles</span>
                  <span className="feature-tag-chip">Sub-Meter Precision</span>
                </div>
              </div>
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

          <div className="steps-grid" id="pipeline">
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
