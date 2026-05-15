'use client';

/**
 * V4Stepper — 3-step progress indicator for Plan-Wizard.
 * Shows step numbers, checkmarks for done, current highlighted.
 * Purely visual; parent owns progress state.
 */

interface V4StepperProps {
  current: number;          // 1-based current step
  steps: string[];          // Step labels e.g. ['Wann', 'Events', 'Notiz']
}

export function V4Stepper({ current, steps }: V4StepperProps) {
  return (
    <div
      className="flex items-center gap-2 mb-6"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={steps.length}
    >
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;

        return (
          <div
            key={i}
            data-step={stepNum}
            data-active={isActive}
            className="flex items-center gap-2"
          >
            {/* Step circle */}
            <div
              className={
                'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ' +
                (isActive
                  ? 'bg-[var(--v4-ink)] text-[#0a0a0c]'
                  : isDone
                  ? 'bg-[var(--v4-go)] text-[#0a0a0c]'
                  : 'border border-[var(--v4-hairline-3)] text-[var(--v4-ink-50)]')
              }
            >
              {isDone ? '✓' : stepNum}
            </div>

            {/* Step label */}
            <span
              className={
                'text-[12.5px] font-semibold ' +
                (isActive ? 'text-[var(--v4-ink)]' : 'text-[var(--v4-ink-50)]')
              }
            >
              {label}
            </span>

            {/* Divider between steps */}
            {i < steps.length - 1 && (
              <span
                className="w-6 h-px bg-[var(--v4-hairline-2)] mx-1"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
