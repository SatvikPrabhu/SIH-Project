import React, { Suspense, useLayoutEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage, Center, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Layers, MousePointer, ZoomIn, Move, FlipVertical, RotateCw, RotateCcw } from 'lucide-react';
import './ModelViewer.css';

/**
 * Inner component to load, configure, and render DUSt3R point cloud / mesh data
 */
function Dust3RModel({ modelUrl, pointSize = 0.03, rotation = [Math.PI, 0, 0] }) {
  const { scene } = useGLTF(modelUrl);

  useLayoutEffect(() => {
    if (!scene) return;
    console.log(`\n[MODEL VIEWER] 3D GLB model loaded successfully into WebGL viewport: ${modelUrl}\n`);

    scene.traverse((child) => {
      // DUSt3R exports point cloud primitives (THREE.Points) inside the GLB
      if (child.isPoints || child instanceof THREE.Points) {
        if (child.material) {
          child.material.size = pointSize;
          child.material.sizeAttenuation = true;
          // Ensure vertex colors exported from DUSt3R are rendered accurately
          if (child.geometry && child.geometry.attributes.color) {
            child.material.vertexColors = true;
          }
          child.material.needsUpdate = true;
        }
      }
    });
  }, [scene, pointSize, modelUrl]);

  return (
    <group rotation={rotation}>
      <primitive object={scene} />
    </group>
  );
}

/**
 * Lightweight loading spinner inside the Three.js Canvas
 */
function CanvasLoader() {
  return (
    <Html center>
      <div className="model-loading-overlay">
        <div className="model-spinner"></div>
        <span>Streaming 3D Point Cloud...</span>
      </div>
    </Html>
  );
}

/**
 * Production-ready 3D Model Viewer for DUSt3R Reconstruction Outputs
 *
 * @param {Object} props
 * @param {string} [props.modelUrl='/models/model.glb'] - Path to the reconstructed .glb asset
 * @param {number} [props.pointSize=0.03] - Size of point cloud splats/vertices
 * @param {string} [props.className=''] - Optional CSS class for the wrapper
 */
export default function ModelViewer({
  modelUrl = '/models/model.glb',
  pointSize = 0.03,
  className = ''
}) {
  // OpenCV coordinate systems (DUSt3R) have Y pointing down, so flipping around X-axis (180°) renders the model upright in Three.js
  const [isFlipped, setIsFlipped] = useState(true);
  const [rotationY, setRotationY] = useState(0);

  const handleToggleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleRotate90 = () => {
    setRotationY((prev) => (prev + Math.PI / 2) % (Math.PI * 2));
  };

  const handleResetOrientation = () => {
    setIsFlipped(true);
    setRotationY(0);
  };

  return (
    <div className={`model-viewer-wrapper ${className}`}>
      {/* Top-Left Navigation & Controls HUD */}
      <div className="model-viewer-hud">
        <div className="hud-badge">
          <span className="hud-pulse-dot"></span>
          <span>DUSt3R 3D Spatial Twin</span>
        </div>

        <div className="hud-hints-card">
          <span className="hud-hint-item">
            <MousePointer size={13} className="text-cyan-400" />
            <span className="hud-hint-key">Left Click:</span> Rotate
          </span>
          <span className="hud-hint-sep">•</span>
          <span className="hud-hint-item">
            <ZoomIn size={13} className="text-cyan-400" />
            <span className="hud-hint-key">Scroll:</span> Zoom
          </span>
          <span className="hud-hint-sep">•</span>
          <span className="hud-hint-item">
            <Move size={13} className="text-cyan-400" />
            <span className="hud-hint-key">Right Click:</span> Pan
          </span>
        </div>
      </div>

      {/* Top-Right Orientation & Flip Controls HUD */}
      <div className="model-viewer-controls-hud">
        <button
          type="button"
          className={`hud-control-btn ${isFlipped ? 'active' : ''}`}
          onClick={handleToggleFlip}
          title={isFlipped ? "Model is flipped upright (180°). Click to invert." : "Click to flip model upright (180°)"}
        >
          <FlipVertical size={14} />
          <span>{isFlipped ? 'Flipped Upright (180°)' : 'Flip Upside Down'}</span>
        </button>

        <button
          type="button"
          className="hud-control-btn"
          onClick={handleRotate90}
          title="Rotate 90 degrees horizontally"
        >
          <RotateCw size={14} />
          <span>Rotate 90°</span>
        </button>

        {(!isFlipped || rotationY !== 0) && (
          <button
            type="button"
            className="hud-control-btn reset"
            onClick={handleResetOrientation}
            title="Reset model orientation"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Three.js Render Canvas */}
      <div className="model-canvas-container">
        <Canvas
          shadows
          camera={{ position: [0, 1.5, 4], fov: 45 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
          }}
        >
          <color attach="background" args={['#0a0f1d']} />

          <Suspense fallback={<CanvasLoader />}>
            <Stage
              environment="city"
              intensity={0.6}
              adjustCamera={1.2}
              shadows={false}
            >
              <Center>
                <Dust3RModel
                  modelUrl={modelUrl}
                  pointSize={pointSize}
                  rotation={[isFlipped ? Math.PI : 0, rotationY, 0]}
                />
              </Center>
            </Stage>
          </Suspense>

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.06}
            minDistance={0.5}
            maxDistance={50}
            rotateSpeed={0.8}
            zoomSpeed={0.9}
            panSpeed={0.8}
          />
        </Canvas>
      </div>
    </div>
  );
}

// Preload the default or specified 3D asset into Drei cache
useGLTF.preload('/models/model.glb');
