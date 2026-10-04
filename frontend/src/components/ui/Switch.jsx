import React from 'react';
import './ui.css';

/**
 * Reusable Tactile Switch Component
 * @param {Object} props
 * @param {boolean} props.checked
 * @param {Function} props.onChange
 * @param {string} [props.label]
 * @param {string} [props.description]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.id]
 */
export default function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className = ''
}) {
  const switchId = id || `ui-switch-${Math.random().toString(36).substring(2, 9)}`;

  const handleToggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      className={`ui-switch-wrapper ${disabled ? 'is-disabled' : ''} ${className}`}
      onClick={handleToggle}
    >
      <div className="ui-switch-content">
        {label && <label htmlFor={switchId} className="ui-switch-label">{label}</label>}
        {description && <p className="ui-switch-desc">{description}</p>}
      </div>

      <div
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`ui-switch ${checked ? 'is-checked' : ''}`}
      >
        <span className="ui-switch-thumb" />
      </div>
    </div>
  );
}
