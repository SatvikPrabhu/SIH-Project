import React from 'react';
import './ui.css';

/**
 * Reusable Frosted Glass Surface Card
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 * @param {string} [props.variant='default'] - 'default' | 'subtle' | 'elevated' | 'interactive'
 * @param {React.CSSProperties} [props.style]
 * @param {Function} [props.onClick]
 */
export default function GlassCard({
  children,
  className = '',
  variant = 'default',
  style = {},
  onClick,
  ...rest
}) {
  return (
    <div
      className={`glass-card glass-card--${variant} ${className}`}
      style={style}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}
