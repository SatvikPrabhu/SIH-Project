import React from 'react';
import './ui.css';

/**
 * Refined Circular Progress Indicator
 * @param {Object} props
 * @param {number} props.progress - 0 to 100
 * @param {number} [props.size=120]
 * @param {number} [props.strokeWidth=4]
 * @param {string} [props.label]
 * @param {string} [props.className='']
 */
export default function ProgressRing({
  progress = 0,
  size = 120,
  strokeWidth = 4,
  label,
  className = ''
}) {
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className={`ui-progress-ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ui-progress-ring__svg">
        {/* Background Track */}
        <circle
          className="ui-progress-ring__track"
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Progress Indicator */}
        <circle
          className="ui-progress-ring__indicator"
          stroke="var(--accent-primary)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>

      <div className="ui-progress-ring__content">
        <span className="ui-progress-ring__val tabular-nums">{normalizedProgress}%</span>
        {label && <span className="ui-progress-ring__label">{label}</span>}
      </div>
    </div>
  );
}
