import React from 'react';
import './ui.css';

/**
 * Reusable Accessible Button Component
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'ghost' | 'danger'} [props.variant='primary']
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {boolean} [props.isLoading=false]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.iconRight]
 * @param {string} [props.className='']
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.type='button']
 * @param {Function} [props.onClick]
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconRight,
  className = '',
  children,
  disabled = false,
  type = 'button',
  onClick,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${isLoading ? 'is-loading' : ''} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...rest}
    >
      {isLoading ? (
        <span className="ui-btn__spinner" aria-hidden="true" />
      ) : icon ? (
        <span className="ui-btn__icon ui-btn__icon--left">{icon}</span>
      ) : null}

      <span className="ui-btn__text">{children}</span>

      {!isLoading && iconRight && (
        <span className="ui-btn__icon ui-btn__icon--right">{iconRight}</span>
      )}
    </button>
  );
}
