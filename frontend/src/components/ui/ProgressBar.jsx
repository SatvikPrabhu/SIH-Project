import React from 'react';
import './ui.css';

/**
 * Refined Linear Progress Bar with Tabular Numerals
 * @param {Object} props
 * @param {number} props.progress - 0 to 100
 * @param {string} [props.label]
 * @param {boolean} [props.showPercent=true]
 * @param {string} [props.className='']
 */
export default function ProgressBar({
  progress = 0,
  label,
  showPercent = true,
  className = ''
}) {
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className={`ui-progress-bar-group ${className}`}>
      {(label || showPercent) && (
        <div className="ui-progress-bar__meta">
          {label && <span className="ui-progress-bar__label">{label}</span>}
          {showPercent && (
            <span className="ui-progress-bar__pct tabular-nums">{normalizedProgress}%</span>
          )}
        </div>
      )}

      <div className="ui-progress-bar__track" role="progressbar" aria-valuenow={normalizedProgress} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="ui-progress-bar__fill"
          style={{ width: `${normalizedProgress}%` }}
        />
      </div>
    </div>
  );
}
