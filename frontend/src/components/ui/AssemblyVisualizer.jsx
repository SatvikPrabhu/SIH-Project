import React, { useRef, useEffect } from 'react';
import './ui.css';

/**
 * AssemblyVisualizer
 * A calm, hypnotic 3D point-cloud and wireframe mesh canvas animation
 * that gracefully condenses and "assembles" particles and connecting edges
 * into a coherent spatial terrain form as progress increases from 0% to 100%.
 *
 * @param {Object} props
 * @param {number} props.progress - 0 to 100
 * @param {boolean} [props.isError=false]
 * @param {number} [props.width=420]
 * @param {number} [props.height=320]
 */
export default function AssemblyVisualizer({
  progress = 0,
  isError = false,
  width = 440,
  height = 320,
  className = ''
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let rotationAngle = 0;

    // Generate a fixed dome/terrain particle lattice (4 rings of elevation)
    const NUM_RINGS = 5;
    const PTS_PER_RING = 14;
    const points = [];

    // Top peak point
    points.push({ x: 0, y: -75, z: 0, targetY: -75, initialY: -140, phase: 0 });

    for (let r = 1; r <= NUM_RINGS; r++) {
      const radius = (r / NUM_RINGS) * 115;
      const targetY = -75 + (r / NUM_RINGS) * 75; // parabolic mountain curve
      const initialScatter = (Math.random() - 0.5) * 80;

      for (let i = 0; i < PTS_PER_RING; i++) {
        const theta = (i / PTS_PER_RING) * Math.PI * 2;
        points.push({
          x: Math.cos(theta) * radius,
          y: targetY,
          z: Math.sin(theta) * radius,
          targetY,
          initialY: targetY + initialScatter - 40,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    const render = () => {
      // Respect prefers-reduced-motion
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        rotationAngle += 0.008; // slow, serene rotation
      }

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 + 10;
      const progressFraction = Math.max(0, Math.min(1, progress / 100));

      // Coordinate projection with soft rotation around Y axis and slight pitch
      const pitch = 0.42; // slightly elevated angle
      const cosR = Math.cos(rotationAngle);
      const sinR = Math.sin(rotationAngle);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const projected = points.map((p) => {
        // Interpolate position from scattered state to assembled state based on progress
        const currentY = p.initialY + (p.targetY - p.initialY) * Math.min(1, progressFraction * 1.25);

        // Subtle floating breath wave
        const breath = Math.sin(rotationAngle * 2 + p.phase) * (1 - progressFraction * 0.6) * 3;

        // Rotate around Y
        const rx = p.x * cosR - p.z * sinR;
        const rz = p.x * sinR + p.z * cosR;
        const ry = currentY + breath;

        // Pitch tilt
        const py = ry * cosP - rz * sinP;
        const pz = ry * sinP + rz * cosP;

        // Perspective scale factor
        const fov = 340;
        const scale = fov / (fov + pz + 80);
        return {
          sx: centerX + rx * scale,
          sy: centerY + py * scale,
          scale,
          z: pz
        };
      });

      // 1. Draw subtle connecting wireframe edges (only visible as progress builds)
      if (progressFraction > 0.12 && !isError) {
        const edgeOpacity = Math.min(0.4, (progressFraction - 0.12) * 0.6);
        ctx.strokeStyle = `rgba(56, 189, 248, ${edgeOpacity})`;
        ctx.lineWidth = 0.8;

        for (let i = 1; i < projected.length; i++) {
          const p1 = projected[i];
          // Connect to adjacent in ring
          const ringIndex = Math.floor((i - 1) / PTS_PER_RING);
          const posInRing = (i - 1) % PTS_PER_RING;
          const nextInRing = 1 + ringIndex * PTS_PER_RING + ((posInRing + 1) % PTS_PER_RING);

          if (projected[nextInRing]) {
            const p2 = projected[nextInRing];
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.stroke();
          }

          // Connect to peak if in first ring
          if (ringIndex === 0) {
            const p0 = projected[0];
            ctx.beginPath();
            ctx.moveTo(p0.sx, p0.sy);
            ctx.lineTo(p1.sx, p1.sy);
            ctx.stroke();
          }
        }
      }

      // 2. Draw point cloud nodes (pastel soft indigo / teal particles)
      projected.sort((a, b) => a.z - b.z); // Depth sorting

      projected.forEach((p, idx) => {
        const ptRadius = Math.max(1.4, 2.5 * p.scale);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, ptRadius, 0, Math.PI * 2);

        if (isError) {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + p.scale * 0.4})`;
        } else if (idx === 0) {
          // Peak beacon
          ctx.fillStyle = '#38bdf8';
        } else {
          const alpha = 0.35 + p.scale * 0.45;
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        }
        ctx.fill();

        if (progressFraction > 0.6 && idx % 3 === 0) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, ptRadius * 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [progress, isError, width, height]);

  return (
    <div className={`assembly-visualizer-container ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="assembly-visualizer-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
