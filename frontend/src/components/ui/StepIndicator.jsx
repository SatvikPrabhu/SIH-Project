import React from 'react';
import './ui.css';

const DEFAULT_STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'review', label: 'Review' },
  { id: 'generate', label: 'Generate' },
  { id: 'view', label: 'View' }
];

/**
 * Minimal Header / Workflow Step Indicator
 * @param {Object} props
 * @param {number} props.currentStep - 0: Upload, 1: Review, 2: Generate, 3: View
 * @param {Array<{id: string, label: string}>} [props.steps]
 * @param {string} [props.className='']
 */
export default function StepIndicator({
  currentStep = 0,
  steps = DEFAULT_STEPS,
  className = ''
}) {
  return (
    <nav className={`ui-step-indicator ${className}`} aria-label="Workflow progress">
      <ol className="ui-step-indicator__list">
        {steps.map((step, idx) => {
          const isComplete = idx < currentStep;
          const isCurrent = idx === currentStep;

          return (
            <li
              key={step.id}
              className={`ui-step-indicator__item ${isComplete ? 'is-complete' : ''} ${isCurrent ? 'is-current' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="ui-step-indicator__dot" />
              <span className="ui-step-indicator__label">{step.label}</span>
              {idx < steps.length - 1 && (
                <span className="ui-step-indicator__divider" aria-hidden="true">/</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
