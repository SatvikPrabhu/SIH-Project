import React from 'react';
import './ui.css';

/**
 * Reusable Segmented Control Component
 * @param {Object} props
 * @param {Array<{value: any, label: string}>} props.options
 * @param {any} props.value
 * @param {Function} props.onChange
 * @param {string} [props.label]
 * @param {string} [props.description]
 * @param {string} [props.className='']
 */
export default function SegmentedControl({
  options = [],
  value,
  onChange,
  label,
  description,
  className = ''
}) {
  return (
    <div className={`ui-segmented-wrapper ${className}`}>
      {(label || description) && (
        <div className="ui-segmented-header">
          {label && <label className="ui-segmented-label">{label}</label>}
          {description && <p className="ui-segmented-desc">{description}</p>}
        </div>
      )}

      <div className="ui-segmented-track" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`ui-segmented-item ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onChange && onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
